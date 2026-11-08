import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type { ReactNode } from "react";

import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  CircleAlert,
  CircleCheck,
  Plus,
  Trash2,
} from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { ApiError } from "../../../lib/http/client";
import { canRunInventoryAction } from "../utils/inventory-access";
import type { AuthSession } from "../../auth/types/auth.types";

import { useInventoryQuery } from "../hooks/useInventoryQuery";

import {
  createTransfer,
  loadTransferBalances,
  loadTransferLocations,
  previewTransfer,
  transferError,
  transferInput,
  transferQuantity,
} from "../services/inventory-transfer.service";

import type {
  Transfer,
  TransferInput,
} from "../services/inventory-transfer.service";

import {
  add,
  fixed,
  money,
  multiply,
  quantity,
} from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Choice, Field, Notice } from "./InventoryLocationUI";
import { InventoryResponsiveRecords } from "./InventoryResponsiveRecords";
import { InventoryMovementDetail } from "./InventoryMovementDetail";

const emptyLine = () => ({
  key: crypto.randomUUID(),
  inventoryItemId: "",
  quantity: "",
  notes: "",
});

type Line = ReturnType<typeof emptyLine>;
type Preview = ReturnType<typeof previewTransfer>;

function Facts({
  rows,
}: {
  rows: {
    label: string;
    value: ReactNode;
  }[];
}) {
  return (
    <dl
      className={
        "grid gap-4 sm:grid-cols-2 " +
        (rows.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")
      }
    >
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-xs text-muted">{row.label}</dt>

          <dd className="m-0 mt-1 break-words text-sm">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function InventoryTransferDialog({
  initialLocationId,
  currency,
  timezone,
  onClose,
}: {
  initialLocationId: string;
  currency: string;
  timezone: string;
  onClose: () => void;
}) {
  const { session } = useAppShell();
  const modalId = useId();

  const canTransfer = canRunInventoryAction(session, "transfer");
  const [source, setSource] = useState(initialLocationId);
  const [destination, setDestination] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const [review, setReview] = useState<{
    body: TransferInput;
    rows: Preview;
  } | null>(null);

  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);

  const [result, setResult] = useState<Transfer | null>(null);
  const [opened, setOpened] = useState("");

  const sending = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  const locations = useInventoryQuery(
    "transfer-locations",
    loadTransferLocations
  );

  const loadSource = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      loadTransferBalances(current, signal, source),
    [source]
  );

  const balances = useInventoryQuery(
    "transfer-source:" + source,
    loadSource
  );

  const places = locations.data ?? [];

  const stock =
    !balances.pending && !balances.error ? (balances.data ?? []) : [];

  const pending = locations.pending || balances.pending;
  const readError = locations.error || balances.error;

  const dirty =
    source !== initialLocationId ||
    !!destination ||
    !!reference ||
    !!notes ||
    lines.some(
      (line) =>
        !!line.inventoryItemId || !!line.quantity || !!line.notes
    );

  function refresh() {
    locations.refresh();
    balances.refresh();
  }

  function close() {
    if (sending.current) return;

    if (dirty && !result && !locked) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  function changeSource(value: string) {
    setSource(value);

    if (value === destination) {
      setDestination("");
    }

    setLines([emptyLine()]);
    setReview(null);
    setConfirmed(false);
    setError("");
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, ...patch } : line
      )
    );

    setConfirmed(false);
    setError("");
  }

  function buildReview() {
    if (pending || readError) {
      throw new Error(
        "Espera a que se actualicen las ubicaciones y los saldos."
      );
    }

    const body = transferInput.parse({
      sourceLocationId: source,
      destinationLocationId: destination,
      externalReference: reference,
      notes,

      lines: lines.map(
        ({ inventoryItemId, quantity: amount, notes: memo }) => ({
          inventoryItemId,
          quantity: amount,
          notes: memo,
        })
      ),
    });

    if (
      !places.some((place) => place.id === source) ||
      !places.some((place) => place.id === destination)
    ) {
      throw new Error(
        "Selecciona dos ubicaciones activas y habilitadas para inventario."
      );
    }

    return {
      body,
      rows: previewTransfer(body, stock),
    };
  }

  function next() {
    try {
      setReview(buildReview());
      setConfirmed(false);
      setError("");
    } catch (cause) {
      setError(transferError(cause));
    }
  }

  async function submit() {
    if (
      !canTransfer ||
      sending.current ||
      locked ||
      !confirmed ||
      !review
    ) {
      return;
    }

    let current: {
      body: TransferInput;
      rows: Preview;
    };

    try {
      current = buildReview();
    } catch (cause) {
      setReview(null);
      setConfirmed(false);
      setError(transferError(cause));
      return;
    }

    const changedCost = current.rows.some(
      (row, index) => row.unitCost !== review.rows[index]?.unitCost
    );

    if (changedCost) {
      setReview(current);
      setConfirmed(false);
      setError(
        "Los costos del origen cambiaron. Revisa los valores y confirma nuevamente."
      );
      return;
    }

    sending.current = true;
    setBusy(true);
    setError("");

    try {
      const saved = await createTransfer(
        session,
        new AbortController().signal,
        current.body
      );

      if (alive.current) {
        setResult(saved);
      }
    } catch (cause) {
      if (!alive.current) return;

      setConfirmed(false);

      const uncertain =
        !(cause instanceof ApiError) ||
        cause.status === 0 ||
        cause.status >= 500;

      const accessError =
        cause instanceof ApiError &&
        [401, 403].includes(cause.status);

      setLocked(uncertain || accessError);

      setError(
        transferError(cause) +
          (uncertain
            ? "\nNo se pudo confirmar el resultado. Revisa Movimientos y Existencias antes de volver a registrar la transferencia."
            : "")
      );

      if (
        !uncertain &&
        cause instanceof ApiError &&
        ![401, 403].includes(cause.status)
      ) {
        setReview(null);
        refresh();
      }
    } finally {
      sending.current = false;

      if (alive.current) {
        setBusy(false);
      }
    }
  }

  if (!canTransfer) {
    return (
      <Notice>
        No tienes permiso para realizar transferencias.
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Notice>
    );
  }

  if (opened && result) {
    return (
      <InventoryMovementDetail
        id={opened}
        currency={currency}
        timezone={timezone}
        onClose={() => setOpened("")}
      />
    );
  }

  let canReview: boolean;

  try {
    buildReview();
    canReview = true;
  } catch {
    canReview = false;
  }

  const locationLabel = (id: string) => {
    const place = places.find((entry) => entry.id === id);

    return place ? place.name + " · " + place.code : "—";
  };

  const total = result
    ? add(...result.lines.map((line) => line.totalCost))
    : review
      ? add(...review.rows.map((line) => line.totalCost))
      : "0";

  const rowData = (review?.rows ?? []).map((line) => ({
    id: line.inventoryItemId,

    fields: [
      {
        label: "Artículo / SKU",
        value: (
          <>
            <p>{line.inventoryItemName}</p>

            <p className="text-xs text-muted">
              {line.sku || "Sin SKU"}
            </p>
          </>
        ),
      },
      {
        label: "Cantidad",
        value: quantity(line.quantity, line.baseUnit),
      },
      {
        label: "Costo unitario trasladado",
        value: money(line.unitCost, currency),
      },
      {
        label: "Valor trasladado",
        value: money(line.totalCost, currency),
      },
      {
        label: "Notas",
        value: line.notes || "—",
      },
    ],
  }));

  return (
    <BottomSheet
      id={modalId}
      open
      variant="modal"
      busy={busy}
      onClose={close}
      title={
        result
          ? "Transferencia #" + result.id + " completada"
          : "Nueva transferencia"
      }
      className="w-[calc(100%_-_2rem)]! max-w-[1000px]! max-h-[calc(100dvh_-_2rem)]! p-0! overflow-hidden! [&[open]]:flex [&[open]]:flex-col [&>.bottom-sheet-heading]:m-0 [&>.bottom-sheet-heading]:shrink-0 [&>.bottom-sheet-heading]:px-5 [&>.bottom-sheet-heading]:pt-5"
    >
      <p className="shrink-0 border-b border-outline px-5 pb-5 text-xs text-muted">
        {result
          ? "Completada"
          : review
            ? "Paso 2 de 2 · Revisión y confirmación"
            : "Paso 1 de 2 · Datos de la transferencia"}
      </p>

      <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain p-5 text-sm text-heading">
        {error && (
          <p
            role="alert"
            className="whitespace-pre-line rounded-xl bg-red-500/10 p-3 text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        {discard ? (
          <Notice>
            <p>
              Tienes cambios sin guardar. ¿Quieres descartar esta
              transferencia?
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setDiscard(false)}
              >
                Seguir editando
              </Button>

              <Button variant="danger" onClick={onClose}>
                Descartar cambios
              </Button>
            </div>
          </Notice>
        ) : result ? (
          <>
            <p className="flex items-center gap-2 text-lg text-emerald-700 dark:text-emerald-400">
              <CircleCheck size={20} />
              Completada
            </p>

            <p>
              {result.sourceLocation.name}
              {" · "}
              {result.sourceLocation.code}
              {" → "}
              {result.destinationLocation.name}
              {" · "}
              {result.destinationLocation.code}
            </p>

            <Facts
              rows={[
                {
                  label: "Movimiento de salida",
                  value: "M-" + result.sourceMovementId,
                },
                {
                  label: "Movimiento de entrada",
                  value: "M-" + result.destinationMovementId,
                },
                {
                  label: "Cantidad de líneas",
                  value: result.lines.length,
                },
                {
                  label: "Valor total trasladado",
                  value: money(total, currency),
                },
                {
                  label: "Responsable",
                  value: session.user.fullName,
                },
                {
                  label: "Fecha y hora",
                  value: new Intl.DateTimeFormat("es-CO", {
                    timeZone: timezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(result.completedAt)),
                },
              ]}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpened(result.sourceMovementId)}
              >
                Ver movimiento de salida
              </Button>

              <Button
                variant="secondary"
                onClick={() =>
                  setOpened(result.destinationMovementId)
                }
              >
                Ver movimiento de entrada
              </Button>
            </div>
          </>
        ) : (
          <>
            {pending && (
              <Notice>Cargando ubicaciones y saldos…</Notice>
            )}

            {readError && (
              <Notice>
                {readError}{" "}
                <Button
                  variant="secondary"
                  onClick={refresh}
                  disabled={busy}
                >
                  Reintentar consulta
                </Button>
              </Notice>
            )}

            {!review ? (
              <fieldset
                disabled={busy || locked}
                className="m-0 grid min-w-0 gap-5 border-0 p-0"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Choice
                    label="Ubicación de origen"
                    value={source}
                    onValueChange={changeSource}
                    disabled={locations.pending}
                    options={places.map((place) => ({
                      value: place.id,
                      label: locationLabel(place.id),
                    }))}
                  />

                  <Choice
                    label="Ubicación de destino"
                    value={destination}
                    onValueChange={setDestination}
                    disabled={locations.pending}
                    options={places
                      .filter((place) => place.id !== source)
                      .map((place) => ({
                        value: place.id,
                        label: locationLabel(place.id),
                      }))}
                  />

                  <Field
                    label="Referencia externa (opcional)"
                    value={reference}
                    onChange={setReference}
                    maxLength={120}
                  />

                  <div>
                    <Field
                      label="Motivo o notas"
                      value={notes}
                      onChange={setNotes}
                      multiline
                      maxLength={500}
                    />

                    <p className="mt-1 text-xs text-muted">
                      {notes.trim().length}/500 · obligatorio, mínimo
                      3 caracteres
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <strong>Artículos</strong>

                  <span className="text-xs text-muted">
                    {lines.length}/100
                  </span>
                </div>

                {!lines.length && (
                  <Notice>
                    Agrega al menos un artículo para continuar.
                  </Notice>
                )}

                {source &&
                  !pending &&
                  !readError &&
                  !stock.some(
                    (row) =>
                      row.isItemActive &&
                      fixed(row.currentStock) > 0n &&
                      row.valuationStatus === "VALUED" &&
                      row.averageUnitCost !== null
                  ) && (
                    <Notice>
                      No hay artículos activos con existencias
                      valoradas disponibles para transferir en este
                      origen.
                    </Notice>
                  )}

                {lines.map((line, index) => {
                  const balance = stock.find(
                    (row) =>
                      row.inventoryItemId === line.inventoryItemId
                  );

                  const amount = transferQuantity.safeParse(
                    line.quantity
                  );

                  const validCost =
                    balance?.valuationStatus === "VALUED" &&
                    balance.averageUnitCost !== null;

                  const excessive =
                    amount.success &&
                    balance &&
                    fixed(amount.data) > fixed(balance.currentStock);

                  const lineError = !line.inventoryItemId
                    ? "Selecciona un artículo."
                    : !balance
                      ? "El artículo no está disponible en este origen."
                      : !validCost
                        ? "Sin valoración. No se puede transferir."
                        : !amount.success
                          ? "Ingresa una cantidad mayor que cero, con máximo tres decimales."
                          : excessive
                            ? "La cantidad supera la existencia disponible."
                            : "";

                  return (
                    <section
                      key={line.key}
                      className="grid gap-3 border-b border-outline pb-5"
                    >
                      <div className="flex items-center justify-between">
                        <span>Línea {index + 1}</span>

                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={"Eliminar línea " + (index + 1)}
                          onClick={() =>
                            setLines((previous) =>
                              previous.filter(
                                (entry) => entry.key !== line.key
                              )
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                        <Choice
                          label="Artículo"
                          value={line.inventoryItemId}
                          disabled={!source || pending || !!readError}
                          onValueChange={(value) =>
                            updateLine(line.key, {
                              inventoryItemId: value,
                            })
                          }
                          options={stock
                            .filter(
                              (row) =>
                                row.isItemActive &&
                                fixed(row.currentStock) > 0n &&
                                (row.inventoryItemId ===
                                  line.inventoryItemId ||
                                  !lines.some(
                                    (entry) =>
                                      entry.inventoryItemId ===
                                      row.inventoryItemId
                                  ))
                            )
                            .map((row) => ({
                              value: row.inventoryItemId,

                              label:
                                row.name +
                                " · " +
                                (row.sku || "Sin SKU") +
                                " · Disponible: " +
                                quantity(
                                  row.currentStock,
                                  row.baseUnit
                                ) +
                                (row.valuationStatus !== "VALUED" ||
                                row.averageUnitCost === null
                                  ? " · Sin valoración"
                                  : ""),

                              disabled:
                                row.valuationStatus !== "VALUED" ||
                                row.averageUnitCost === null,
                            }))}
                        />

                        <Field
                          label="Cantidad a transferir"
                          value={line.quantity}
                          decimal
                          placeholder="0.000"
                          onChange={(value) =>
                            updateLine(line.key, {
                              quantity: value.replace(",", "."),
                            })
                          }
                        />
                      </div>

                      {balance && (
                        <Facts
                          rows={[
                            {
                              label: "SKU / Unidad base",
                              value:
                                (balance.sku || "Sin SKU") +
                                " · " +
                                quantity("1", balance.baseUnit),
                            },
                            {
                              label: "Disponible en origen",
                              value: quantity(
                                balance.currentStock,
                                balance.baseUnit
                              ),
                            },
                            {
                              label: "Costo promedio del origen",
                              value: validCost
                                ? money(
                                    balance.averageUnitCost,
                                    currency
                                  )
                                : "Sin valoración",
                            },
                            {
                              label: "Valor trasladado",
                              value:
                                validCost && amount.success
                                  ? money(
                                      multiply(
                                        amount.data,
                                        balance.averageUnitCost!
                                      ),
                                      currency
                                    )
                                  : "—",
                            },
                          ]}
                        />
                      )}

                      {lineError &&
                        (line.inventoryItemId || line.quantity) && (
                          <p
                            role="alert"
                            className="text-xs text-red-600 dark:text-red-400"
                          >
                            {lineError}
                          </p>
                        )}

                      <Field
                        label="Notas de la línea (opcional)"
                        value={line.notes}
                        maxLength={500}
                        onChange={(value) =>
                          updateLine(line.key, {
                            notes: value,
                          })
                        }
                      />
                    </section>
                  );
                })}

                <Button
                  variant="secondary"
                  disabled={lines.length >= 100}
                  onClick={() =>
                    setLines((previous) => [...previous, emptyLine()])
                  }
                >
                  <Plus size={16} />
                  Agregar artículo
                </Button>
              </fieldset>
            ) : (
              <>
                <Facts
                  rows={[
                    {
                      label: "Origen",
                      value: locationLabel(source),
                    },
                    {
                      label: "Destino",
                      value: locationLabel(destination),
                    },
                    {
                      label: "Referencia",
                      value: reference || "—",
                    },
                    {
                      label: "Motivo",
                      value: notes,
                    },
                    {
                      label: "Responsable",
                      value: session.user.fullName,
                    },
                  ]}
                />

                <InventoryResponsiveRecords
                  label="Artículos a transferir"
                  rows={rowData}
                  verticalAlign="middle"
                />

                <div className="flex justify-between gap-4 border-t border-outline pt-4">
                  <strong>Valor total de la transferencia</strong>

                  <strong>{money(total, currency)}</strong>
                </div>

                <p className="text-xs text-muted">
                  Valores estimados. El costo definitivo se calcula
                  con la valoración del origen al confirmar.
                </p>

                <div className="flex gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
                  <CircleAlert size={18} className="shrink-0" />

                  <p>
                    Esta operación descontará inmediatamente las
                    existencias del origen y las ingresará en el
                    destino conservando su valor. Se crearán dos
                    movimientos relacionados y la transferencia no
                    podrá deshacerse directamente.
                  </p>
                </div>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-orange-500"
                    checked={confirmed}
                    disabled={busy || locked}
                    onChange={(event) =>
                      setConfirmed(event.target.checked)
                    }
                  />
                  Confirmo las ubicaciones, los artículos y las
                  cantidades de esta transferencia.
                </label>
              </>
            )}
          </>
        )}
      </div>

      {!discard && (
        <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-outline bg-background p-4">
          {result || locked ? (
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (review) {
                    setReview(null);
                    setConfirmed(false);
                    setError("");
                  } else {
                    close();
                  }
                }}
              >
                {review ? (
                  <>
                    <ArrowLeft size={16} />
                    Anterior
                  </>
                ) : (
                  "Cancelar"
                )}
              </Button>

              <Button
                loading={busy}
                disabled={
                  pending ||
                  !!readError ||
                  (review ? !confirmed : !canReview)
                }
                onClick={review ? () => void submit() : next}
              >
                {review ? (
                  <>
                    Completar transferencia
                    <ArrowLeftRight size={16} />
                  </>
                ) : (
                  <>
                    Revisar transferencia
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </>
          )}
        </footer>
      )}
    </BottomSheet>
  );
}
