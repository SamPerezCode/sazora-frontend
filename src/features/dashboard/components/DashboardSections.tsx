import {
  Bike,
  Boxes,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { MetricCard } from "../../../components/ui/MetricCard";
import { MeterBar } from "../../../components/ui/MeterBar";
import type { DashboardData } from "../types/dashboard.types";
import {
  money,
  ORDER_STATUS,
  quantity,
  SERVICE_TYPE,
  UNITS,
  variation,
} from "../utils/dashboard-format";

interface DashboardSectionProps {
  data: DashboardData;
}

export function DashboardSummary({ data }: DashboardSectionProps) {
  const summary = data.summary;
  const currency = data.business.currencyCode;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Ventas de hoy"
        value={money(summary.todaySales, currency)}
        description={variation(summary.salesVariationPercentage)}
        icon={TrendingUp}
      />

      <MetricCard
        label="Cuentas abiertas"
        value={quantity(summary.openOrders)}
        description="Cuentas sin cerrar"
        icon={ReceiptText}
      />

      <MetricCard
        label="Domicilios activos"
        value={quantity(summary.activeDeliveries)}
        description={
          summary.averageDeliveryMinutes === null
            ? "Sin entregas completadas hoy"
            : `Prom. ${quantity(summary.averageDeliveryMinutes)} min en entregas de hoy`
        }
        icon={Bike}
      />

      <MetricCard
        label="Comensales atendidos"
        value={quantity(summary.servedCustomers)}
        description={`Ticket medio ${money(summary.averageTicket, currency)}`}
        icon={Users}
      />
    </div>
  );
}

export function TopProductsCard({ data }: DashboardSectionProps) {
  const maximum = Math.max(
    0,
    ...data.topProducts.map((product) => product.quantitySold)
  );

  return (
    <Card aria-label="Productos más vendidos">
      <h2 className="text-base font-bold text-heading">
        Más vendidos
      </h2>

      {data.topProducts.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          Todavía no hay productos vendidos esta semana.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {data.topProducts.map((product) => (
            <li key={product.productId}>
              <div className="mb-2 flex items-start justify-between gap-3 text-xs">
                <span className="font-medium text-heading">
                  {product.productName}
                </span>

                <span className="shrink-0 tabular-nums text-muted">
                  {quantity(product.quantitySold)} und
                </span>
              </div>

              <MeterBar
                percentage={
                  maximum > 0
                    ? (product.quantitySold / maximum) * 100
                    : 0
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OrdersInProgressCard({
  data,
}: DashboardSectionProps) {
  return (
    <Card aria-label="Pedidos en curso">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-heading">
          Pedidos en curso
        </h2>

        <button
          type="button"
          disabled
          title="El módulo de pedidos aún no está disponible"
          className="min-h-11 text-xs text-accent opacity-60"
        >
          Todos
        </button>
      </div>

      {data.ordersInProgress.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No hay pedidos en curso.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-outline/60">
          {data.ordersInProgress.map((order) => {
            const detail =
              order.serviceType === "TABLE"
                ? (order.restaurantTableName ??
                  order.restaurantTableCode)
                : order.serviceType === "DELIVERY"
                  ? (order.deliveryAddress ?? order.customerName)
                  : order.customerName;

            return (
              <li
                key={order.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading">
                    #{order.id} · {SERVICE_TYPE[order.serviceType]}
                  </p>

                  <p className="mt-1 break-words text-xs text-muted">
                    {detail ? `${detail} · ` : ""}
                    {quantity(order.itemCount)} productos
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="rounded-full bg-secondary px-2 py-1 text-[0.625rem] font-semibold uppercase text-heading">
                    {ORDER_STATUS[order.status]}
                  </span>

                  <p className="mt-2 text-xs tabular-nums text-muted">
                    {money(
                      order.subtotal,
                      data.business.currencyCode
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data.summary.openOrders > data.ordersInProgress.length && (
        <p className="mt-3 text-xs text-muted">
          Mostrando {data.ordersInProgress.length} de{" "}
          {quantity(data.summary.openOrders)} cuentas abiertas.
        </p>
      )}
    </Card>
  );
}

export function CriticalInventoryCard({
  data,
}: DashboardSectionProps) {
  return (
    <Card aria-label="Inventario crítico">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-heading">
          <Boxes
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
            className="text-accent"
          />
          Inventario crítico
        </h2>

        <button
          type="button"
          disabled
          title="El módulo de inventario aún no está disponible"
          className="min-h-11 text-xs text-accent opacity-60"
        >
          Gestionar
        </button>
      </div>

      {data.criticalInventory.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No hay insumos en nivel crítico.
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {data.criticalInventory.map((item) => {
            const depleted = Number(item.currentStock) <= 0;

            return (
              <li key={item.inventoryItemId}>
                <div className="mb-2 flex items-start justify-between gap-3 text-xs">
                  <span className="font-medium text-heading">
                    {item.name}
                  </span>

                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      depleted ? "text-danger" : "text-accent"
                    }`}
                  >
                    {quantity(item.currentStock)}{" "}
                    {UNITS[item.baseUnit]}
                  </span>
                </div>

                <MeterBar
                  percentage={item.stockPercentage}
                  tone={depleted ? "danger" : "accent"}
                />

                <p className="mt-1 text-[0.625rem] text-muted">
                  Mínimo: {quantity(item.minimumStock)}{" "}
                  {UNITS[item.baseUnit]}
                  {depleted ? " · Sin existencias" : ""}
                  {item.stockPercentage === null
                    ? " · Sin proporción calculable"
                    : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
