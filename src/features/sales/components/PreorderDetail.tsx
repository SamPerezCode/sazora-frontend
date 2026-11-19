import { useCallback, useState } from "react";
import { Eye, MessageCircle } from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { buildWhatsAppUrl } from "../../../lib/whatsapp";

import { OrderRelations } from "./OrderRelations";
import { hasPermission } from "../../auth/utils/permissions";
import { cashDate } from "../../cash/utils/cash-format";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { OrderPrintPanel } from "../../kitchen-flow/OrderPrintPanel";

import { cents, money, type Order } from "../schemas/sales.schema";

import type { SalesResource } from "../hooks/useSales";
import type { SalesScope } from "../services/sales.service";

import { getOrderKitchenHistory } from "../services/sales-history.service";

import {
  readPreorderPayment,
  type PreorderPaymentBatch,
} from "../services/preorder-payments.service";

import { CHANNELS, canEditPreorder } from "../utils/preorders";

import { PaymentBadge } from "./PreorderList";
import { PreorderPaymentDialog } from "./PreorderPaymentDialog";
import { PreorderPaymentDetailDialog } from "./PreorderPaymentDetailDialog";

const STATES = {
  OPEN: "Abierta · sin enviar",
  CONFIRMED: "Confirmada · en cocina",
  DELIVERED: "Entregada · pendiente de cierre",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

const PREPARATION = {
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  IN_PREPARATION: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function PreorderDetail({
  order,
  resource,
  scope,
  onEdit,
  onClose,
}: {
  order: Order;
  resource: SalesResource;
  scope: SalesScope;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { session, settings } = useAppShell();

  const [paymentMode, setPaymentMode] = useState<
    "pay" | "refund" | null
  >(null);

  const [paymentDetail, setPaymentDetail] =
    useState<PreorderPaymentBatch | null>(null);

  const [confirmation, setConfirmation] = useState<
    "cancel" | "deliver" | null
  >(null);

  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");

  const canManage = hasPermission(session, "orders.manage");

  const canReadKitchen = hasPermission(
    session,
    "kitchen.tickets.read"
  );
  const canReadPayment = hasPermission(
    session,
    "orders.payments.read"
  );

  const canPay = hasPermission(session, "orders.payments.manage");

  const canRefund =
    hasPermission(session, "orders.payments.refund") &&
    canReadPayment;

  const canCancel = hasPermission(session, "orders.cancel");

  const zone = settings.data?.timezone ?? "America/Bogota";

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [payment, history] = await Promise.allSettled([
        canReadPayment &&
        order.paymentStatus &&
        order.paymentStatus !== "PENDING"
          ? readPreorderPayment(session, order.id, signal)
          : Promise.resolve(null),

        order.status !== "OPEN" && canReadKitchen
          ? getOrderKitchenHistory(
              session.accessToken,
              scope,
              order.id,
              signal
            )
          : Promise.resolve(null),
      ]);

      const message = (result: PromiseRejectedResult) =>
        result.reason instanceof Error
          ? result.reason.message
          : "No fue posible consultar.";

      return {
        payment:
          payment.status === "fulfilled" ? payment.value : null,

        paymentError:
          payment.status === "rejected" ? message(payment) : "",

        history:
          history.status === "fulfilled" ? history.value : null,

        historyError:
          history.status === "rejected" ? message(history) : "",
      };
    },
    [session, scope, order, canReadPayment, canReadKitchen]
  );

  const related = useCashResource(load);

  const batch = related.data?.payment;
  const history = related.data?.history;

  const terminal =
    order.status === "CLOSED" ||
    order.status === "CANCELLED" ||
    order.paymentStatus === "CONSUMED";

  const pendingPayment = canEditPreorder(order);
  const editable = pendingPayment && canManage;
  const verified = order.paymentStatus === "VERIFIED";
  const refunded = order.paymentStatus === "REFUNDED";

  const pending = Object.values(
    resource.drafts[order.id] ?? {}
  ).reduce((sum, item) => sum + item.quantity, 0);

  const blocked =
    resource.busy ||
    resource.loading ||
    resource.uncertain ||
    !!resource.error ||
    resource.accessLost;

  const cancelling = !!resource.cancellationIds[order.id];

  const hasDelivered =
    !!resource.deliveredIds[order.id] ||
    !!history?.tickets.some((ticket) =>
      ticket.items.some(
        (item) => item.preparationStatus === "DELIVERED"
      )
    );

  const cancellable =
    !terminal &&
    canCancel &&
    (pendingPayment ||
      (refunded &&
        (order.status === "OPEN" ||
          (order.status === "CONFIRMED" &&
            !!history &&
            !hasDelivered))));

  const refundable =
    !terminal && order.status === "OPEN" && verified && canRefund;

  const printable =
    !terminal &&
    (order.status === "CONFIRMED" || order.status === "DELIVERED");

  const directDelivery =
    !terminal &&
    canManage &&
    verified &&
    order.status === "CONFIRMED" &&
    order.kitchenWorkflowMode === "PRINT_ONLY";

  const items = terminal
    ? order.items
    : order.items.filter((item) => item.status === "ACTIVE");

  const whatsapp = buildWhatsAppUrl(
    order.customerPhone,
    "Hola, te contactamos sobre tu pedido #" + order.id + "."
  );

  function update() {
    resource.retry();
    related.reload();
  }

  async function submitConfirmation() {
    if (blocked) return;

    setActionError("");

    if (confirmation === "deliver") {
      if (directDelivery && (await resource.deliver())) {
        setConfirmation(null);
      }

      return;
    }

    if (
      !cancellable ||
      cancelling ||
      (order.status !== "OPEN" && order.status !== "CONFIRMED")
    ) {
      return;
    }

    const clean = reason.trim();

    if (clean.length < 3 || clean.length > 500) {
      setActionError(
        "El motivo debe contener entre 3 y 500 caracteres."
      );
      return;
    }

    const result = await resource.cancelOrder(
      order.id,
      clean,
      order.status
    );

    if (result.ok) {
      setConfirmation(null);
    } else {
      setActionError(
        result.reason ??
          result.message ??
          "Revisa el estado actualizado antes de reintentar."
      );
    }
  }

  return (
    <>
      <div className="preorder-content">
        <p className="sales-price-note">
          {order.location.name}
          {" · "}
          {order.serviceType === "DELIVERY"
            ? "A domicilio"
            : "Para recoger en sitio"}
          {" · "}
          {STATES[order.status]}
        </p>

        <PaymentBadge status={order.paymentStatus} />

        {pendingPayment && (
          <p className="preorder-banner">
            Esta orden debe pagarse antes de enviarse a cocina.
          </p>
        )}

        {verified && order.status === "OPEN" && (
          <p className="preorder-banner" data-warning>
            La orden está bloqueada porque el pago ya fue verificado.
            Para cancelarla debes devolver primero el pago.
          </p>
        )}

        {refunded && (
          <p className="preorder-banner" data-danger>
            {order.status === "CANCELLED"
              ? "El pago fue devuelto y la orden está cancelada."
              : "El pago fue devuelto. No puedes editar ni volver a pagar o confirmar esta orden."}
          </p>
        )}

        {order.status === "CONFIRMED" && !refunded && (
          <p className="preorder-banner">
            Orden confirmada y enviada a cocina.
          </p>
        )}

        {order.status === "DELIVERED" && (
          <p className="preorder-banner">
            Orden entregada. Conserva el pago anticipado registrado;
            no requiere un nuevo cobro.
          </p>
        )}

        {terminal && (
          <p className="preorder-banner">
            Consulta histórica. Esta orden no admite nuevas
            operaciones desde este detalle.
          </p>
        )}

        {resource.notice && <p role="status">{resource.notice}</p>}

        {resource.error && <p role="alert">{resource.error}</p>}

        {resource.uncertain && (
          <div role="alert">
            <p>Hay una operación pendiente de verificar.</p>

            <Button
              variant="secondary"
              disabled={resource.busy}
              onClick={() => void resource.reconcile()}
            >
              Verificar operación
            </Button>

            {resource.uncertainAdditions && (
              <div className="sales-form-actions">
                <Button
                  disabled={resource.busy}
                  onClick={() => void resource.reconcile("applied")}
                >
                  Las adiciones ya aparecen
                </Button>

                <Button
                  disabled={resource.busy}
                  onClick={() =>
                    void resource.reconcile("not-applied")
                  }
                >
                  Las adiciones no se guardaron
                </Button>
              </div>
            )}
          </div>
        )}

        <section className="preorder-customer">
          <small>CLIENTE</small>

          <strong>
            {order.customerName?.trim() || "Cliente ocasional"}
          </strong>

          {order.customerPhone && <p>{order.customerPhone}</p>}

          {order.customerEmail && <p>{order.customerEmail}</p>}

          <small>
            Origen:{" "}
            {order.sourceChannel
              ? CHANNELS[order.sourceChannel]
              : "No informado"}
          </small>

          {order.notes && <p>{order.notes}</p>}

          {whatsapp && !terminal && (
            <a
              className="preorder-contact"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} aria-hidden="true" />
              Contactar por WhatsApp
            </a>
          )}
        </section>

        <div className="mp-card-line">
          <h3>Productos</h3>

          {editable && (
            <Button
              size="sm"
              variant="soft"
              disabled={blocked}
              onClick={onEdit}
            >
              Agregar producto
            </Button>
          )}
        </div>

        <div className="preorder-products">
          {items.map((item) => (
            <article key={item.id}>
              <span>
                {item.quantity} × {item.productName}
                {item.notes && <small>{item.notes}</small>}
                {item.status === "CANCELLED" && (
                  <small>
                    Cancelado
                    {item.cancellationReason
                      ? ": " + item.cancellationReason
                      : ""}
                  </small>
                )}
              </span>

              <strong>{money(cents(item.lineTotal))}</strong>

              {editable && (
                <div className="preorder-quantity">
                  <Button
                    size="icon"
                    variant="soft"
                    aria-label={
                      "Quitar una unidad de " + item.productName
                    }
                    disabled={blocked || item.quantity <= 1}
                    onClick={() =>
                      void resource.action(
                        "/orders/" + order.id + "/items/" + item.id,
                        "PATCH",
                        {
                          quantity: item.quantity - 1,
                          notes: item.notes,
                        }
                      )
                    }
                  >
                    −
                  </Button>

                  <Button
                    size="icon"
                    variant="soft"
                    aria-label={
                      "Agregar una unidad de " + item.productName
                    }
                    disabled={blocked}
                    onClick={() =>
                      void resource.action(
                        "/orders/" + order.id + "/items/" + item.id,
                        "PATCH",
                        {
                          quantity: item.quantity + 1,
                          notes: item.notes,
                        }
                      )
                    }
                  >
                    +
                  </Button>

                  <Button
                    size="sm"
                    variant="soft"
                    aria-label={"Retirar " + item.productName}
                    disabled={blocked}
                    onClick={() =>
                      void resource.action(
                        "/orders/" + order.id + "/items/" + item.id,
                        "DELETE"
                      )
                    }
                  >
                    Quitar
                  </Button>
                </div>
              )}
            </article>
          ))}

          {!items.length && (
            <p className="mp-empty">
              La orden no tiene productos activos.
            </p>
          )}
        </div>

        <dl className="preorder-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(cents(order.subtotal))}</dd>
          </div>

          <div>
            <dt>Impuestos</dt>
            <dd>No desglosados</dd>
          </div>

          <div>
            <dt>Total</dt>
            <dd>
              {order.total
                ? money(cents(order.total))
                : "No disponible"}
            </dd>
          </div>
        </dl>

        {pending > 0 && !terminal && (
          <p role="alert">
            Hay {pending} unidades locales sin guardar.
            {editable
              ? " Edita la orden antes de pagar."
              : " Revisa los cambios pendientes."}
          </p>
        )}

        {canReadPayment &&
          order.paymentStatus &&
          order.paymentStatus !== "PENDING" && (
            <section className="preorder-customer">
              <div className="pp-line">
                <strong>
                  {refunded ? "PAGO DEVUELTO" : "PAGO REGISTRADO"}
                </strong>

                <Button
                  size="sm"
                  variant="soft"
                  disabled={resource.busy || !batch}
                  onClick={() => batch && setPaymentDetail(batch)}
                >
                  <Eye size={15} aria-hidden="true" />
                  Ver detalle del pago
                </Button>
              </div>

              {related.loading && (
                <p role="status">Consultando pago…</p>
              )}

              {related.error && <p role="alert">{related.error}</p>}

              {related.data?.paymentError && (
                <p role="alert">{related.data.paymentError}</p>
              )}

              {batch && (
                <>
                  <p>
                    Total pagado originalmente:{" "}
                    <strong>{money(cents(batch.paidTotal))}</strong>
                  </p>

                  {batch.verifiedAt && (
                    <small>
                      Verificado: {cashDate(batch.verifiedAt, zone)}
                    </small>
                  )}

                  <small>
                    {batch.payments
                      .map(
                        (row) =>
                          row.paymentMethodName +
                          " " +
                          money(cents(row.amount))
                      )
                      .join(" · ")}
                  </small>
                </>
              )}

              {!related.loading &&
                !batch &&
                !related.data?.paymentError && (
                  <p>No hay un lote de pago disponible.</p>
                )}

              {related.data?.paymentError && (
                <Button
                  size="sm"
                  variant="soft"
                  onClick={related.reload}
                >
                  Reintentar consulta
                </Button>
              )}
            </section>
          )}

        {order.status !== "OPEN" && (
          <section className="preorder-customer">
            <strong>Seguimiento de preparación</strong>

            {related.loading && (
              <p role="status">Consultando preparación…</p>
            )}

            {related.data?.historyError && (
              <p role="alert">{related.data.historyError}</p>
            )}

            {history?.tickets.map((ticket) => (
              <div className="preorder-ticket" key={ticket.id}>
                <strong>
                  {ticket.preparationAreaName}
                  {" · "}
                  {PREPARATION[ticket.status]}
                </strong>

                {ticket.items.map((item) => (
                  <div className="pp-line" key={item.id}>
                    <span>
                      {item.quantity} × {item.productName}
                    </span>

                    <small>
                      {PREPARATION[item.preparationStatus]}
                    </small>
                  </div>
                ))}
              </div>
            ))}

            {history && !history.tickets.length && (
              <p>No hay comandas disponibles para esta orden.</p>
            )}

            {related.data?.historyError && (
              <Button
                size="sm"
                variant="soft"
                onClick={related.reload}
              >
                Reintentar seguimiento
              </Button>
            )}
          </section>
        )}

        {printable && (
          <OrderPrintPanel
            orderId={order.id}
            printing={resource.printing}
            disabled={blocked}
          />
        )}
      </div>

      <footer className="preorder-footer">
        <strong>
          Total{" "}
          {order.total ? money(cents(order.total)) : "por consultar"}
        </strong>

        <div className="sales-form-actions">
          <Button
            variant="secondary"
            disabled={resource.busy}
            onClick={onClose}
          >
            Cerrar
          </Button>

          <Button
            variant="secondary"
            disabled={resource.busy}
            onClick={update}
          >
            Actualizar orden
          </Button>

          {!blocked && <OrderRelations order={order} />}

          {editable && (
            <Button
              variant="soft"
              disabled={blocked}
              onClick={onEdit}
            >
              Editar orden
            </Button>
          )}

          {pendingPayment && canManage && (
            <Button variant="soft" disabled>
              Confirmar y enviar a cocina
            </Button>
          )}

          {pendingPayment && canPay && (
            <Button
              disabled={
                blocked ||
                pending > 0 ||
                !items.length ||
                !order.total
              }
              onClick={() => setPaymentMode("pay")}
            >
              Registrar y verificar pago
            </Button>
          )}

          {refundable && (
            <Button
              variant="soft"
              disabled={blocked}
              onClick={() => setPaymentMode("refund")}
            >
              Devolver pago
            </Button>
          )}

          {order.status === "OPEN" && verified && canManage && (
            <Button
              disabled={blocked || pending > 0 || cancelling}
              loading={resource.sending}
              onClick={() => void resource.retryConfirmation()}
            >
              Confirmar y enviar a cocina
            </Button>
          )}

          {cancellable && (
            <Button
              variant="danger"
              disabled={blocked || cancelling}
              onClick={() => {
                setReason("");
                setActionError("");
                setConfirmation("cancel");
              }}
            >
              Cancelar orden
            </Button>
          )}

          {cancelling && canCancel && (
            <Button
              variant="secondary"
              disabled={resource.busy}
              onClick={() => void resource.verifyCancellation()}
            >
              Verificar cancelación
            </Button>
          )}

          {directDelivery && (
            <Button
              disabled={blocked || pending > 0}
              onClick={() => setConfirmation("deliver")}
            >
              Marcar entregado
            </Button>
          )}
        </div>

        {refunded && order.status === "CONFIRMED" && hasDelivered && (
          <p role="alert">
            La orden tiene productos entregados y no puede cancelarse
            completamente.
          </p>
        )}
      </footer>

      {paymentMode && (
        <PreorderPaymentDialog
          key={order.id + ":" + paymentMode}
          mode={paymentMode}
          order={order}
          scope={scope}
          resource={resource}
          onClose={() => {
            setPaymentMode(null);
            related.reload();
          }}
        />
      )}

      {paymentDetail && canReadPayment && batch && (
        <PreorderPaymentDetailDialog
          orderId={order.id}
          batch={batch}
          timeZone={zone}
          busy={resource.busy}
          onClose={() => setPaymentDetail(null)}
          onRefund={
            refundable && !blocked
              ? () => {
                  setPaymentDetail(null);
                  setPaymentMode("refund");
                }
              : undefined
          }
        />
      )}

      {confirmation && (
        <BottomSheet
          id={"preorder-confirm-" + order.id}
          open
          variant="modal"
          className="mp-dialog app-confirm-dialog"
          title={
            confirmation === "cancel"
              ? "¿Cancelar la orden #" + order.id + "?"
              : "¿Marcar el pedido como entregado?"
          }
          busy={resource.busy}
          onClose={() => setConfirmation(null)}
        >
          <div className="mp-dialog-content">
            <p>
              {confirmation === "deliver"
                ? "Confirma que todos los productos de esta orden fueron entregados."
                : refunded
                  ? "El pago ya fue devuelto. La orden se cancelará completamente."
                  : "La orden no tiene pagos registrados y se cancelará completamente."}
            </p>

            {confirmation === "cancel" && (
              <label className="sales-label">
                Motivo de cancelación
                <textarea
                  value={reason}
                  minLength={3}
                  maxLength={500}
                  required
                  disabled={resource.busy}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            )}

            {actionError && <p role="alert">{actionError}</p>}

            {resource.notice && (
              <p role="status">{resource.notice}</p>
            )}

            {resource.error && <p role="alert">{resource.error}</p>}

            {cancelling && (
              <Button
                disabled={resource.busy}
                onClick={() => void resource.verifyCancellation()}
              >
                Verificar cancelación
              </Button>
            )}

            <div className="sales-form-actions">
              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={() => setConfirmation(null)}
              >
                Volver
              </Button>

              <Button
                variant={
                  confirmation === "cancel" ? "danger" : "primary"
                }
                loading={resource.busy}
                disabled={
                  blocked ||
                  (confirmation === "cancel"
                    ? !cancellable ||
                      cancelling ||
                      reason.trim().length < 3
                    : !directDelivery)
                }
                onClick={() => void submitConfirmation()}
              >
                {confirmation === "cancel"
                  ? "Cancelar orden"
                  : "Confirmar entrega"}
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
