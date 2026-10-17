import { Eye } from "lucide-react";

import { Button } from "../../components/ui/Button";

import {
  Panel,
  Metrics,
  Ranking,
  Empty,
  Notice,
  DataTable,
  Pager,
} from "./ReportUI";

import {
  amount,
  dateTime,
  eventLabels,
  minutes,
  modeLabels,
  number,
  serviceLabels,
  statusLabels,
} from "./reports.format";

import { UNITS, WEEKDAYS } from "../dashboard/utils/dashboard-format";

import type {
  DashboardResponse,
  SalesReportResponse,
  CancellationReportResponse,
  KitchenOperationReportResponse,
  CancellationEvent,
  KitchenTimingMetric,
} from "./reports.schema";

export type OrderSelection = {
  orderId: string;

  locationId: string;
  locationName: string;
  locationCode: string;

  restaurantTableId: string | null;
  restaurantTableName: string | null;
  restaurantTableCode: string | null;

  serviceType: "TABLE" | "TAKEAWAY" | "DELIVERY";
  event?: CancellationEvent;
};

export function Overview({ data: d }: { data: DashboardResponse }) {
  const s = d.summary;

  const money = (value: string) =>
    amount(value, d.business.currencyCode);

  const maximum = Math.max(
    1,
    ...d.weeklySales.map((day) => Number(day.total))
  );

  const inactive =
    !s.openOrders &&
    !s.closedOrders &&
    !s.activeDeliveries &&
    !d.ordersInProgress.length &&
    !d.topProducts.length &&
    d.weeklySales.every((day) => Number(day.total) === 0);

  return (
    <>
      {inactive && (
        <Empty>
          No hay actividad disponible para esta ubicación.
        </Empty>
      )}

      <Metrics
        items={[
          {
            label: "Ventas de hoy",
            value: money(s.todaySales),
            help: `Ayer: ${money(s.yesterdaySales)}`,
          },
          {
            label: "Variación respecto a ayer",
            value:
              s.salesVariationPercentage === null ? (
                "Sin base de comparación"
              ) : (
                <span
                  className={
                    Number(s.salesVariationPercentage) < 0
                      ? "rp-negative"
                      : ""
                  }
                >
                  {number(s.salesVariationPercentage)} %
                </span>
              ),
          },
          {
            label: "Órdenes abiertas",
            value: number(s.openOrders),
          },
          {
            label: "Órdenes cerradas",
            value: number(s.closedOrders),
          },
          {
            label: "Clientes atendidos",
            value: number(s.servedCustomers),
          },
          {
            label: "Ticket promedio",
            value: money(s.averageTicket),
          },
          {
            label: "Domicilios activos",
            value: number(s.activeDeliveries),
          },
          {
            label: "Tiempo promedio de domicilio",
            value: minutes(s.averageDeliveryMinutes),
          },
        ]}
      />

      <div className="rp-grid">
        <Panel title="Ventas de la semana">
          <p className="rp-muted">
            {d.period.weekStart} – {d.period.weekEnd}
          </p>

          <div className="rp-chart">
            {d.weeklySales.map((day) => (
              <div key={day.date}>
                <div className="rp-chart-track">
                  <span
                    tabIndex={0}
                    aria-label={`${day.date}: ${money(day.total)}`}
                    title={`${day.date}: ${money(day.total)}`}
                    style={{
                      height: `${Math.max(
                        0,
                        (Number(day.total) / maximum) * 100
                      )}%`,
                    }}
                  />
                </div>

                <small>{WEEKDAYS[day.weekday]}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Productos más vendidos">
          <Ranking
            items={d.topProducts.map((product) => ({
              id: product.productId,
              label: product.productName,
              value: product.quantitySold,
              display: `${number(product.quantitySold)} u.`,
              help: money(product.salesTotal),
            }))}
          />
        </Panel>

        <Panel title="Órdenes en curso">
          {d.ordersInProgress.length ? (
            <ul className="rp-list">
              {d.ordersInProgress.map((order) => (
                <li key={order.id}>
                  <div>
                    <strong>
                      #{order.id} ·{" "}
                      {order.restaurantTableName ??
                        serviceLabels[order.serviceType]}
                    </strong>

                    <small>
                      {order.locationName} ·{" "}
                      {dateTime(order.createdAt, d.business.timezone)}
                    </small>
                  </div>

                  <span>{money(order.subtotal)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No hay órdenes en curso.</Empty>
          )}
        </Panel>

        <Panel title="Inventario crítico">
          {d.dataScopes.criticalInventory === "BUSINESS" && (
            <Notice>
              El inventario crítico corresponde al total del negocio.
              El inventario por ubicación estará disponible en el
              módulo de inventario.
            </Notice>
          )}

          {d.criticalInventory.length ? (
            <ul className="rp-list">
              {d.criticalInventory.map((item) => (
                <li key={item.inventoryItemId}>
                  <span>{item.name}</span>

                  <small>
                    {number(item.currentStock)} {UNITS[item.baseUnit]}{" "}
                    · mín. {number(item.minimumStock)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No hay inventario crítico.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}

export function SalesView({
  data: d,
  onPage,
  onOrder,
}: {
  data: SalesReportResponse;
  onPage: (page: number) => void;
  onOrder: (row: OrderSelection) => void;
}) {
  const money = (value: string) =>
    amount(value, d.business.currencyCode);

  return (
    <>
      {d.financialSource === "CLOSED_ORDERS" && (
        <Notice>Los importes corresponden a órdenes cerradas.</Notice>
      )}

      <Metrics
        items={[
          {
            label: "Ventas totales",
            value: money(d.summary.salesTotal),
          },
          {
            label: "Órdenes cerradas",
            value: number(d.summary.orderCount),
          },
          {
            label: "Unidades vendidas",
            value: number(d.summary.unitsSold),
          },
          {
            label: "Ticket promedio",
            value: money(d.summary.averageTicket),
          },
        ]}
      />

      <div className="rp-grid">
        <Panel title="Por modalidad">
          <Ranking
            items={d.byServiceType.map((item) => ({
              id: item.serviceType,
              label: serviceLabels[item.serviceType],
              value: Number(item.salesTotal),
              display: money(item.salesTotal),
              help: `${number(item.orderCount)} órdenes · ${number(
                item.unitsSold
              )} unidades`,
            }))}
          />
        </Panel>

        <Panel title="Productos más vendidos">
          <Ranking
            items={d.topProducts.map((product) => ({
              id: product.productId,
              label: product.productName,
              value: product.quantitySold,
              display: `${number(product.quantitySold)} u.`,
              help: money(product.salesTotal),
            }))}
          />
        </Panel>
      </div>

      {d.scope.type === "BUSINESS" && d.byLocation.length > 0 && (
        <Panel title="Ventas por ubicación">
          <DataTable
            headers={[
              "Ubicación",
              "Ventas",
              "Órdenes",
              "Unidades",
              "Clientes",
              "Ticket promedio",
              "Participación",
            ]}
          >
            {d.byLocation.map((location) => (
              <tr key={location.locationId}>
                <td>
                  {location.locationName} · {location.locationCode}
                </td>
                <td>{money(location.salesTotal)}</td>
                <td>{number(location.orderCount)}</td>
                <td>{number(location.unitsSold)}</td>
                <td>{number(location.servedCustomers)}</td>
                <td>{money(location.averageTicket)}</td>
                <td>{number(location.salesPercentage)} %</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      )}

      <Panel title="Historial de ventas">
        {d.history.sales.length ? (
          <DataTable
            headers={[
              "Orden",
              "Fecha",
              "Ubicación",
              "Modalidad",
              "Mesa / entrega",
              "Responsable",
              "Clientes",
              "Unidades",
              "Importe",
              "Acción",
            ]}
          >
            {d.history.sales.map((order) => (
              <tr key={order.orderId}>
                <td>#{order.orderId}</td>
                <td>
                  {dateTime(order.closedAt, d.business.timezone)}
                </td>
                <td>{order.locationName}</td>
                <td>{serviceLabels[order.serviceType]}</td>
                <td>
                  {order.restaurantTableName ??
                    serviceLabels[order.serviceType]}
                </td>
                <td>{order.openedByName}</td>
                <td>{order.customerCount ?? "—"}</td>
                <td>{number(order.unitsSold)}</td>
                <td>{money(order.salesTotal)}</td>
                <td>
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => onOrder(order)}
                  >
                    <Eye size={16} aria-hidden="true" />
                    Ver detalle
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty>
            No hay ventas cerradas para los filtros seleccionados.
          </Empty>
        )}

        <Pager pagination={d.history.pagination} onPage={onPage} />
      </Panel>
    </>
  );
}

export function CancellationsView({
  data: d,
  onPage,
  onOrder,
}: {
  data: CancellationReportResponse;
  onPage: (page: number) => void;
  onOrder: (row: OrderSelection) => void;
}) {
  const s = d.summary;

  const money = (value: string) =>
    amount(value, d.business.currencyCode);

  return (
    <>
      <Metrics
        items={[
          {
            label: "Órdenes canceladas",
            value: number(s.cancelledOrderCount),
          },
          {
            label: "Órdenes afectadas",
            value: number(s.affectedOrderCount),
          },
          {
            label: "Eventos de cancelación",
            value: number(s.cancellationEventCount),
          },
          {
            label: "Productos cancelados completamente",
            value: number(s.fullyCancelledProductCount),
          },
          {
            label: "Cancelaciones parciales",
            value: number(s.partialCancellationCount),
          },
          {
            label: "Unidades canceladas",
            value: number(s.cancelledUnitCount),
          },
          {
            label: "Importe potencial afectado",
            value: money(s.affectedAmount),
            help: "Valor bruto, no reembolso",
          },
        ]}
      />

      <Notice>
        El importe afectado corresponde al valor bruto de los
        productos o unidades canceladas. No confirma que se haya
        realizado un reembolso.
      </Notice>

      {d.scope.type === "BUSINESS" && d.byLocation.length > 0 && (
        <Panel title="Cancelaciones por ubicación">
          <DataTable
            headers={[
              "Ubicación",
              "Órdenes canceladas",
              "Órdenes afectadas",
              "Eventos",
              "Unidades",
              "Importe afectado",
            ]}
          >
            {d.byLocation.map((location) => (
              <tr key={location.locationId}>
                <td>
                  {location.locationName} · {location.locationCode}
                </td>
                <td>{number(location.cancelledOrderCount)}</td>
                <td>{number(location.affectedOrderCount)}</td>
                <td>{number(location.cancellationEventCount)}</td>
                <td>{number(location.cancelledUnitCount)}</td>
                <td>{money(location.affectedAmount)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      )}

      <Panel title="Auditoría de cancelaciones">
        {d.history.cancellations.length ? (
          <DataTable
            headers={[
              "Fecha y hora",
              "Orden",
              "Ubicación",
              "Mesa / modalidad",
              "Producto",
              "Tipo",
              "Cantidad cancelada",
              "Cantidad restante",
              "Precio unitario",
              "Importe afectado",
              "Motivo",
              "Responsable",
              "Estado de la orden",
              "Acción",
            ]}
          >
            {d.history.cancellations.map((event) => (
              <tr key={event.eventId}>
                <td>
                  {dateTime(event.cancelledAt, d.business.timezone)}
                </td>
                <td>#{event.orderId}</td>
                <td>{event.locationName}</td>
                <td>
                  {event.restaurantTableName ??
                    serviceLabels[event.serviceType]}
                </td>
                <td>{event.productName}</td>
                <td>{eventLabels[event.eventType]}</td>
                <td>{number(event.cancelledQuantity)}</td>
                <td>
                  {event.remainingQuantity === null
                    ? "—"
                    : number(event.remainingQuantity)}
                </td>
                <td>{money(event.unitPrice)}</td>
                <td>{money(event.affectedAmount)}</td>
                <td>{event.reason || "—"}</td>
                <td>{event.cancelledByName}</td>
                <td>{statusLabels[event.orderStatus]}</td>
                <td>
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => onOrder({ ...event, event })}
                  >
                    <Eye size={16} aria-hidden="true" />
                    Ver orden
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty>
            No se registraron cancelaciones para los filtros
            seleccionados.
          </Empty>
        )}

        <Pager pagination={d.history.pagination} onPage={onPage} />
      </Panel>
    </>
  );
}

export function KitchenView({
  data: d,
}: {
  data: KitchenOperationReportResponse;
}) {
  const s = d.summary.overall;

  const metric = (label: string, value: KitchenTimingMetric) => ({
    label,
    value: minutes(
      value.sampleSize === 0 ? null : value.averageMinutes
    ),
    help: `Muestra: ${number(value.sampleSize)} productos`,
  });

  const comparison = (
    rows: {
      id: string;
      name: string;
      modes: KitchenOperationReportResponse["summary"]["byWorkflowMode"];
    }[]
  ) => (
    <DataTable
      headers={[
        "Grupo",
        "Modo",
        "Órdenes",
        "Comandas",
        "Productos",
        "Entregados",
        "Cancelados",
      ]}
    >
      {rows.flatMap((row) =>
        row.modes.map((mode) => (
          <tr key={row.id + mode.workflowMode}>
            <td>{row.name}</td>
            <td>{modeLabels[mode.workflowMode]}</td>
            <td>{number(mode.metrics.orderCount)}</td>
            <td>{number(mode.metrics.ticketCount)}</td>
            <td>{number(mode.metrics.itemCount)}</td>
            <td>{number(mode.metrics.deliveredItemCount)}</td>
            <td>{number(mode.metrics.cancelledItemCount)}</td>
          </tr>
        ))
      )}
    </DataTable>
  );

  return (
    <>
      {!s.itemCount && (
        <Empty>
          No hay actividad de cocina para los filtros seleccionados.
        </Empty>
      )}

      <Metrics
        items={[
          {
            label: "Órdenes",
            value: number(s.orderCount),
          },
          {
            label: "Comandas",
            value: number(s.ticketCount),
          },
          {
            label: "Productos enviados a cocina",
            value: number(s.itemCount),
          },
          {
            label: "Pendientes",
            value: number(s.pendingItemCount),
          },
          {
            label: "En preparación",
            value: number(s.inPreparationItemCount),
          },
          {
            label: "Listos",
            value: number(s.readyItemCount),
          },
          {
            label: "Entregados",
            value: number(s.deliveredItemCount),
          },
          {
            label: "Cancelados",
            value: number(s.cancelledItemCount),
          },
        ]}
      />

      <div className="rp-grid rp-timings">
        <Panel title="Comandas impresas y pantalla">
          <p className="rp-muted">
            {number(s.screenTracking.itemCount)} productos con
            seguimiento en pantalla
          </p>

          <Metrics
            items={[
              metric(
                "Espera antes de comenzar",
                s.screenTracking.queueTime
              ),
              metric(
                "Tiempo de preparación",
                s.screenTracking.preparationTime
              ),
              metric(
                "Listo hasta entrega",
                s.screenTracking.handoffTime
              ),
              metric("Ciclo total", s.screenTracking.totalCycleTime),
            ]}
          />

          <Notice>
            Estos tiempos se calculan con los cambios de estado reales
            registrados en la pantalla de cocina.
          </Notice>

          <Notice>
            Los productos listos para entregar no tienen tiempo de
            preparación, pero sí pueden participar en el tiempo de
            entrega.
          </Notice>
        </Panel>

        <Panel title="Solo comandas impresas">
          <p className="rp-muted">
            {number(s.printOnlyTracking.itemCount)} productos
          </p>

          <Metrics
            items={[
              metric(
                "Tiempo desde confirmación hasta entrega",
                s.printOnlyTracking.confirmationToDeliveryTime
              ),
            ]}
          />

          <Notice>
            En el modo de comandas impresas no se registran los pasos
            internos de preparación. El sistema solo puede medir el
            tiempo total hasta que el pedido se marca como entregado.
          </Notice>
        </Panel>
      </div>

      <Panel title="Comparativo por modo de cocina">
        <p className="rp-muted">
          Cada modo mide cosas distintas; sus tiempos no se combinan.
        </p>

        {d.summary.byWorkflowMode.length ? (
          comparison([
            {
              id: "mode",
              name: "Total",
              modes: d.summary.byWorkflowMode,
            },
          ])
        ) : (
          <Empty>Sin registros.</Empty>
        )}
      </Panel>

      {d.scope.type === "BUSINESS" && d.byLocation.length > 0 && (
        <Panel title="Comparativo por ubicación">
          {comparison(
            d.byLocation.map((location) => ({
              id: location.locationId,
              name:
                location.locationName + " · " + location.locationCode,
              modes: location.modes,
            }))
          )}
        </Panel>
      )}

      <Panel title="Comparativo por área de preparación">
        {d.byPreparationArea.length ? (
          comparison(
            d.byPreparationArea.map((area) => ({
              id: area.preparationAreaId,
              name: area.preparationAreaName,
              modes: area.modes,
            }))
          )
        ) : (
          <Empty>Sin registros por área.</Empty>
        )}
      </Panel>
    </>
  );
}
