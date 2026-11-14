import { BottomSheet } from "../../../../components/layout/BottomSheet";
import { Button } from "../../../../components/ui/Button";
import { buildWhatsAppUrl } from "../../../../lib/whatsapp";
import { hasPermission } from "../../../auth/utils/permissions";
import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { useMutation } from "../../hooks/usePublicOrders";
import { useRemote } from "../../hooks/usePublicOrders";
import type { Delivery } from "../../schemas/public-orders.schema";
import type { DeliveryAction } from "../../schemas/public-orders.schema";
import { advanceDelivery } from "../../services/deliveries.service";
import { assignDelivery } from "../../services/deliveries.service";
import { readDelivery } from "../../services/deliveries.service";
import { labels } from "../../utils/public-orders.utils";
import { Address } from "../public-orders/PublicOrderShared";
import { DeliveryCostNotice } from "../public-orders/DeliveryCostNotice";
import { Badge } from "../public-orders/PublicOrderShared";
import { External } from "../public-orders/PublicOrderShared";
import { Feedback } from "../public-orders/PublicOrderShared";
import { Items } from "../public-orders/PublicOrderShared";
import { AssignmentForm } from "./AssignmentForm";
import { MessageCircle } from "lucide-react";
import { Link } from "react-router";
import { useCallback } from "react";
import { useState } from "react";

export function DeliveryDialog({
  row: initial,
  close,
  saved,
}: {
  row: Delivery;
  close: () => void;
  saved: (message: string) => void;
}) {
  const { session, business, price } = usePresentation();
  const token = session.accessToken;
  const slug = business.slug;

  // Consulta el estado actual antes de ofrecer acciones.
  const loader = useCallback(
    (signal: AbortSignal) =>
      readDelivery(initial.id, token, slug, signal),
    [initial.id, token, slug]
  );

  const resource = useRemote(loader);
  const mutation = useMutation();

  const [panel, setPanel] = useState<
    "detail" | "assign" | DeliveryAction
  >("detail");

  const row = resource.data;
  const manage = hasPermission(session, "deliveries.manage");

  const canExecute =
    row &&
    hasPermission(session, "deliveries.execute") &&
    (row.deliveryMode === "INTERNAL"
      ? row.assignedDriverMembershipId === session.membership.id
      : row.deliveryMode === "EXTERNAL" && manage);

  const next: DeliveryAction | null =
    row?.status === "ASSIGNED"
      ? "pick-up"
      : row?.status === "PICKED_UP"
        ? "start"
        : row?.status === "OUT_FOR_DELIVERY"
          ? "deliver"
          : null;

  const actionLabels = {
    "pick-up": "Marcar recogido",
    start: "Marcar en camino",
    deliver: "Confirmar entrega",
  };

  const ready =
    row?.orderStatus === "CONFIRMED" &&
    ["READY", "DELIVERED"].includes(
      row.tracking?.preparationStatus ?? ""
    );

  const whatsapp =
    row &&
    buildWhatsAppUrl(
      row.customerPhone,
      "Hola " +
        row.customerName +
        ", te contactamos de " +
        business.name +
        " sobre tu pedido #" +
        row.orderId +
        "."
    );

  function advance(action: DeliveryAction) {
    if (
      !row ||
      !canExecute ||
      next !== action ||
      (action === "pick-up" && !ready)
    ) {
      return;
    }

    void mutation.run(
      (signal) => advanceDelivery(row.id, action, token, signal),
      () => saved("Estado del domicilio actualizado."),
      resource.reload
    );
  }

  return (
    <BottomSheet
      id="delivery-detail"
      open
      variant="modal"
      className="por-dialog"
      title={
        panel === "assign"
          ? "Asignar entrega"
          : panel === "detail"
            ? "Pedido #" + initial.orderId
            : actionLabels[panel]
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
          (panel === "assign" ? (
            <AssignmentForm
              busy={mutation.busy}
              submit={(body) => {
                if (
                  !manage ||
                  !["PENDING_ASSIGNMENT", "ASSIGNED"].includes(
                    row.status
                  )
                ) {
                  return;
                }

                void mutation.run(
                  (signal) =>
                    assignDelivery(
                      row.publicOrderRequestId,
                      body,
                      token,
                      signal
                    ),
                  () => saved("Domiciliario asignado."),
                  resource.reload
                );
              }}
            />
          ) : panel === "detail" ? (
            <>
              <div className="por-toolbar">
                <strong>{row.customerName}</strong>
                <Badge value={row.status} />
              </div>

              <p>{row.customerPhone}</p>
              <Address value={row.deliveryAddress} />
              <DeliveryCostNotice />
              <p>
                Repartidor:{" "}
                {row.assignedDriverName ??
                  row.externalProviderName ??
                  "Sin asignar"}
              </p>

              {row.tracking ? (
                <>
                  <p>
                    {row.tracking.locationName} ·{" "}
                    {
                      labels[
                        row.tracking.preparationStatus ??
                          row.orderStatus
                      ]
                    }
                  </p>

                  <Items items={row.tracking.items} />

                  <div className="por-toolbar">
                    <strong>Subtotal de productos</strong>
                    <strong>{price(row.tracking.subtotal)}</strong>
                  </div>
                </>
              ) : (
                <p>
                  Seguimiento no disponible. Actualiza antes de
                  recoger.
                </p>
              )}

              {whatsapp && (
                <External href={whatsapp}>
                  <MessageCircle size={16} />
                  Contactar al cliente
                </External>
              )}

              <div className="por-actions">
                {manage &&
                  ["PENDING_ASSIGNMENT", "ASSIGNED"].includes(
                    row.status
                  ) && (
                    <Button onClick={() => setPanel("assign")}>
                      Asignar domiciliario
                    </Button>
                  )}

                {canExecute && next && (
                  <Button
                    disabled={next === "pick-up" && !ready}
                    onClick={() => setPanel(next)}
                  >
                    {actionLabels[next]}
                  </Button>
                )}
              </div>

              {next === "pick-up" && !ready && (
                <small>
                  Esperando confirmación de cocina. Actualiza cuando
                  el pedido esté listo.
                </small>
              )}

              {hasPermission(session, "public_orders.read") && (
                <Link
                  className="por-link"
                  to={
                    "/pedidos-publicos?solicitud=" +
                    row.publicOrderRequestId
                  }
                >
                  Revisar solicitud / enviar a preparación
                </Link>
              )}

              {hasPermission(session, "kitchen.dashboard.read") && (
                <Link className="por-link" to="/cocina">
                  Abrir cocina
                </Link>
              )}
            </>
          ) : (
            <p>
              Confirma la acción «{actionLabels[panel]}» para el
              pedido #{row.orderId} de {row.customerName}.
            </p>
          ))}
      </div>

      <div className="por-dialog-footer">
        <Button
          variant="secondary"
          disabled={mutation.busy}
          onClick={
            panel === "detail" ? close : () => setPanel("detail")
          }
        >
          {panel === "detail" ? "Cerrar" : "Volver"}
        </Button>

        <Button
          variant="secondary"
          disabled={mutation.busy || resource.loading}
          onClick={resource.reload}
        >
          Actualizar
        </Button>

        {panel !== "detail" && panel !== "assign" && (
          <Button
            loading={mutation.busy}
            disabled={
              !canExecute ||
              next !== panel ||
              (panel === "pick-up" && !ready)
            }
            onClick={() => advance(panel)}
          >
            Confirmar
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
