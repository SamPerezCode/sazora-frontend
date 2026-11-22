import { useCallback, useState } from "react";

import { BottomSheet } from "../../../../components/layout/BottomSheet";
import { Button } from "../../../../components/ui/Button";
import { buildWhatsAppUrl } from "../../../../lib/whatsapp";

import { hasPermission } from "../../../auth/utils/permissions";

import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { useMutation, useRemote } from "../../hooks/usePublicOrders";

import type {
  Assignment,
  DeliveryAction,
} from "../../schemas/public-orders.schema";

import {
  advanceDelivery,
  assignDelivery,
  readDeliveryContext,
  staleDelivery,
} from "../../services/deliveries.service";

import {
  actionLabels,
  deliveryLabels,
  deliveryResponsible,
  deliveryPolicy,
  deliveryFailure,
  orderLabels,
} from "../../utils/deliveries";

import {
  Address,
  External,
  Feedback,
} from "../public-orders/PublicOrderShared";

import { AssignmentForm } from "./AssignmentForm";
import { DeliveryLinks } from "./DeliveryLinks";

export function DeliveryDialog({
  deliveryId,
  close,
  saved,
}: {
  deliveryId: string;
  close: () => void;
  saved: (message: string) => void;
}) {
  const { session, business, date } = usePresentation();
  const token = session.accessToken;

  const canReadOrder = hasPermission(session, "orders.read");

  const canReadKitchen = hasPermission(session, "orders.read");

  const mutation = useMutation();

  const loader = useCallback(
    (signal: AbortSignal) =>
      readDeliveryContext(
        deliveryId,
        token,
        business.id,
        canReadOrder,
        canReadKitchen,
        signal
      ),
    [deliveryId, token, business.id, canReadOrder, canReadKitchen]
  );

  const [panel, setPanel] = useState<
    "detail" | "assign" | DeliveryAction
  >("detail");

  const resource = useRemote(loader, {
    token,
    keys: ["deliveries:" + deliveryId],
    paused: mutation.busy || panel !== "detail",
    pollMs: 15000,
  });

  const [notice, setNotice] = useState("");

  const context = resource.data;
  const row = context?.delivery;

  const access = {
    manage: hasPermission(session, "deliveries.manage"),
    execute: hasPermission(session, "deliveries.execute"),
    membershipId: session.membership.id,
  };

  const policy =
    context &&
    deliveryPolicy(
      context.delivery,
      access,
      context.order,
      context.history,
      context.orderError
    );

  const blocked = mutation.busy || resource.loading;

  const status = policy?.cancelled
    ? "CANCELLED"
    : (context?.order?.status ?? row?.orderStatus);

  const preparation =
    status !== "CONFIRMED"
      ? status && orderLabels[status]
      : policy?.ready
        ? "Listo para recoger"
        : context?.history
          ? "En preparación"
          : "Preparación sin verificar";

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

  function refresh() {
    setPanel("detail");
    resource.reload();
  }

  function perform(
    action: "assign" | DeliveryAction,
    body?: Assignment
  ) {
    if (!row || !policy || blocked) return;

    if (
      action === "assign"
        ? !policy.assign
        : !policy.advance || policy.next !== action
    ) {
      return;
    }

    setNotice("");

    void mutation.run(
      async (signal) => {
        try {
          // Revalidar evita actuar sobre una asignación
          // o preparación antigua.
          const fresh = await loader(signal);

          const allowed = deliveryPolicy(
            fresh.delivery,
            access,
            fresh.order,
            fresh.history,
            fresh.orderError
          );

          if (
            fresh.delivery.orderId !== row.orderId ||
            fresh.delivery.publicOrderRequestId !==
              row.publicOrderRequestId
          ) {
            staleDelivery();
          }

          if (action === "assign") {
            if (!allowed.assign || !body) {
              staleDelivery();
            }

            await assignDelivery(
              fresh.delivery.publicOrderRequestId,
              body,
              token,
              signal
            );
          } else {
            if (!allowed.advance || allowed.next !== action) {
              staleDelivery();
            }

            await advanceDelivery(
              fresh.delivery.id,
              action,
              token,
              signal
            );
          }
        } catch (cause) {
          throw deliveryFailure(cause);
        }
      },
      () => {
        const message =
          action === "assign"
            ? "Asignación guardada."
            : "Estado del domicilio actualizado.";

        setNotice(message);
        refresh();
        saved(message);
      },
      () => {
        refresh();
        saved("");
      }
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
          ? "Asignar domiciliario"
          : panel === "detail"
            ? "Domicilio " + (row?.publicCode ?? "#" + deliveryId)
            : actionLabels[panel]
      }
      busy={mutation.busy}
      onClose={close}
      onBack={
        panel === "detail" ? undefined : () => setPanel("detail")
      }
    >
      <div className="por-dialog-body">
        <Feedback loading={resource.loading} error={resource.error} />

        {mutation.error && (
          <p role="alert" className="por-error">
            {mutation.error}
          </p>
        )}

        {notice && (
          <p role="status" className="por-notice">
            {notice}
          </p>
        )}

        {context?.orderError && (
          <p role="alert" className="por-error">
            No se pudo actualizar la orden: {context.orderError}{" "}
            Actualiza antes de continuar.
          </p>
        )}

        {context?.historyError && (
          <p role="alert" className="por-error">
            No se pudo verificar la preparación:{" "}
            {context.historyError}
          </p>
        )}

        {row &&
          policy &&
          (panel === "assign" ? (
            policy.assign ? (
              <AssignmentForm
                busy={blocked}
                submit={(body) => perform("assign", body)}
              />
            ) : (
              <p>
                La asignación ya no está disponible. Vuelve al
                detalle.
              </p>
            )
          ) : panel === "detail" ? (
            <>
              <div className="por-toolbar">
                <strong>{row.customerName}</strong>

                <span className="por-badge" data-status={row.status}>
                  {deliveryLabels[row.status]}
                </span>
              </div>

              <p>{row.customerPhone}</p>

              <Address value={row.deliveryAddress} />

              <dl className="por-details">
                <div>
                  <dt>Pedido</dt>
                  <dd>#{row.orderId}</dd>
                </div>

                <div>
                  <dt>Estado de la orden</dt>
                  <dd>{status && orderLabels[status]}</dd>
                </div>

                <div>
                  <dt>Modalidad</dt>
                  <dd>
                    {row.deliveryMode === "INTERNAL"
                      ? "Equipo propio"
                      : row.deliveryMode === "EXTERNAL"
                        ? "Proveedor externo"
                        : "Sin asignar"}
                  </dd>
                </div>

                <div>
                  <dt>Responsable</dt>
                  <dd>{deliveryResponsible(row)}</dd>
                </div>

                <div>
                  <dt>Punto de venta</dt>
                  <dd>
                    {context.order?.location.name ?? "No disponible"}
                  </dd>
                </div>

                <div>
                  <dt>Creado</dt>
                  <dd>{date(row.createdAt)}</dd>
                </div>
              </dl>

              <p>
                <strong>Preparación: </strong>
                {preparation}
              </p>

              {!canReadOrder && (
                <small>
                  No tienes permiso para consultar la preparación del
                  pedido.
                </small>
              )}

              {policy.cancelled && (
                <p role="status" className="por-error">
                  El pedido relacionado está cancelado. Las acciones
                  de reparto están bloqueadas.
                </p>
              )}

              {row.status === "ASSIGNED" &&
                !policy.ready &&
                !policy.cancelled && (
                  <p role="status">
                    {context.history
                      ? "El pedido todavía está en preparación. Podrás marcarlo como recogido cuando todos los productos estén listos."
                      : "Es necesario verificar la confirmación y la preparación antes de recoger el pedido."}
                  </p>
                )}

              {row.status === "DELIVERED" && status !== "CLOSED" && (
                <p className="por-notice">
                  Pedido entregado. El cierre financiero se realizará
                  desde el flujo de la orden.
                </p>
              )}

              {whatsapp && (
                <External href={whatsapp}>
                  Contactar al cliente
                </External>
              )}

              <DeliveryLinks row={row} />

              <div className="por-actions">
                {policy.assign && (
                  <Button
                    disabled={blocked}
                    onClick={() => setPanel("assign")}
                  >
                    {row.status === "ASSIGNED"
                      ? "Cambiar asignación"
                      : "Asignar domiciliario"}
                  </Button>
                )}

                {policy.next && (
                  <Button
                    disabled={blocked || !policy.advance}
                    onClick={() =>
                      policy.next && setPanel(policy.next)
                    }
                  >
                    {actionLabels[policy.next]}
                  </Button>
                )}
              </div>

              {access.execute &&
                ((row.deliveryMode === "INTERNAL" &&
                  row.assignedDriverMembershipId !==
                    access.membershipId) ||
                  (row.deliveryMode === "EXTERNAL" &&
                    !access.manage)) &&
                [
                  "ASSIGNED",
                  "PICKED_UP",
                  "OUT_FOR_DELIVERY",
                ].includes(row.status) &&
                !policy.cancelled && (
                  <small>
                    Solo el responsable autorizado puede avanzar este
                    domicilio.
                  </small>
                )}
            </>
          ) : (
            <p>
              Confirma «{actionLabels[panel]}» para el pedido #
              {row.orderId} de {row.customerName}.
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
          disabled={blocked}
          onClick={refresh}
        >
          Actualizar
        </Button>

        {panel !== "detail" && panel !== "assign" && (
          <Button
            loading={mutation.busy}
            disabled={
              blocked || !policy?.advance || policy.next !== panel
            }
            onClick={() => perform(panel)}
          >
            Confirmar
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
