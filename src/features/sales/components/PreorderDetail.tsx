import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { hasPermission } from "../../auth/utils/permissions";

import { Button } from "../../../components/ui/Button";
import { cashDate } from "../../cash/utils/cash-format";
import { useCashResource } from "../../cash/hooks/useCashResource";

import type { Order } from "../schemas/sales.schema";
import { cents, money } from "../schemas/sales.schema";
import type { SalesResource } from "../hooks/useSales";
import type { SalesScope } from "../services/sales.service";

import { readPreorderPayment } from "../services/preorder-payments.service";
import { CHANNELS, canEditPreorder } from "../utils/preorders";

import { PaymentBadge } from "./PreorderList";
import { PreorderPaymentDialog } from "./PreorderPaymentDialog";
import { OrderCancellationActions } from "./OrderCancellationActions";
import { OrderPrintPanel } from "../../kitchen-flow/OrderPrintPanel";
import { Eye } from "lucide-react";
import { PreorderPaymentDetailDialog } from "./PreorderPaymentDetailDialog";

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
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);

  const [paymentMode, setPaymentMode] = useState<
    "pay" | "refund" | null
  >(null);

  const canRead = hasPermission(session, "orders.payments.read");

  const load = useCallback(
    (signal: AbortSignal) =>
      canRead &&
      order.paymentStatus &&
      order.paymentStatus !== "PENDING"
        ? readPreorderPayment(session, order.id, signal)
        : Promise.resolve(null),
    [session, canRead, order.id, order.paymentStatus]
  );

  const payment = useCashResource(load);

  const pending = Object.values(
    resource.drafts[order.id] ?? {}
  ).reduce((sum, item) => sum + item.quantity, 0);

  const blocked =
    resource.busy ||
    resource.uncertain ||
    !!resource.error ||
    resource.loading ||
    resource.accessLost;

  const editable = canEditPreorder(order);
  const verified = order.paymentStatus === "VERIFIED";
  const refunded = order.paymentStatus === "REFUNDED";

  const cancellable =
    ["OPEN", "CONFIRMED"].includes(order.status) &&
    (order.paymentStatus === "PENDING" || refunded);

  const canPay = hasPermission(session, "orders.payments.manage");

  const canRefund =
    hasPermission(session, "orders.payments.refund") && canRead;

  const items = order.items.filter(
    (item) => item.status === "ACTIVE"
  );

  const hasDelivered =
    resource.data?.tickets.some(
      (ticket) =>
        ticket.orderId === order.id &&
        ticket.items.some(
          (item) => item.preparationStatus === "DELIVERED"
        )
    ) ?? false;

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
          {order.status === "OPEN"
            ? "Abierta · sin enviar"
            : order.status === "CONFIRMED"
              ? "En cocina"
              : order.status === "CANCELLED"
                ? "Cancelada"
                : order.status === "CLOSED"
                  ? "Cerrada"
                  : "Entregada"}
        </p>

        <div>
          <PaymentBadge status={order.paymentStatus} />
        </div>

        {order.paymentVerifiedAt && (
          <small>
            Verificado:{" "}
            {cashDate(
              order.paymentVerifiedAt,
              settings.data?.timezone ?? "America/Bogota"
            )}
          </small>
        )}

        {editable && (
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
            El pago fue devuelto. La orden ya no puede editarse ni
            enviarse a cocina; solo puede cancelarse completamente.
          </p>
        )}

        {verified && order.status === "CONFIRMED" && (
          <p className="preorder-banner">
            Orden confirmada y enviada a cocina.
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
              <>
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
              </>
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
              </span>

              <strong>{money(cents(item.lineTotal))}</strong>

              {editable && (
                <div className="preorder-quantity">
                  <Button
                    size="icon"
                    variant="soft"
                    aria-label={`Quitar una unidad de ${item.productName}`}
                    disabled={blocked || item.quantity <= 1}
                    onClick={() =>
                      void resource.action(
                        `/orders/${order.id}/items/${item.id}`,
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
                    aria-label={`Agregar una unidad de ${item.productName}`}
                    disabled={blocked}
                    onClick={() =>
                      void resource.action(
                        `/orders/${order.id}/items/${item.id}`,
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
                    aria-label={`Retirar ${item.productName}`}
                    disabled={blocked}
                    onClick={() =>
                      void resource.action(
                        `/orders/${order.id}/items/${item.id}`,
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
            <dt>Total</dt>
            <dd>
              {order.total
                ? money(cents(order.total))
                : "No disponible"}
            </dd>
          </div>
        </dl>

        {pending > 0 && (
          <p role="alert">
            Hay {pending} unidades locales sin guardar. Edita la orden
            antes de pagar.
          </p>
        )}

        {canRead && order.paymentStatus !== "PENDING" && (
          <section className="preorder-customer">
            <div className="pp-line">
              <strong>
                {refunded ? "PAGO DEVUELTO" : "PAGO REGISTRADO"}
              </strong>

              <Button
                size="sm"
                variant="soft"
                disabled={resource.busy || !payment.data}
                onClick={() => setShowPaymentDetail(true)}
              >
                <Eye size={15} aria-hidden="true" />
                Ver detalle del pago
              </Button>
            </div>

            {payment.loading && (
              <p role="status">Consultando pago…</p>
            )}

            {payment.error && <p role="alert">{payment.error}</p>}

            {payment.data && (
              <>
                <p>
                  Verificado{" "}
                  {cashDate(
                    payment.data.verifiedAt,
                    settings.data?.timezone ?? "America/Bogota"
                  )}
                  {" · "}Total pagado originalmente{" "}
                  <strong>
                    {money(cents(payment.data.paidTotal))}
                  </strong>
                </p>

                <small>
                  {payment.data.payments
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

            {payment.data === null && (
              <p>No hay un lote de pago disponible.</p>
            )}

            {payment.error && (
              <Button
                size="sm"
                variant="soft"
                onClick={payment.reload}
              >
                Reintentar consulta
              </Button>
            )}
          </section>
        )}

        {order.status !== "OPEN" && (
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
            onClick={resource.retry}
          >
            Actualizar orden
          </Button>

          {editable && (
            <Button
              variant="soft"
              disabled={blocked}
              onClick={onEdit}
            >
              Editar orden
            </Button>
          )}

          {editable && (
            <Button variant="soft" disabled>
              Enviar a cocina
            </Button>
          )}

          {editable && canPay && (
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

          {verified && canRefund && (
            <Button
              variant="soft"
              disabled={blocked}
              onClick={() => setPaymentMode("refund")}
            >
              Devolver pago
            </Button>
          )}

          {verified && order.status === "CONFIRMED" && (
            <Button
              variant="soft"
              disabled={blocked}
              onClick={onEdit}
            >
              Ver preparación y entrega
            </Button>
          )}

          {verified && order.status === "OPEN" && (
            <Button
              disabled={blocked || pending > 0}
              loading={resource.sending}
              onClick={() => void resource.retryConfirmation()}
            >
              Confirmar y enviar a cocina
            </Button>
          )}
        </div>

        {cancellable && (
          <OrderCancellationActions
            resource={resource}
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            pendingCount={pending}
            hasDelivered={hasDelivered}
          />
        )}
      </footer>

      {showPaymentDetail && canRead && payment.data && (
        <PreorderPaymentDetailDialog
          orderId={order.id}
          batch={payment.data}
          timeZone={settings.data?.timezone ?? "America/Bogota"}
          busy={resource.busy}
          onClose={() => setShowPaymentDetail(false)}
          onRefund={
            verified && canRefund && !blocked
              ? () => {
                  setShowPaymentDetail(false);
                  setPaymentMode("refund");
                }
              : undefined
          }
        />
      )}

      {paymentMode && (
        <PreorderPaymentDialog
          mode={paymentMode}
          order={order}
          scope={scope}
          resource={resource}
          onClose={() => {
            setPaymentMode(null);
            payment.reload();
          }}
        />
      )}
    </>
  );
}
