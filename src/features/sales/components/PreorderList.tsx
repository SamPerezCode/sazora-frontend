import { useRouteState } from "../../../hooks/useRouteState";
import { Bike, ShoppingBag } from "lucide-react";

import { Button } from "../../../components/ui/Button";

import {
  cents,
  money,
  type Order,
  type OrderSummary,
} from "../schemas/sales.schema";

import {
  CHANNELS,
  PAYMENT_LABELS,
  PREORDER_FILTERS,
  preorderRows,
  type PreorderFilter,
} from "../utils/preorders";

export function PaymentBadge({
  status,
}: {
  status: Order["paymentStatus"];
}) {
  return (
    <span
      className="preorder-payment"
      data-status={status ?? "UNKNOWN"}
    >
      {status ? PAYMENT_LABELS[status] : "Pago por consultar"}
    </span>
  );
}

export function PreorderList({
  orders,
  disabled,
  onOpen,
}: {
  orders: OrderSummary[];
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useRouteState<PreorderFilter>(
    "preorderFilter",
    "ALL"
  );
  const rows = preorderRows(orders, filter);
  const count = preorderRows(orders, "ALL").length;

  return (
    <section
      className="preorders"
      aria-label="Pedidos para recoger y domicilio"
    >
      <div className="mp-section-heading">
        <div>
          <h3>
            <ShoppingBag size={18} aria-hidden="true" />
            Pedidos para recoger y domicilio
            <span className="mp-neutral">{count}</span>
          </h3>
          <p>Se pagan y verifican antes de enviarse a cocina.</p>
          <small>
            Los filtros incluyen las órdenes activas del punto de
            venta. Las cerradas y canceladas se consultan en el
            historial.
          </small>
        </div>
      </div>

      <div
        className="preorder-filters"
        role="group"
        aria-label="Estado de los pedidos"
      >
        {PREORDER_FILTERS.map(([value, label]) => (
          <Button
            key={value}
            size="compact"
            variant={filter === value ? "primary" : "soft"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {rows.length ? (
        <div
          key={filter}
          className="preorder-track"
          role="region"
          aria-label="Pedidos, del más reciente al más antiguo."
          tabIndex={0}
        >
          {rows.map((order) => (
            <article key={order.id} className="preorder-card">
              <div className="mp-card-line">
                <strong>Pedido #{order.id}</strong>

                <strong>
                  {order.total
                    ? money(cents(order.total))
                    : "Total por consultar"}
                </strong>
              </div>

              <small>
                {order.serviceType === "DELIVERY" ? (
                  <Bike size={14} />
                ) : (
                  <ShoppingBag size={14} />
                )}

                {order.serviceType === "DELIVERY"
                  ? "A domicilio"
                  : "Para recoger en sitio"}
              </small>

              <div className="mp-badges">
                <PaymentBadge status={order.paymentStatus} />

                <span className="mp-neutral">
                  {order.status === "OPEN"
                    ? "Abierta · sin enviar"
                    : order.status === "CONFIRMED"
                      ? "En cocina"
                      : "Entregada"}
                </span>
              </div>

              <p>
                {order.customerName?.trim() || "Cliente ocasional"}
              </p>

              <small>
                {order.sourceChannel
                  ? CHANNELS[order.sourceChannel]
                  : "Origen no informado"}
              </small>

              <Button
                variant="soft"
                size="compact"
                disabled={disabled}
                onClick={() => onOpen(order.id)}
              >
                Ver orden
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mp-empty">
          No hay pedidos con este filtro.
        </div>
      )}
    </section>
  );
}
