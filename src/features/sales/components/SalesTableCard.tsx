import { DiningTableIcon } from "../../../components/ui/DiningTableIcon";

import type { RestaurantTable } from "../../restaurant-tables/schemas/restaurant-table.schema";

import { OrderStatusBadge } from "./OrderStatusBadge";

import { cents, money } from "../schemas/sales.schema";

import type { OrderSummary } from "../schemas/sales.schema";

export function SalesTableCard({
  table,
  order,
  pendingCount,
  disabled,
  onOpen,
}: {
  table: RestaurantTable;
  order?: OrderSummary;
  pendingCount: number;
  disabled: boolean;
  onOpen: () => void;
}) {
  const empty =
    order?.status === "OPEN" && order.activeItemCount === 0;

  return (
    <button
      type="button"
      className="sales-board-card sales-table-card"
      disabled={disabled}
      onClick={onOpen}
    >
      <span className="sales-board-card-heading">
        <DiningTableIcon size={25} aria-hidden="true" />

        <strong>{table.name}</strong>
      </span>

      <span className="sales-board-muted">
        {table.code}
        {table.capacity ? ` · Capacidad: ${table.capacity}` : ""}
      </span>

      <OrderStatusBadge status={order?.status ?? "FREE"} />

      {order ? (
        <>
          <span className="sales-board-muted">
            Orden #{order.id}
            {order.customerCount !== null
              ? ` · ${order.customerCount} personas`
              : ""}
          </span>

          <span className="sales-board-muted">
            {empty
              ? "Cuenta abierta · Sin productos"
              : `${order.activeItemCount} productos activos`}
          </span>

          {pendingCount > 0 && (
            <span className="sales-board-muted">
              {pendingCount} por enviar
            </span>
          )}

          <b>{money(cents(order.subtotal))}</b>
        </>
      ) : (
        <strong className="sales-open-table">Abrir mesa</strong>
      )}
    </button>
  );
}
