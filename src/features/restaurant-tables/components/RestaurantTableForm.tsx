import { useEffect, useId, useRef, useState } from "react";
import { Power, RotateCcw, Store, TriangleAlert } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { BusinessLocation } from "../../business/schemas/organization.schema";
import { getLocations } from "../../business/services/organization.service";
import {
  tableCapacityLabel,
  tableChanges,
  tableDraft,
  tableFormSchema,
  tableLocationLabel,
} from "../schemas/restaurant-table.schema";
import type {
  RestaurantTable,
  TableAction,
  TableDraft,
} from "../schemas/restaurant-table.schema";
import {
  getRestaurantTable,
  saveRestaurantTable,
  tableErrorMessage,
} from "../services/restaurant-table.service";

export type TableModalMode =
  | "create"
  | "edit"
  | "deactivate"
  | "reactivate";

interface Props {
  session: AuthSession;
  mode: TableModalMode;
  tableId?: string;
  initialLocationId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (error: unknown) => boolean;
}

export function RestaurantTableForm({
  session,
  mode,
  tableId,
  initialLocationId,
  onClose,
  onSaved,
  onError,
}: Props) {
  const dialogId = useId();

  // Una actualización de sesión no reinicializa el borrador.
  const [opening] = useState(() => ({
    session,
    tableId,
    initialLocationId,
    onClose,
    onError,
  }));

  const [loaded, setLoaded] = useState<{
    table?: RestaurantTable;
    locations: BusinessLocation[];
  } | null>(null);

  const [draft, setDraft] = useState(tableDraft);
  const [locationId, setLocationId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, showMessage] = useTimedMessage(5000);
  const [loadError, setLoadError] = useState("");
  const [locationsError, setLocationsError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  const write = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const { session, tableId, initialLocationId, onClose, onError } =
      opening;

    async function load() {
      try {
        if (tableId) {
          const table = await getRestaurantTable(
            tableId,
            session.accessToken,
            controller.signal
          );

          controller.signal.throwIfAborted();

          if (
            table.id !== tableId ||
            table.businessId !== session.business.id
          ) {
            throw new ApiError(
              502,
              "INVALID_RESPONSE",
              "Respuesta inesperada."
            );
          }

          setLoaded({ table, locations: [] });
          setDraft(tableDraft(table));
        } else {
          const all = await getLocations(session, controller.signal, {
            activeOnly: true,
          });

          controller.signal.throwIfAborted();

          const locations = all.filter(
            (item) =>
              item.isActive && item.locationType === "POINT_OF_SALE"
          );

          setLoaded({ locations });

          setLocationId(
            locations.some((item) => item.id === initialLocationId)
              ? initialLocationId
              : ""
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (onError(error)) {
          onClose();
          return;
        }

        setLoadError(tableErrorMessage(error));
      }
    }

    void load();

    return () => controller.abort();
  }, [attempt, opening]);

  useEffect(
    () => () => {
      write.current?.abort();
    },
    []
  );

  const table = loaded?.table;

  const isStatus = mode === "deactivate" || mode === "reactivate";

  const parsed = tableFormSchema.safeParse(draft);

  const patch =
    table && parsed.success ? tableChanges(table, parsed.data) : {};

  const eligibleLocation = loaded?.locations.some(
    (item) =>
      item.id === locationId &&
      item.isActive &&
      item.locationType === "POINT_OF_SALE"
  );

  const statusAlreadySet =
    !!table && isStatus && table.isActive === (mode === "reactivate");

  const valid = isStatus
    ? !!table && !statusAlreadySet
    : parsed.success &&
      !Object.values(errors).some(Boolean) &&
      (mode === "create"
        ? !!eligibleLocation && !locationsError
        : Object.keys(patch).length > 0);

  const title =
    mode === "create"
      ? "Nueva mesa"
      : mode === "edit"
        ? "Editar mesa"
        : mode === "deactivate"
          ? "¿Desactivar esta mesa?"
          : "¿Reactivar esta mesa?";

  const saveLabel =
    mode === "create"
      ? "Crear mesa"
      : mode === "edit"
        ? "Guardar cambios"
        : mode === "deactivate"
          ? "Desactivar mesa"
          : "Reactivar mesa";

  function change(key: keyof TableDraft, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [key]: "",
    }));
  }

  async function refreshLocations(signal: AbortSignal) {
    try {
      const all = await getLocations(session, signal, {
        activeOnly: true,
      });

      signal.throwIfAborted();

      const locations = all.filter(
        (item) =>
          item.isActive && item.locationType === "POINT_OF_SALE"
      );

      setLoaded((previous) =>
        previous ? { ...previous, locations } : previous
      );

      setLocationsError("");
    } catch (error) {
      if (signal.aborted) return;

      if (onError(error)) {
        onClose();
        return;
      }

      setLocationsError(
        "No pudimos actualizar los puntos de venta. Reintenta antes de guardar."
      );
    }
  }

  async function retryLocations() {
    if (write.current) return;

    const controller = new AbortController();
    write.current = controller;
    setBusy(true);

    try {
      await refreshLocations(controller.signal);
    } finally {
      write.current = null;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  async function submit() {
    if (
      !valid ||
      busy ||
      write.current ||
      !session.authorization.roles.includes("ADMIN")
    ) {
      return;
    }

    let action: TableAction;

    if (isStatus && table) {
      action = {
        kind: "status",
        id: table.id,
        isActive: mode === "reactivate",
      };
    } else if (
      mode === "create" &&
      parsed.success &&
      eligibleLocation
    ) {
      action = {
        kind: "create",
        input: {
          ...parsed.data,
          locationId,
        },
      };
    } else if (mode === "edit" && table) {
      action = {
        kind: "update",
        id: table.id,
        input: patch,
      };
    } else {
      return;
    }

    const controller = new AbortController();
    write.current = controller;

    setBusy(true);
    showMessage("");

    try {
      const saved = await saveRestaurantTable(
        action,
        session.accessToken,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (
        saved.businessId !== session.business.id ||
        (table &&
          (saved.id !== table.id ||
            saved.locationId !== table.locationId)) ||
        (action.kind === "create" && saved.locationId !== locationId)
      ) {
        throw new ApiError(
          502,
          "INVALID_RESPONSE",
          "Respuesta inesperada."
        );
      }

      onSaved(
        mode === "create"
          ? "Mesa creada."
          : mode === "edit"
            ? "Mesa actualizada."
            : mode === "deactivate"
              ? "Mesa desactivada."
              : "Mesa reactivada."
      );

      onClose();
    } catch (error) {
      if (controller.signal.aborted) return;

      const unavailableSelection =
        mode === "create" &&
        error instanceof ApiError &&
        error.code === "LOCATION_NOT_FOUND";

      if (!unavailableSelection && onError(error)) {
        onClose();
        return;
      }

      const next: Record<string, string> = {};

      if (error instanceof ApiError) {
        for (const issue of error.errors) {
          const field = issue.field.split(".")[0].split("[")[0];

          if (
            ["code", "name", "capacity"].includes(field) ||
            (mode === "create" && field === "locationId")
          ) {
            next[field] ??= issue.message;
          }
        }

        if (error.code === "RESTAURANT_TABLE_CODE_CONFLICT") {
          next.code = tableErrorMessage(error);
        }

        if (
          mode === "create" &&
          [
            "RESTAURANT_TABLE_LOCATION_NOT_AVAILABLE",
            "LOCATION_NOT_POINT_OF_SALE",
            "LOCATION_NOT_FOUND",
          ].includes(error.code)
        ) {
          next.locationId = tableErrorMessage(error);
          setLocationId("");
          await refreshLocations(controller.signal);
        }
      }

      if (controller.signal.aborted) return;

      setErrors(next);
      showMessage(tableErrorMessage(error));
    } finally {
      write.current = null;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  const capacityError = !parsed.success
    ? parsed.error.issues.find(
        (issue) => issue.path[0] === "capacity"
      )?.message
    : undefined;

  return (
    <BottomSheet
      id={dialogId}
      open
      variant="modal"
      title={title}
      className="rt-modal"
      busy={busy}
      onClose={onClose}
    >
      {!loaded ? (
        <div className="rt-modal-body">
          {loadError ? (
            <Alert>
              {loadError}

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setLoadError("");
                  setAttempt((value) => value + 1);
                }}
              >
                Reintentar
              </Button>
            </Alert>
          ) : (
            <p role="status">Cargando información…</p>
          )}
        </div>
      ) : (
        <form
          className="rt-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="rt-modal-body">
            <p>
              {mode === "create"
                ? "Crea una mesa física en un punto de venta."
                : mode === "edit"
                  ? "Actualiza el código, el nombre o la capacidad de la mesa."
                  : mode === "deactivate"
                    ? "La mesa dejará de admitir órdenes nuevas. Sus órdenes existentes y su historial se conservarán."
                    : "La mesa volverá a estar disponible para recibir órdenes en su punto de venta."}
            </p>

            {message && <Alert>{message}</Alert>}

            {isStatus && table ? (
              <>
                {mode === "reactivate" &&
                  !table.location.isActive && (
                    <div className="rt-warning">
                      <TriangleAlert size={16} aria-hidden="true" />
                      <span>
                        La mesa se reactivará, pero no estará
                        disponible para la operación mientras el punto
                        de venta continúe inactivo.
                      </span>
                    </div>
                  )}

                {statusAlreadySet && (
                  <p role="status">
                    {table.isActive
                      ? "La mesa ya está activa."
                      : "La mesa ya está inactiva."}
                  </p>
                )}

                <dl className="rt-summary">
                  <dt>Código</dt>
                  <dd className="rt-code">{table.code}</dd>

                  <dt>Nombre</dt>
                  <dd>{table.name}</dd>

                  <dt>Punto de venta</dt>
                  <dd>
                    {tableLocationLabel(table.location.name)}
                    {" · "}
                    {table.location.code}
                  </dd>

                  <dt>Capacidad</dt>
                  <dd>{tableCapacityLabel(table.capacity)}</dd>
                </dl>
              </>
            ) : (
              <fieldset className="rt-fields" disabled={busy}>
                <legend className="sr-only">Datos de la mesa</legend>

                {mode === "create" ? (
                  <>
                    <SelectField
                      label="Punto de venta"
                      required
                      name="locationId"
                      placeholder="Selecciona un punto de venta"
                      value={locationId}
                      disabled={busy || !!locationsError}
                      error={errors.locationId}
                      options={loaded.locations.map((item) => ({
                        value: item.id,
                        label:
                          tableLocationLabel(item.name) +
                          " · " +
                          item.code,
                      }))}
                      onValueChange={(id) => {
                        setLocationId(id);

                        setErrors((previous) => ({
                          ...previous,
                          locationId: "",
                        }));
                      }}
                    />

                    {!loaded.locations.length && (
                      <p>
                        No hay puntos de venta activos. Crea o activa
                        uno en Sedes y planta.
                      </p>
                    )}

                    {locationsError && (
                      <Alert>
                        {locationsError}

                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void retryLocations()}
                        >
                          Reintentar
                        </Button>
                      </Alert>
                    )}
                  </>
                ) : (
                  table && (
                    <div>
                      <div className="rt-field-label">
                        Punto de venta
                      </div>

                      <div className="rt-location-readonly">
                        <Store size={16} aria-hidden="true" />

                        <strong>
                          {tableLocationLabel(table.location.name)}
                          {" · "}
                          {table.location.code}
                        </strong>

                        {!table.location.isActive && (
                          <span className="rt-location-inactive">
                            Inactiva
                          </span>
                        )}
                      </div>

                      <p className="rt-help">
                        La ubicación de una mesa no puede cambiarse
                        después de crearla. Si la mesa pertenece a
                        otra sede, desactívala y crea una nueva.
                      </p>
                    </div>
                  )
                )}

                <div>
                  <div className="rt-input-pair">
                    <TextField
                      label="Código"
                      name="code"
                      placeholder="MESA-01"
                      required
                      maxLength={30}
                      autoFocus
                      data-dialog-initial-focus
                      value={draft.code}
                      error={errors.code}
                      onChange={(event) =>
                        change("code", event.target.value)
                      }
                    />

                    <TextField
                      label="Nombre"
                      name="name"
                      placeholder="Mesa 1"
                      required
                      maxLength={80}
                      value={draft.name}
                      error={errors.name}
                      onChange={(event) =>
                        change("name", event.target.value)
                      }
                    />
                  </div>

                  <p className="rt-help">
                    El código debe ser único dentro del punto de
                    venta. Otras sedes pueden utilizar el mismo
                    código.
                  </p>
                </div>

                <div className="rt-capacity-field">
                  <TextField
                    label="Capacidad (opcional)"
                    name="capacity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={65535}
                    step={1}
                    placeholder="Sin definir"
                    value={draft.capacity}
                    error={errors.capacity || capacityError}
                    onChange={(event) =>
                      change("capacity", event.target.value)
                    }
                  />
                </div>
              </fieldset>
            )}
          </div>

          <footer className="rt-modal-footer">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              size="sm"
              type="submit"
              disabled={!valid}
              loading={busy}
              loadingText={
                mode === "deactivate"
                  ? "Desactivando…"
                  : mode === "reactivate"
                    ? "Reactivando…"
                    : "Guardando…"
              }
              variant={mode === "deactivate" ? "danger" : "primary"}
              className={mode === "deactivate" ? "rt-danger" : ""}
            >
              {mode === "deactivate" && (
                <Power size={16} aria-hidden="true" />
              )}

              {mode === "reactivate" && (
                <RotateCcw size={16} aria-hidden="true" />
              )}

              {saveLabel}
            </Button>
          </footer>
        </form>
      )}
    </BottomSheet>
  );
}
