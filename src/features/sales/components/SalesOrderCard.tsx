import { ArrowUpRight, ShoppingBag } from "lucide-react";

import { cents, money } from "../schemas/sales.schema";
import { isOperationalOrder } from "../utils/sales-board";

import { OrderStatusBadge } from "./OrderStatusBadge";

import type { OrderSummary } from "../schemas/sales.schema";

export function SalesOrderCard({
  order,
  disabled,
  onOpen,
  pendingCount = 0,
}: {
  order: OrderSummary;
  disabled: boolean;
  pendingCount?: number;
  onOpen: (id: string) => void;
}) {
  if (
    order.serviceType !== "TAKEAWAY" ||
    !isOperationalOrder(order)
  ) {
    return null;
  }

  return (
    <button
      type="button"
      className="sales-board-card"
      disabled={disabled}
      onClick={() => onOpen(order.id)}
    >
      <span className="sales-board-card-heading">
        <ShoppingBag size={18} aria-hidden="true" />
        <strong>Para recoger</strong>
        <ArrowUpRight size={16} aria-hidden="true" />
      </span>

      <span className="sales-board-muted">Pedido #{order.id}</span>

      <OrderStatusBadge status={order.status} />

      <span className="sales-board-muted">
        {order.status === "OPEN" && order.activeItemCount === 0
          ? "Cuenta abierta · Sin productos"
          : `${order.activeItemCount} productos activos`}
      </span>

      {pendingCount > 0 && (
        <span className="sales-board-muted">
          {pendingCount} por enviar
        </span>
      )}

      <b>{money(cents(order.subtotal))}</b>
    </button>
  );
}
