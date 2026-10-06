import type { RestaurantTable } from "../../restaurant-tables/schemas/restaurant-table.schema";

import type { Order, OrderSummary } from "../schemas/sales.schema";

export const SALES_FILTERS = [
  { id: "ALL", label: "Todos" },
  { id: "FREE", label: "Libres" },
  { id: "OPEN", label: "Sin enviar" },
  { id: "CONFIRMED", label: "En cocina" },
  { id: "DELIVERED", label: "Por cerrar" },
] as const;

export type SalesFilter = (typeof SALES_FILTERS)[number]["id"];

export function isOperationalOrder(
  order: Pick<Order, "status" | "serviceType">
) {
  return (
    ["OPEN", "CONFIRMED", "DELIVERED"].includes(order.status) &&
    (order.serviceType === "TABLE" ||
      order.serviceType === "TAKEAWAY")
  );
}

export function matchesOrder(
  order: OrderSummary,
  filter: SalesFilter
) {
  return (
    isOperationalOrder(order) &&
    (filter === "ALL" || order.status === filter)
  );
}

export function getBoardTables(
  tables: RestaurantTable[],
  orders: OrderSummary[]
) {
  const occupied = new Map(
    orders
      .filter(
        (order) =>
          order.serviceType === "TABLE" &&
          order.restaurantTableId !== null &&
          ["OPEN", "CONFIRMED", "DELIVERED"].includes(order.status)
      )
      .map((order) => [order.restaurantTableId, order])
  );

  return tables
    .filter((table) => table.isActive || occupied.has(table.id))
    .map((table) => ({
      table,
      order: occupied.get(table.id),
    }));
}
