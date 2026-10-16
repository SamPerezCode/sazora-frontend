import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { ChevronDown, Copy, Eye, Printer } from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { ApiError } from "../../../lib/http/client";
import { useTimedMessage } from "../../../hooks/useTimedMessage";

import { Alert } from "../../../components/feedback/Alert";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { KitchenPrintPreview } from "../../kitchen-flow/KitchenPrintPreview";

import {
  printDate,
  reprintInputSchema,
} from "../../kitchen-flow/kitchen-flow.schema";

import { createKitchenPrintApi } from "../../kitchen-flow/kitchen-flow.service";

import {
  cents,
  money,
  SERVICE_LABELS,
} from "../schemas/sales.schema";

import type { OrderSummary } from "../schemas/sales.schema";
import type { SalesScope } from "../services/sales.service";

import {
  getHistoricalOrder,
  getOrderKitchenHistory,
  groupTicketVersions,
  historyErrorMessage,
  kitchenHistorySummary,
} from "../services/sales-history.service";

import type {
  HistoricalOrder,
  HistoricalPrint,
  HistoricalTicket,
  OrderKitchenHistory,
} from "../services/sales-history.service";

import { OrderStatusBadge } from "./OrderStatusBadge";

import "../sales-history-detail.css";

interface Props {
  row: OrderSummary;
  token: string;
  scope: SalesScope;
  onClose: () => void;
  onLocationLost: (message: string) => void;
}

interface DetailState {
  loading: boolean;
  order: HistoricalOrder | null;
  error: string;
  history: OrderKitchenHistory | null;
  historyLoading: boolean;
  historyError: string;
}

const emptyState: DetailState = {
  loading: true,
  order: null,
  error: "",
  history: null,
  historyLoading: true,
  historyError: "",
};

const preparationLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PREPARATION: "En preparación",
  PREPARING: "En preparación",
  READY: "Listo para entregar",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const printLabels = {
  INITIAL: "Envío inicial",
  MODIFICATION: "Modificación",
  REPRINT: "Reimpresión",
};

function quantityLabel(
  value: number,
  singular: string,
  plural: string
) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function HistoryOrderDetail(props: Props) {
  return (
    <HistoryDetailContent
      key={[
        props.scope.businessId,
        props.scope.location.id,
        props.row.id,
        props.token,
      ].join(":")}
      {...props}
    />
  );
}

function HistoryDetailContent({
  row,
  token,
  scope,
  onClose,
  onLocationLost,
}: Props) {
  const id = useId();
  const { session } = useAppShell();

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>(emptyState);

  const reader = useRef<AbortController | null>(null);
  const historyLock = useRef(false);

  const canReprint = session.authorization.roles.some((role) =>
    ["ADMIN", "WAITER", "KITCHEN"].includes(role)
  );

  const reportAccess = useCallback(
    (cause: unknown) => {
      if (
        cause instanceof ApiError &&
        cause.code === "LOCATION_ACCESS_DENIED"
      ) {
        onLocationLost(historyErrorMessage(cause));
      }
    },
    [onLocationLost]
  );

  useEffect(() => {
    const controller = new AbortController();
    reader.current = controller;

    // El temporizador evita duplicar las consultas durante la
    // comprobación inicial de efectos de React StrictMode.
    const timer = window.setTimeout(() => {
      async function load() {
        const [orderResult, historyResult] = await Promise.allSettled(
          [
            getHistoricalOrder(
              token,
              scope,
              row.id,
              controller.signal
            ),
            getOrderKitchenHistory(
              token,
              scope,
              row.id,
              controller.signal
            ),
          ]
        );

        if (controller.signal.aborted) return;

        if (orderResult.status === "rejected") {
          reportAccess(orderResult.reason);
        }

        if (historyResult.status === "rejected") {
          reportAccess(historyResult.reason);
        }

        const order =
          orderResult.status === "fulfilled"
            ? orderResult.value
            : null;

        const history =
          historyResult.status === "fulfilled"
            ? historyResult.value
            : null;

        if (
          import.meta.env.DEV &&
          order?.status === "OPEN" &&
          history?.tickets.length
        ) {
          console.warn("Orden OPEN con comandas en el historial.", {
            orderId: order.id,
          });
        }

        setState({
          loading: false,
          order,
          error:
            orderResult.status === "rejected"
              ? historyErrorMessage(orderResult.reason)
              : "",
          history,
          historyLoading: false,
          historyError:
            historyResult.status === "rejected"
              ? historyErrorMessage(historyResult.reason)
              : "",
        });
      }

      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [token, scope, row.id, attempt, reportAccess]);

  async function reloadHistory(): Promise<boolean> {
    const controller = reader.current;

    if (
      !controller ||
      controller.signal.aborted ||
      historyLock.current
    ) {
      return false;
    }

    historyLock.current = true;

    setState((previous) => ({
      ...previous,
      historyLoading: true,
      historyError: "",
    }));

    try {
      const history = await getOrderKitchenHistory(
        token,
        scope,
        row.id,
        controller.signal
      );

      if (controller.signal.aborted) return false;

      setState((previous) => ({
        ...previous,
        history,
        historyLoading: false,
        historyError: "",
      }));

      return true;
    } catch (cause) {
      if (controller.signal.aborted) return false;

      reportAccess(cause);

      setState((previous) => ({
        ...previous,
        historyLoading: false,
        historyError: historyErrorMessage(cause),
      }));

      return false;
    } finally {
      historyLock.current = false;
    }
  }

  const order = state.order;

  const tableName =
    order?.restaurantTableName ??
    (order?.restaurantTableId === row.restaurantTableId
      ? row.restaurantTableName
      : null);

  const service = order
    ? order.serviceType === "TABLE"
      ? (tableName ?? "Mesa")
      : SERVICE_LABELS[order.serviceType]
    : SERVICE_LABELS[row.serviceType];

  const dates = order
    ? [
        ["Confirmación", order.confirmedAt],
        ["Entrega", order.deliveredAt],
        ["Cierre", order.closedAt],
        ["Cancelación", order.cancelledAt],
      ]
    : [];

  const inconsistent =
    order?.status === "OPEN" && !!state.history?.tickets.length;

  function itemStatus(item: HistoricalOrder["items"][number]) {
    if (item.status === "CANCELLED") return "Cancelado";
    if (!order || order.status === "OPEN") return "Sin enviar";

    const ticketItem = state.history?.tickets
      .flatMap((ticket) => ticket.items)
      .find((entry) => entry.orderItemId === item.id);

    if (
      order.kitchenWorkflowMode === "PRINT_AND_SCREEN" &&
      ticketItem
    ) {
      return (
        preparationLabels[ticketItem.preparationStatus] ??
        "Preparación no disponible"
      );
    }

    if (order.status === "CONFIRMED") return "Confirmado";

    return "Activo";
  }

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title={`Orden #${row.id}`}
      className="hd-dialog"
      onClose={onClose}
    >
      {state.loading ? (
        <div className="hd-loading" role="status">
          Cargando detalle de la orden…
        </div>
      ) : !order ? (
        <div className="hd-loading">
          <Alert>{state.error}</Alert>

          <div className="kf-actions">
            <Button variant="soft" onClick={onClose}>
              Volver al historial
            </Button>

            <Button
              onClick={() => {
                setState(emptyState);
                setAttempt((value) => value + 1);
              }}
            >
              Reintentar consulta
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="hd-subtitle">
            {service} · {order.location.name} ·{" "}
            {printDate(order.createdAt)}
          </p>

          <div className="hd-body">
            <section
              className="hd-main"
              aria-label="Detalle de la orden"
            >
              <dl className="hd-meta">
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <OrderStatusBadge status={order.status} />
                  </dd>
                </div>

                <div>
                  <dt>Modalidad</dt>
                  <dd>{service}</dd>
                </div>

                <div>
                  <dt>Punto de venta</dt>
                  <dd>{order.location.code}</dd>
                </div>

                <div>
                  <dt>Clientes</dt>
                  <dd>{order.customerCount ?? "No registrado"}</dd>
                </div>
              </dl>

              {inconsistent && (
                <Alert>
                  El servidor informa que esta orden está sin enviar,
                  pero también devuelve comandas. Mostramos los datos
                  recibidos; revisa esta inconsistencia antes de
                  realizar una reimpresión.
                </Alert>
              )}

              <div className="hd-products">
                <table className="ui-data-table">
                  <caption className="sr-only">
                    Productos de la orden {order.id}
                  </caption>

                  <colgroup>
                    <col style={{ width: "43%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "23%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Cant.</th>
                      <th scope="col">Precio</th>
                      <th scope="col">Importe</th>
                    </tr>
                  </thead>

                  <tbody>
                    {order.items.map((item) => (
                      <tr
                        key={item.id}
                        data-cancelled={item.status === "CANCELLED"}
                      >
                        <td>
                          <span className="hd-product-name">
                            {item.productName}
                          </span>

                          <small>Estado: {itemStatus(item)}</small>

                          {item.notes && (
                            <small>Nota: {item.notes}</small>
                          )}

                          {item.status === "CANCELLED" && (
                            <small>
                              {quantityLabel(
                                item.quantity,
                                "unidad cancelada",
                                "unidades canceladas"
                              )}
                            </small>
                          )}

                          {item.cancellationReason && (
                            <small>
                              Motivo: {item.cancellationReason}
                            </small>
                          )}
                        </td>

                        <td>{item.quantity} ×</td>
                        <td>{money(cents(item.unitPrice))}</td>
                        <td>
                          <strong>
                            {money(cents(item.lineTotal))}
                          </strong>
                        </td>
                      </tr>
                    ))}

                    {!order.items.length && (
                      <tr>
                        <td colSpan={4}>
                          Esta orden no tiene productos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={3}>
                        Subtotal
                      </th>
                      <td>
                        <strong>
                          {money(cents(order.subtotal))}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="hd-muted">Sin información de pago</p>

              {order.notes && (
                <div className="hd-note">
                  <strong>Notas de la orden</strong>
                  <p>{order.notes}</p>
                </div>
              )}

              {dates.some(([, value]) => !!value) && (
                <dl className="hd-dates">
                  {dates.map(([label, value]) =>
                    value ? (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{printDate(value)}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
              )}

              <p className="hd-muted">
                {canReprint
                  ? "La información de la orden no puede modificarse. Las comandas pueden reimprimirse con autorización."
                  : "Consulta en modo de lectura."}
              </p>
            </section>

            <HistoricalPrints
              order={order}
              token={token}
              scope={scope}
              history={state.history}
              loading={state.historyLoading}
              error={state.historyError}
              canReprint={canReprint && !inconsistent}
              reload={reloadHistory}
              onLocationLost={onLocationLost}
            />
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function HistoricalPrints({
  order,
  token,
  scope,
  history,
  loading,
  error,
  canReprint,
  reload,
  onLocationLost,
}: {
  order: HistoricalOrder;
  token: string;
  scope: SalesScope;
  history: OrderKitchenHistory | null;
  loading: boolean;
  error: string;
  canReprint: boolean;
  reload: () => Promise<boolean>;
  onLocationLost: (message: string) => void;
}) {
  const id = useId();

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<HistoricalPrint | null>(
    null
  );
  const [copy, setCopy] = useState<{
    ticket: HistoricalTicket;
    print: HistoricalPrint;
  } | null>(null);

  const [notice, setNotice] = useTimedMessage(6000);

  const summary = history ? kitchenHistorySummary(history) : null;
  const unavailable = loading || !!error;

  function actions(ticket: HistoricalTicket, print: HistoricalPrint) {
    return (
      <div className="kf-actions">
        <Button
          variant="soft"
          size="compact"
          onClick={() => setPreview(print)}
        >
          <Eye size={16} aria-hidden="true" />
          Ver
        </Button>

        {canReprint && print.contentSnapshot && (
          <Button
            variant="soft"
            size="compact"
            disabled={unavailable}
            onClick={() => setCopy({ ticket, print })}
          >
            <Copy size={16} aria-hidden="true" />
            Reimprimir
          </Button>
        )}
      </div>
    );
  }

  return (
    <aside className="hd-kitchen">
      <button
        type="button"
        className="hd-kitchen-toggle"
        aria-expanded={open}
        aria-controls={`${id}-content`}
        onClick={() => setOpen((value) => !value)}
      >
        <Printer size={19} aria-hidden="true" />

        <span>
          <strong>Comandas e impresiones</strong>

          {loading ? (
            <small>Consultando comandas…</small>
          ) : error ? (
            <small>No fue posible consultar las comandas.</small>
          ) : summary?.areas ? (
            <>
              <small>
                {quantityLabel(summary.areas, "área", "áreas")} ·{" "}
                {quantityLabel(
                  summary.versions,
                  "versión",
                  "versiones"
                )}
              </small>
              <small>
                {quantityLabel(
                  summary.printedAreas,
                  "área impresa",
                  "áreas impresas"
                )}{" "}
                ·{" "}
                {quantityLabel(
                  summary.pendingAreas,
                  "pendiente",
                  "pendientes"
                )}
              </small>
            </>
          ) : (
            <small>Sin comandas registradas</small>
          )}
        </span>

        <ChevronDown size={17} aria-hidden="true" />
      </button>

      <div id={`${id}-content`} hidden={!open}>
        {error ? (
          <Alert>
            <p>No fue posible cargar las comandas de esta orden.</p>
            <p>{error}</p>
            <Button
              variant="soft"
              size="compact"
              disabled={loading}
              onClick={() => void reload()}
            >
              Reintentar consulta
            </Button>
          </Alert>
        ) : loading ? (
          <p role="status">Cargando historial de comandas…</p>
        ) : !history?.tickets.length ? (
          <p className="hd-muted">
            No se generaron comandas para esta orden.
          </p>
        ) : (
          history.tickets.map((ticket) => (
            <section className="hd-area" key={ticket.id}>
              <h3>{ticket.preparationAreaName}</h3>

              {groupTicketVersions(ticket).map((group) => (
                <article className="hd-version" key={group.version}>
                  <div className="hd-version-heading">
                    <strong>Versión {group.version}</strong>

                    {group.original ? (
                      <span
                        className="kf-print-badge"
                        data-status="SENT"
                      >
                        Enviada a impresión
                      </span>
                    ) : group.version === ticket.currentVersion ? (
                      <span
                        className="kf-print-badge"
                        data-status="PENDING"
                      >
                        Pendiente de impresión
                      </span>
                    ) : null}
                  </div>

                  {group.original ? (
                    <>
                      <p className="hd-muted">
                        {printDate(group.original.createdAt)} ·{" "}
                        {printLabels[group.original.printType]}
                      </p>

                      {group.original.printerName && (
                        <p className="hd-muted">
                          Impresora: {group.original.printerName}
                        </p>
                      )}

                      {group.original.reason && (
                        <p className="hd-muted">
                          Motivo: {group.original.reason}
                        </p>
                      )}

                      {actions(ticket, group.original)}
                    </>
                  ) : (
                    <p className="hd-muted">
                      {order.status === "CONFIRMED" &&
                      group.version === ticket.currentVersion
                        ? "La impresión de esta versión se gestiona desde la cuenta en Mesas y pedidos."
                        : "No se registró impresión para esta versión."}
                    </p>
                  )}

                  {group.copies.length > 0 && (
                    <details className="hd-copies">
                      <summary>
                        {quantityLabel(
                          group.copies.length,
                          "reimpresión",
                          "reimpresiones"
                        )}
                      </summary>

                      {group.copies.map((print) => (
                        <div className="hd-copy" key={print.id}>
                          <strong>Reimpresión</strong>
                          <p className="hd-muted">
                            {printDate(print.createdAt)}
                          </p>

                          {print.reason && (
                            <p className="hd-muted">
                              Motivo: {print.reason}
                            </p>
                          )}

                          {print.printerName && (
                            <p className="hd-muted">
                              Impresora: {print.printerName}
                            </p>
                          )}

                          {actions(ticket, print)}
                        </div>
                      ))}
                    </details>
                  )}
                </article>
              ))}
            </section>
          ))
        )}
      </div>

      {notice && (
        <p className="hd-notice" role="status">
          {notice}
        </p>
      )}

      {preview && (
        <KitchenPrintPreview
          print={preview}
          onClose={() => setPreview(null)}
        />
      )}

      {copy && (
        <HistoricalReprintDialog
          token={token}
          scope={scope}
          orderId={order.id}
          ticket={copy.ticket}
          print={copy.print}
          onClose={() => setCopy(null)}
          onLocationLost={onLocationLost}
          onSaved={() => {
            setCopy(null);
            setNotice("Reimpresión enviada correctamente.");
            void reload();
          }}
          onReview={() => {
            setCopy(null);
            setNotice(
              "Consulta los registros antes de solicitar otra copia."
            );
            void reload();
          }}
        />
      )}
    </aside>
  );
}

function HistoricalReprintDialog({
  token,
  scope,
  orderId,
  ticket,
  print,
  onClose,
  onSaved,
  onReview,
  onLocationLost,
}: {
  token: string;
  scope: SalesScope;
  orderId: string;
  ticket: HistoricalTicket;
  print: HistoricalPrint;
  onClose: () => void;
  onSaved: () => void;
  onReview: () => void;
  onLocationLost: (message: string) => void;
}) {
  const id = useId();
  const locked = useRef(false);
  const mounted = useRef(false);

  const [reason, setReason] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit() {
    if (locked.current || uncertain || !print.contentSnapshot) return;

    const parsed = reprintInputSchema.safeParse({
      reason,
      printerName: printerName.trim() || null,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    locked.current = true;
    setBusy(true);
    setError("");

    try {
      const api = createKitchenPrintApi(token, scope);

      const result = await api.reprint(
        {
          id: ticket.id,
          orderId,
          preparationAreaId: ticket.preparationAreaId,
          preparationAreaName: ticket.preparationAreaName,
          currentVersion: ticket.currentVersion,
        },
        {
          ...print,
          contentSnapshot: print.contentSnapshot,
        },
        parsed.data.reason,
        parsed.data.printerName
      );

      if (
        result.printType !== "REPRINT" ||
        result.ticketVersion !== print.ticketVersion
      ) {
        throw new ApiError(
          502,
          "INVALID_RESPONSE",
          "Debemos verificar la copia registrada antes de solicitar otra."
        );
      }

      if (mounted.current) onSaved();
    } catch (cause) {
      if (!mounted.current) return;

      if (
        cause instanceof ApiError &&
        cause.code === "LOCATION_ACCESS_DENIED"
      ) {
        onLocationLost(historyErrorMessage(cause));
      }

      setError(historyErrorMessage(cause));
      setUncertain(
        !(cause instanceof ApiError) ||
          cause.status === 0 ||
          cause.status >= 500
      );
    } finally {
      locked.current = false;

      if (mounted.current) setBusy(false);
    }
  }

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title="Reimprimir comanda"
      className="kf-dialog"
      busy={busy}
      onClose={onClose}
    >
      <form
        className="kf-dialog-content"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p>
          Orden #{orderId} ·{" "}
          {print.contentSnapshot?.preparationAreaName ??
            ticket.preparationAreaName}{" "}
          · Versión {print.ticketVersion}
        </p>

        <label className="kf-field">
          Motivo de la reimpresión
          <textarea
            required
            maxLength={500}
            value={reason}
            disabled={busy || uncertain}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <label className="kf-field">
          Impresora — opcional
          <input
            maxLength={150}
            value={printerName}
            disabled={busy || uncertain}
            onChange={(event) => setPrinterName(event.target.value)}
          />
        </label>

        {error && <Alert>{error}</Alert>}

        {uncertain && (
          <p role="status">
            El resultado no pudo verificarse. Consulta el historial
            antes de solicitar otra copia.
          </p>
        )}

        <div className="kf-actions">
          <Button variant="soft" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>

          {uncertain ? (
            <Button onClick={onReview}>Consultar historial</Button>
          ) : (
            <Button
              type="submit"
              loading={busy}
              loadingText="Reimprimiendo…"
              disabled={!reason.trim()}
            >
              Reimprimir comanda
            </Button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
