import type {
  KitchenItem,
  KitchenTicket,
} from "../schemas/kitchen.schema";

export const KITCHEN_DELAY_THRESHOLD_MINUTES = 20;
export const KITCHEN_POLL_MS = 15_000;
export const KITCHEN_DEBOUNCE_MS = 300;

export function isActiveItem(item: KitchenItem) {
  return (
    item.preparationStatus !== "DELIVERED" &&
    item.preparationStatus !== "CANCELLED"
  );
}

export function nextItemStatus(
  item: KitchenItem
): "IN_PREPARATION" | "READY" | null {
  if (item.fulfillmentMode !== "PREPARE_TO_ORDER") return null;

  if (item.preparationStatus === "PENDING") {
    return "IN_PREPARATION";
  }

  if (item.preparationStatus === "IN_PREPARATION") {
    return "READY";
  }

  return null;
}

export function nextTicketStatus(
  ticket: KitchenTicket
): "IN_PREPARATION" | "READY" | null {
  if (
    ticket.items.some(
      (item) => nextItemStatus(item) === "IN_PREPARATION"
    )
  ) {
    return "IN_PREPARATION";
  }

  const hasPending = ticket.items.some(
    (item) => item.preparationStatus === "PENDING"
  );

  const hasPreparing = ticket.items.some(
    (item) => nextItemStatus(item) === "READY"
  );

  return !hasPending && hasPreparing ? "READY" : null;
}

export function serviceLabel(ticket: KitchenTicket) {
  if (ticket.serviceType === "DELIVERY") return "Domicilio";
  if (ticket.serviceType === "TAKEAWAY") return "Para recoger";

  return (
    ticket.restaurantTableName || ticket.restaurantTableCode || "Mesa"
  );
}

export function elapsedMinutes(createdAt: string, now: number) {
  return Math.max(
    0,
    Math.floor((now - Date.parse(createdAt)) / 60_000)
  );
}

export function isDelayed(ticket: KitchenTicket, now: number) {
  return (
    ticket.status !== "READY" &&
    elapsedMinutes(ticket.createdAt, now) >=
      KITCHEN_DELAY_THRESHOLD_MINUTES
  );
}

export function clockTime(value: number | string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function mergeKitchenItems(
  ticket: KitchenTicket,
  incoming: KitchenItem[]
): KitchenTicket {
  return {
    ...ticket,
    items: ticket.items.map((old) => {
      const next = incoming.find((item) => item.id === old.id);

      if (
        !next ||
        Date.parse(next.updatedAt) < Date.parse(old.updatedAt)
      ) {
        return old;
      }

      if (
        old.preparationStatus === "CANCELLED" &&
        next.preparationStatus !== "CANCELLED"
      ) {
        return old;
      }

      if (
        old.preparationStatus === "DELIVERED" &&
        next.preparationStatus !== "DELIVERED"
      ) {
        return old;
      }

      return next;
    }),
  };
}
