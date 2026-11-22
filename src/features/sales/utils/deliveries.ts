import { ApiError } from "../../../lib/http/client";
import type {
  Delivery,
  DeliveryAction,
} from "../schemas/public-orders.schema";
import type { Order } from "../schemas/sales.schema";
import type { OrderKitchenHistory } from "../services/sales-history.service";

export const deliveryLabels: Record<Delivery["status"], string> = {
  PENDING_ASSIGNMENT: "Sin asignar",
  ASSIGNED: "Asignado",
  PICKED_UP: "Recogido",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const actionLabels: Record<DeliveryAction, string> = {
  "pick-up": "Marcar recogido",
  start: "Iniciar domicilio",
  deliver: "Marcar entregado",
};

export const orderLabels: Record<Delivery["orderStatus"], string> = {
  OPEN: "Pendiente de confirmación",
  CONFIRMED: "Confirmado",
  DELIVERED: "Entregado",
  CLOSED: "Cerrado",
  CANCELLED: "Pedido cancelado",
};

export function deliveryResponsible(row: Delivery) {
  if (row.deliveryMode === "INTERNAL") {
    return row.assignedDriverName ?? "Domiciliario asignado";
  }

  if (row.deliveryMode === "EXTERNAL") {
    return row.externalProviderName ?? "Proveedor externo";
  }

  return "Sin asignar";
}

export function readyToPickUp(
  order: Order | null,
  history: OrderKitchenHistory | null
) {
  if (
    !order ||
    order.status !== "CONFIRMED" ||
    !history ||
    history.orderId !== order.id
  ) {
    return false;
  }

  const active = order.items.filter(
    (item) => item.status === "ACTIVE"
  );

  const prepared = history.tickets
    .filter((ticket) => ticket.status !== "CANCELLED")
    .flatMap((ticket) => ticket.items)
    .filter((item) => item.preparationStatus !== "CANCELLED");

  return (
    active.length > 0 &&
    active.every((item) => {
      const entries = prepared.filter(
        (entry) => entry.orderItemId === item.id
      );

      return (
        entries.length > 0 &&
        entries.every((entry) =>
          ["READY", "DELIVERED"].includes(entry.preparationStatus)
        ) &&
        entries.reduce((sum, entry) => sum + entry.quantity, 0) >=
          item.quantity
      );
    })
  );
}

export function deliveryPolicy(
  row: Delivery,
  access: {
    manage: boolean;
    execute: boolean;
    membershipId: string;
  },
  order: Order | null,
  history: OrderKitchenHistory | null,
  orderError = ""
) {
  const cancelled =
    row.orderStatus === "CANCELLED" || order?.status === "CANCELLED";

  const terminalOrder =
    ["DELIVERED", "CLOSED"].includes(row.orderStatus) ||
    (order !== null &&
      ["DELIVERED", "CLOSED"].includes(order.status));

  const blocked =
    cancelled ||
    terminalOrder ||
    !!orderError ||
    ["CANCELLED", "DELIVERED"].includes(row.status);

  const execute =
    access.execute &&
    (row.deliveryMode === "INTERNAL"
      ? row.assignedDriverMembershipId === access.membershipId
      : row.deliveryMode === "EXTERNAL" && access.manage);

  const next: DeliveryAction | null =
    row.status === "ASSIGNED"
      ? "pick-up"
      : row.status === "PICKED_UP"
        ? "start"
        : row.status === "OUT_FOR_DELIVERY"
          ? "deliver"
          : null;

  const ready =
    row.orderStatus === "CONFIRMED" && readyToPickUp(order, history);

  return {
    cancelled,
    ready,
    assign:
      !blocked &&
      access.manage &&
      ["PENDING_ASSIGNMENT", "ASSIGNED"].includes(row.status),
    next: !blocked && execute ? next : null,
    advance:
      !blocked && execute && !!next && (next !== "pick-up" || ready),
  };
}

export function deliveryError(cause: unknown): string {
  if (cause instanceof ApiError) {
    const messages: Record<string, string> = {
      DELIVERY_NOT_FOUND: "El domicilio ya no está disponible.",
      DRIVER_NOT_ELIGIBLE:
        "El empleado ya no es elegible para este reparto.",
      DELIVERY_NOT_ASSIGNABLE:
        "El estado actual ya no permite cambiar la asignación.",
      DELIVERY_NOT_ASSIGNED_TO_DRIVER:
        "Este domicilio está asignado a otro domiciliario.",
      INVALID_DELIVERY_TRANSITION:
        "El domicilio cambió de estado. Revisa la información actualizada.",
      DELIVERY_ORDER_NOT_READY:
        "Cocina todavía no terminó el pedido. Actualiza el seguimiento antes de recoger.",
    };

    if (messages[cause.code]) return messages[cause.code];

    if (cause.status === 403) {
      return "No tienes permiso para realizar esta operación.";
    }

    if (cause.status === 409) {
      return "El estado cambió. Revisa la información actualizada.";
    }
  }

  return cause instanceof Error
    ? cause.message
    : "No se pudo completar la operación.";
}

export function deliveryFailure(cause: unknown): ApiError {
  return new ApiError(
    cause instanceof ApiError ? cause.status : 0,
    cause instanceof ApiError ? cause.code : "DELIVERY_ERROR",
    deliveryError(cause)
  );
}
