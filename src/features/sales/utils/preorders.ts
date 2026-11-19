import type {
  Order,
  OrderInput,
  OrderSummary,
} from "../schemas/sales.schema";

export const CHANNELS = {
  IN_PERSON: "Punto de venta",
  WHATSAPP: "WhatsApp",
  PHONE: "Teléfono",
  PUBLIC_MENU: "Menú público",
} as const;

export const PAYMENT_LABELS = {
  PENDING: "Pendiente de pago",
  VERIFIED: "Pago verificado",
  CONSUMED: "Pago aplicado a la venta",
  REFUNDED: "Pago devuelto",
  VOIDED: "Pago anulado",
} as const;

export const PREORDER_FILTERS = [
  ["ALL", "Todos"],
  ["PENDING", "Pendiente de pago"],
  ["VERIFIED", "Pago verificado"],
  ["CONFIRMED", "En cocina"],
  ["DELIVERED", "Entregada"],
  ["REFUNDED", "Pago devuelto"],
] as const;

export type PreorderFilter = (typeof PREORDER_FILTERS)[number][0];

export function canEditPreorder(
  order: Pick<Order, "status" | "paymentStatus">
) {
  return order.status === "OPEN" && order.paymentStatus === "PENDING";
}

export function preorderRows(
  orders: OrderSummary[],
  filter: PreorderFilter
) {
  return [
    ...new Map(orders.map((order) => [order.id, order])).values(),
  ]
    .filter(
      (order) =>
        order.serviceType !== "TABLE" &&
        ["OPEN", "CONFIRMED", "DELIVERED"].includes(order.status) &&
        (filter === "ALL" ||
          (filter === "CONFIRMED" || filter === "DELIVERED"
            ? order.status === filter
            : order.paymentStatus === filter))
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        (BigInt(a.id) < BigInt(b.id)
          ? 1
          : BigInt(a.id) > BigInt(b.id)
            ? -1
            : 0)
    );
}
export function customerFields(input: OrderInput) {
  return {
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    customerEmail: input.customerEmail?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export function customerErrors(input: OrderInput) {
  const value = customerFields(input);

  const required =
    input.sourceChannel === "WHATSAPP" ||
    input.sourceChannel === "PHONE";

  const errors: Partial<
    Record<
      "customerName" | "customerPhone" | "customerEmail" | "notes",
      string
    >
  > = {};

  if (required && !value.customerName) {
    errors.customerName =
      "El nombre es obligatorio para pedidos por WhatsApp o teléfono.";
  }

  if (required && !value.customerPhone) {
    errors.customerPhone =
      "El teléfono es obligatorio para pedidos por WhatsApp o teléfono.";
  }

  if (
    value.customerEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.customerEmail)
  ) {
    errors.customerEmail = "Escribe un correo electrónico válido.";
  }

  if ((value.notes?.length ?? 0) > 500) {
    errors.notes = "Máximo 500 caracteres.";
  }

  return errors;
}
