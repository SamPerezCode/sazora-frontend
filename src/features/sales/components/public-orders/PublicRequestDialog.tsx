import { TextAreaField } from "../../../../components/forms/TextAreaField";
import { BottomSheet } from "../../../../components/layout/BottomSheet";
import { Button } from "../../../../components/ui/Button";
import { buildWhatsAppUrl } from "../../../../lib/whatsapp";
import { hasPermission } from "../../../auth/utils/permissions";
import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { useMutation } from "../../hooks/usePublicOrders";
import { useRemote } from "../../hooks/usePublicOrders";
import type { RequestAction } from "../../schemas/public-orders.schema";
import { changeRequest } from "../../services/public-orders.service";
import { readRequest } from "../../services/public-orders.service";
import { pending } from "../../utils/public-orders.utils";
import { DeliveryCostNotice } from "./DeliveryCostNotice";
import { PublicRequestNotes } from "./PublicRequestNotes";
import { Address } from "./PublicOrderShared";
import { Badge } from "./PublicOrderShared";
import { External } from "./PublicOrderShared";
import { Feedback } from "./PublicOrderShared";
import { Items } from "./PublicOrderShared";
import { Service } from "./PublicOrderShared";
import { MessageCircle } from "lucide-react";
import { useCallback } from "react";
import { useState } from "react";

export function RequestDialog({
  id,
  close,
  saved,
}: {
  id: string;
  close: () => void;
  saved: (message: string) => void;
}) {
  const { session, business, date, price } = usePresentation();
  const token = session.accessToken;

  const loader = useCallback(
    (signal: AbortSignal) => readRequest(id, token, signal),
    [id, token]
  );

  const resource = useRemote(loader);
  const mutation = useMutation();

  const [panel, setPanel] = useState<"detail" | "accept" | "reject">(
    "detail"
  );

  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);

  const row = resource.data?.request;
  const order = resource.data?.order;

  const manageable =
    !!row &&
    pending(row.status) &&
    hasPermission(session, "public_orders.manage");

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
        ". Vamos a confirmar disponibilidad, entrega y forma de pago."
    );

  function act(action: RequestAction) {
    if (!row || mutation.busy || resource.loading) return;

    void mutation.run(
      (signal) => changeRequest(id, action, token, signal, reason),
      () => {
        setPanel("detail");
        setChecked(false);
        resource.reload();

        saved(
          action === "accept"
            ? "Solicitud aceptada y pedido creado."
            : action === "reject"
              ? "Solicitud rechazada."
              : action === "contact"
                ? "Solicitud marcada como contactada."
                : "Pedido enviado a preparación."
        );
      },
      resource.reload
    );
  }

  return (
    <BottomSheet
      id="public-request-detail"
      open
      variant="modal"
      className="por-dialog"
      title={
        panel === "accept"
          ? "Aceptar solicitud y crear pedido"
          : panel === "reject"
            ? "Rechazar solicitud"
            : "Solicitud " + (row?.publicCode ?? "")
      }
      busy={mutation.busy}
      onClose={close}
      onBack={
        panel === "detail" ? undefined : () => setPanel("detail")
      }
    >
      <div className="por-dialog-body">
        <Feedback
          loading={resource.loading}
          error={resource.error ?? mutation.error}
        />

        {resource.error && (
          <Button variant="secondary" onClick={resource.reload}>
            Reintentar consulta
          </Button>
        )}

        {row &&
          (panel === "detail" ? (
            <>
              <div className="por-toolbar">
                <Badge value={row.status} />
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
                <div>
                  <dt>Correo</dt>
                  <dd>{row.customerEmail || "—"}</dd>
                </div>
                <div>
                  <dt>Fecha y hora</dt>
                  <dd>{date(row.createdAt)}</dd>
                </div>
                <div>
                  <dt>Punto de venta</dt>
                  <dd>{row.locationName}</dd>
                </div>
                <div>
                  <dt>Pedido creado</dt>
                  <dd>{order ? "#" + order.id : "—"}</dd>
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
                <strong>Subtotal de productos</strong>
                <strong>{price(row.subtotal)}</strong>
              </div>

              {row.serviceType === "DELIVERY" && (
                <DeliveryCostNotice />
              )}

              {row.rejectionReason && (
                <p className="por-error">{row.rejectionReason}</p>
              )}

              {order && (
                <p>
                  Estado del pedido: <Badge value={order.status} />
                </p>
              )}

              {pending(row.status) && (
                <div className="por-actions">
                  {whatsapp && (
                    <External href={whatsapp}>
                      <MessageCircle size={16} />
                      Contactar por WhatsApp
                    </External>
                  )}

                  {manageable && row.status === "NEW" && (
                    <Button
                      variant="soft"
                      loading={mutation.busy}
                      onClick={() => act("contact")}
                    >
                      Marcar como contactada
                    </Button>
                  )}
                </div>
              )}

              {row.status === "ACCEPTED" &&
                order?.status === "OPEN" &&
                hasPermission(session, "public_orders.manage") && (
                  <Button
                    variant="secondary"
                    loading={mutation.busy}
                    onClick={() => act("confirm-order")}
                  >
                    Enviar a preparación
                  </Button>
                )}
            </>
          ) : panel === "reject" ? (
            <TextAreaField
              label="Motivo del rechazo"
              value={reason}
              maxLength={500}
              required
              disabled={mutation.busy}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : (
            <>
              <p>
                Confirma que contactaste al cliente y verificaste la
                disponibilidad de los productos
                {row.serviceType === "DELIVERY"
                  ? ", la dirección de entrega"
                  : ""}{" "}
                y las condiciones de pago. Al aceptar se creará el
                pedido y podrá enviarse a preparación.
              </p>

              <p>
                Subtotal de productos:{" "}
                <strong>{price(row.subtotal)}</strong>
              </p>

              <p className="por-muted">
                Aceptar la solicitud no registra un pago. El pago
                definitivo se registra posteriormente en ventas.
              </p>

              <label className="por-check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={mutation.busy}
                  onChange={(event) =>
                    setChecked(event.target.checked)
                  }
                />
                He contactado al cliente y verificado los datos de la
                solicitud.
              </label>
            </>
          ))}
      </div>

      <div className="por-dialog-footer">
        {panel === "detail" ? (
          <>
            {manageable && (
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => setPanel("reject")}
              >
                Rechazar solicitud
              </Button>
            )}

            {manageable ? (
              <Button
                disabled={mutation.busy}
                onClick={() => setPanel("accept")}
              >
                Revisar y aceptar solicitud
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={close}
              >
                Cerrar
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={mutation.busy}
              onClick={() => setPanel("detail")}
            >
              Cancelar
            </Button>

            <Button
              variant={panel === "reject" ? "danger" : "primary"}
              loading={mutation.busy}
              disabled={
                !manageable ||
                resource.loading ||
                (panel === "accept" ? !checked : !reason.trim())
              }
              onClick={() =>
                act(panel === "accept" ? "accept" : "reject")
              }
            >
              {panel === "accept"
                ? "Aceptar y crear pedido"
                : "Confirmar rechazo"}
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
