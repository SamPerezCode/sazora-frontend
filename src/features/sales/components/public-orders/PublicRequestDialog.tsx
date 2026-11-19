import { useMemo, useState } from "react";
import { Link } from "react-router";
import { MessageCircle } from "lucide-react";

import { BottomSheet } from "../../../../components/layout/BottomSheet";
import { Button } from "../../../../components/ui/Button";
import { TextAreaField } from "../../../../components/forms/TextAreaField";
import { buildWhatsAppUrl } from "../../../../lib/whatsapp";

import {
  hasEveryPermission,
  hasPermission,
} from "../../../auth/utils/permissions";

import { cashDate } from "../../../cash/utils/cash-format";

import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { usePublicRequestOrder } from "../../hooks/usePublicRequestOrder";

import { PreorderPaymentDialog } from "../PreorderPaymentDialog";
import { PreorderPaymentDetailDialog } from "../PreorderPaymentDetailDialog";
import { PaymentBadge } from "../PreorderList";

import { PublicRequestNotes } from "./PublicRequestNotes";

import {
  Address,
  Badge,
  External,
  Items,
  Service,
} from "./PublicOrderShared";

import "../../preorders.css";

type Modal =
  | "accept"
  | "reject"
  | "pay"
  | "refund"
  | "payment"
  | "cancel"
  | null;

const preparationLabels: Record<string, string> = {
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  IN_PREPARATION: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function RequestDialog({
  id,
  close,
  saved,
}: {
  id: string;
  close: () => void;
  saved: (message: string) => void;
}) {
  const { session, business, date, price, zone } = usePresentation();

  const [modal, setModal] = useState<Modal>(null);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");

  const resource = usePublicRequestOrder(id, modal !== null, saved);

  const row = resource.data?.request;
  const order = resource.data?.order;
  const payment = resource.data?.payment;

  const orderId = order?.id ?? row?.orderId ?? resource.createdId;

  const scope = useMemo(
    () =>
      order
        ? {
            businessId: session.business.id,
            location: order.location,
          }
        : null,
    [order, session.business.id]
  );

  const blocked =
    resource.busy || resource.loading || !!resource.error;

  const has = (permission: string) =>
    hasPermission(session, permission);

  const manageable =
    !!row &&
    !orderId &&
    row.status !== "ACCEPTED" &&
    ["NEW", "CONTACTED"].includes(row.status) &&
    has("public_orders.manage");

  const open = order?.status === "OPEN";

  const pending = open && order.paymentStatus === "PENDING";

  const verified = open && order.paymentStatus === "VERIFIED";

  const refunded = order?.paymentStatus === "REFUNDED";

  const cancelled = order?.status === "CANCELLED";

  const canCancel =
    has("orders.cancel") &&
    (pending ||
      (refunded &&
        (open ||
          (order?.status === "CONFIRMED" &&
            !!resource.data?.history &&
            !resource.data.history.tickets.some((ticket) =>
              ticket.items.some(
                (item) => item.preparationStatus === "DELIVERED"
              )
            )))));

  const canRefund =
    verified &&
    has("orders.payments.refund") &&
    has("orders.payments.read");

  const canOpen = hasEveryPermission(session, [
    "orders.read",
    "tables.read",
    "catalog.read",
  ]);

  const following =
    !!order &&
    ["CONFIRMED", "DELIVERED", "CLOSED"].includes(order.status);

  const heading = cancelled
    ? "Pedido cancelado"
    : order?.status === "CLOSED"
      ? "Pedido cerrado"
      : refunded
        ? "Pago devuelto"
        : order?.status === "DELIVERED"
          ? "Pedido entregado"
          : following
            ? "Pedido confirmado y enviado a cocina"
            : order?.paymentStatus === "CONSUMED"
              ? "Pago utilizado por la venta"
              : verified
                ? "Pago verificado"
                : orderId || row?.status === "ACCEPTED"
                  ? "Pedido creado · Pendiente de consulta"
                  : "";

  const whatsapp =
    row &&
    buildWhatsAppUrl(
      row.customerPhone,
      "Hola " +
        row.customerName +
        ", te contactamos de " +
        business.name +
        " sobre tu solicitud " +
        row.publicCode +
        "."
    );

  function ask(next: Modal) {
    setReason("");
    setChecked(false);
    setModal(next);
  }

  async function submitReview() {
    if (blocked) return;

    const ok =
      modal === "cancel"
        ? await resource.operate("cancel", reason)
        : await resource.act(
            modal === "accept" ? "accept" : "reject",
            reason
          );

    if (ok) {
      setModal(null);
    }
  }

  return (
    <>
      <BottomSheet
        id="public-request-detail"
        open
        variant="modal"
        className="por-dialog por-request-dialog"
        title={"Solicitud " + (row?.publicCode ?? "")}
        busy={resource.busy || modal !== null}
        onClose={close}
      >
        <div className="por-dialog-body">
          {resource.loading && (
            <p role="status">Actualizando información…</p>
          )}

          {resource.error && (
            <p className="por-error" role="alert">
              {resource.error}
            </p>
          )}

          {resource.notice && (
            <p className="por-notice" role="status">
              {resource.notice}
            </p>
          )}

          <div>
            <Button
              size="sm"
              variant="soft"
              disabled={resource.busy || resource.loading}
              onClick={() => void resource.reload()}
            >
              Actualizar
            </Button>
          </div>

          {row && (
            <>
              <p className="por-muted">
                {row.serviceType === "DELIVERY"
                  ? "A domicilio"
                  : "Para recoger"}
                {" · "}
                {row.locationName}
              </p>

              <div className="por-toolbar">
                {heading ? (
                  <span
                    className="por-badge"
                    data-status={
                      cancelled || refunded ? "CANCELLED" : "ACCEPTED"
                    }
                  >
                    {pending
                      ? "Pedido creado · Pendiente de pago"
                      : heading}
                  </span>
                ) : (
                  <Badge value={row.status} />
                )}

                <Service delivery={row.serviceType === "DELIVERY"} />
              </div>

              <dl className="por-details">
                <div>
                  <dt>Cliente</dt>
                  <dd>{row.customerName}</dd>
                </div>

                <div>
                  <dt>Teléfono</dt>
                  <dd>{row.customerPhone}</dd>
                </div>

                {row.customerEmail && (
                  <div>
                    <dt>Correo</dt>
                    <dd>{row.customerEmail}</dd>
                  </div>
                )}

                <div>
                  <dt>Fecha y hora</dt>
                  <dd>{date(row.createdAt)}</dd>
                </div>

                <div>
                  <dt>Punto de venta encargado</dt>
                  <dd>{row.locationName}</dd>
                </div>

                <div>
                  <dt>Pedido creado</dt>
                  <dd>{orderId ? "#" + orderId : "—"}</dd>
                </div>
              </dl>

              {row.serviceType === "DELIVERY" &&
                row.deliveryAddress && (
                  <Address value={row.deliveryAddress} />
                )}

              <Items items={row.items} />

              <PublicRequestNotes
                notes={row.notes}
                delivery={row.serviceType === "DELIVERY"}
              />

              <div className="por-toolbar">
                <strong>Subtotal estimado</strong>
                <strong>{price(row.subtotal)}</strong>
              </div>

              {row.rejectionReason && (
                <p className="por-error">{row.rejectionReason}</p>
              )}

              {!cancelled &&
                !["CANCELLED", "REJECTED"].includes(row.status) &&
                whatsapp && (
                  <div className="por-actions">
                    <External href={whatsapp}>
                      <MessageCircle size={16} />
                      Contactar por WhatsApp
                    </External>

                    {manageable && row.status === "NEW" && (
                      <Button
                        variant="soft"
                        disabled={blocked}
                        onClick={() => void resource.act("contact")}
                      >
                        Marcar como contactada
                      </Button>
                    )}
                  </div>
                )}

              {(orderId || row.status === "ACCEPTED") && !order && (
                <p className="por-muted">
                  {has("orders.read")
                    ? "Consulta la orden vinculada antes de continuar."
                    : "No tienes permiso para consultar la orden vinculada."}
                </p>
              )}
            </>
          )}

          {order && (
            <section className="por-order-section">
              <div className="por-toolbar">
                <strong>Pedido #{order.id}</strong>

                <PaymentBadge status={order.paymentStatus} />
              </div>

              <div className="por-toolbar">
                <strong>
                  {pending
                    ? "Total que debe cubrirse"
                    : "Total del pedido"}
                </strong>

                <strong>
                  {order.total ? price(order.total) : "Por consultar"}
                </strong>
              </div>

              {resource.data?.paymentError && (
                <p className="por-error">
                  {resource.data.paymentError}
                </p>
              )}

              {payment && (
                <>
                  <p>
                    Total pagado originalmente:{" "}
                    <strong>{price(payment.paidTotal)}</strong>
                    {payment.verifiedAt && (
                      <>
                        {" · "}
                        {cashDate(payment.verifiedAt, zone)}
                      </>
                    )}
                  </p>

                  <small>
                    {payment.payments
                      .map(
                        (entry) =>
                          entry.paymentMethodName +
                          " " +
                          price(entry.amount)
                      )
                      .join(" · ")}
                  </small>

                  <div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={blocked}
                      onClick={() => ask("payment")}
                    >
                      {refunded
                        ? "Ver detalle del pago devuelto"
                        : "Ver detalle del pago"}
                    </Button>
                  </div>
                </>
              )}

              {verified && (
                <p className="por-muted">
                  Productos bloqueados por pago verificado. Para
                  cancelar, devuelve primero el pago.
                </p>
              )}

              {refunded && (
                <p className="por-error">
                  {cancelled
                    ? "El pago fue devuelto y el pedido está cancelado."
                    : "El pago fue devuelto. El pedido no puede editarse ni enviarse a cocina."}
                </p>
              )}

              {order.paymentStatus === "CONSUMED" && (
                <p className="por-notice">
                  El pago fue utilizado por la venta. No puede
                  registrarse ni devolverse nuevamente desde este
                  pedido.
                </p>
              )}

              {cancelled && !refunded && (
                <p className="por-error">
                  Pedido cancelado. Solo consulta.
                </p>
              )}

              {following && (
                <section
                  className="por-order-tracking"
                  aria-label="Seguimiento de preparación"
                >
                  <strong>Seguimiento de cocina</strong>

                  {resource.data?.historyError ? (
                    <p role="alert">{resource.data.historyError}</p>
                  ) : (
                    <>
                      {!resource.data?.history?.tickets.length && (
                        <p>
                          No hay comandas disponibles para consultar.
                        </p>
                      )}

                      {resource.data?.history?.tickets.map(
                        (ticket) => (
                          <div
                            className="por-order-ticket"
                            key={ticket.id}
                          >
                            <strong>
                              {ticket.preparationAreaName}
                              {" · "}
                              Comanda #{ticket.id}
                            </strong>

                            {ticket.items.map((item) => (
                              <div
                                className="por-toolbar"
                                key={item.id}
                              >
                                <span>
                                  {item.quantity} × {item.productName}
                                </span>

                                <span>
                                  {preparationLabels[
                                    item.preparationStatus
                                  ] ?? item.preparationStatus}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </>
                  )}
                </section>
              )}
            </section>
          )}
        </div>

        <div className="por-dialog-footer">
          <Button
            variant="secondary"
            disabled={resource.busy}
            onClick={close}
          >
            Cerrar
          </Button>

          {manageable && (
            <>
              <Button
                variant="secondary"
                disabled={blocked}
                onClick={() => ask("reject")}
              >
                Rechazar solicitud
              </Button>

              <Button
                disabled={blocked}
                onClick={() => ask("accept")}
              >
                Crear pedido y continuar con el pago
              </Button>
            </>
          )}

          {orderId && canOpen && !resource.busy && (
            <Link
              className="por-link"
              to={"/ventas?orderId=" + orderId}
            >
              Abrir pedido
            </Link>
          )}

          {following &&
            order?.serviceType === "DELIVERY" &&
            has("deliveries.read") &&
            !resource.busy && (
              <Link className="por-link" to="/domicilios">
                Ver domicilios
              </Link>
            )}

          {canCancel && (
            <Button
              variant="secondary"
              disabled={blocked}
              onClick={() => ask("cancel")}
            >
              Cancelar pedido
            </Button>
          )}

          {pending && has("orders.payments.manage") && (
            <Button
              disabled={blocked || !order?.total}
              onClick={() => ask("pay")}
            >
              Registrar y verificar pago
            </Button>
          )}

          {canRefund && (
            <Button
              variant="secondary"
              disabled={blocked}
              onClick={() => ask("refund")}
            >
              Devolver pago
            </Button>
          )}

          {verified && has("orders.manage") && (
            <Button
              disabled={blocked}
              onClick={() => void resource.operate("confirm")}
            >
              Confirmar pedido y enviar a cocina
            </Button>
          )}
        </div>
      </BottomSheet>

      {(modal === "accept" ||
        modal === "reject" ||
        modal === "cancel") && (
        <BottomSheet
          id="public-request-review"
          open
          variant="modal"
          className="por-dialog por-request-dialog"
          title={
            modal === "accept"
              ? "Crear pedido y continuar con el pago"
              : modal === "reject"
                ? "Rechazar solicitud"
                : "Cancelar pedido #" + orderId
          }
          busy={resource.busy}
          onClose={() => setModal(null)}
        >
          <div className="por-dialog-body">
            {modal === "accept" ? (
              <>
                <p>
                  Se creará el pedido pendiente de pago. Podrás
                  registrar el pago y confirmar el pedido sin salir de
                  esta solicitud.
                </p>

                <label className="por-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={resource.busy}
                    onChange={(event) =>
                      setChecked(event.target.checked)
                    }
                  />

                  {row?.serviceType === "DELIVERY"
                    ? "Revisé con el cliente la disponibilidad y la dirección de entrega."
                    : "Revisé con el cliente la disponibilidad de los productos."}
                </label>
              </>
            ) : (
              <>
                {modal === "cancel" && (
                  <p>
                    El pedido relacionado se cancelará completamente.
                    Esta operación no rechaza la solicitud original.
                    {refunded && " El pago ya fue devuelto."}
                  </p>
                )}

                <TextAreaField
                  label={
                    modal === "cancel"
                      ? "Motivo de cancelación"
                      : "Motivo del rechazo"
                  }
                  value={reason}
                  required
                  maxLength={500}
                  disabled={resource.busy}
                  onChange={(event) => setReason(event.target.value)}
                />
              </>
            )}

            {resource.error && (
              <p className="por-error" role="alert">
                {resource.error}
              </p>
            )}

            {resource.error && (
              <Button
                variant="secondary"
                disabled={resource.busy || resource.loading}
                onClick={() => void resource.reload()}
              >
                Consultar estado actual
              </Button>
            )}
          </div>

          <div className="por-dialog-footer">
            <Button
              variant="secondary"
              disabled={resource.busy}
              onClick={() => setModal(null)}
            >
              Volver
            </Button>

            <Button
              variant={modal === "accept" ? "primary" : "danger"}
              loading={resource.busy}
              disabled={
                blocked ||
                (modal === "accept"
                  ? !checked || !manageable
                  : modal === "cancel"
                    ? !canCancel || reason.trim().length < 3
                    : !manageable || !reason.trim())
              }
              onClick={() => void submitReview()}
            >
              {modal === "accept"
                ? "Crear pedido y continuar con el pago"
                : modal === "cancel"
                  ? "Cancelar pedido"
                  : "Rechazar solicitud"}
            </Button>
          </div>
        </BottomSheet>
      )}

      {(modal === "pay" || modal === "refund") && order && scope && (
        <PreorderPaymentDialog
          key={order.id + ":" + modal}
          mode={modal}
          order={order}
          scope={scope}
          resource={resource}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "payment" && order && payment && (
        <PreorderPaymentDetailDialog
          orderId={order.id}
          batch={payment}
          timeZone={zone}
          busy={resource.busy}
          onClose={() => setModal(null)}
          onRefund={canRefund ? () => setModal("refund") : undefined}
        />
      )}
    </>
  );
}
