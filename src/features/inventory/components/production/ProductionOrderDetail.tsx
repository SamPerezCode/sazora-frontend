import { useCallback } from "react";
import type { AuthSession } from "../../../auth/types/auth.types";
import { useInventoryQuery } from "../../hooks/useInventoryQuery";
import { quantity } from "../../utils/inventory-value";
import { Notice } from "../InventoryLocationUI";
import { Button } from "../InventoryButton";
import { InventoryResponsiveRecords as Records } from "../InventoryResponsiveRecords";
import { getOrderMovement } from "./production.queries";
import { productionRoles } from "./production.access";
import {
  timestamp,
  percentage,
  cost,
  cash,
} from "./production.utils";
import { StatusBadge, Metrics } from "./ProductionUI";
import type { OrderResources } from "./production.types";

export function ProductionOrderDetail({
  data,
  currency,
  zone,
  movement = false,
}: {
  data: OrderResources;
  currency: string;
  zone: string;
  movement?: boolean;
}) {
  const { order, performance, waste } = data;

  const loader = useCallback(
    async (session: AuthSession, signal: AbortSignal) =>
      movement ? getOrderMovement(session, signal, order) : null,
    [movement, order]
  );

  const ledger = useInventoryQuery(
    "order-movement:" + order.id + ":" + movement,
    loader,
    order.version,
    productionRoles
  );

  const metadata = [
    [
      "Responsable",
      order.completedByName ??
        order.startedByName ??
        order.createdByName,
    ],
    ["Fecha prevista", timestamp(order.plannedFor, zone)],
    [
      "Inicio",
      order.startedAt
        ? timestamp(order.startedAt, zone)
        : "No iniciada",
    ],
    [
      "Finalización",
      order.completedAt
        ? timestamp(order.completedAt, zone)
        : "No completada",
    ],
    ["Lotes", order.batchQuantity],
    ["Notas", order.notes || "Sin notas"],
  ];

  const common = (
    line:
      | (typeof performance.inputs)[number]
      | (typeof performance.outputs)[number]
  ) => [
    {
      label: "Artículo / SKU",
      value: (
        <div>
          {line.inventoryItemName}
          <p className="text-xs text-muted">
            {line.inventoryItemSku || "Sin SKU"}
          </p>
        </div>
      ),
    },
    {
      label: "Planificada",
      value: quantity(line.plannedQuantity, line.baseUnit),
    },
    {
      label: "Real",
      value:
        line.actualQuantity === null
          ? "Pendiente"
          : quantity(line.actualQuantity, line.baseUnit),
    },
    {
      label: "Diferencia",
      value:
        line.differenceQuantity === null
          ? "—"
          : quantity(line.differenceQuantity, line.baseUnit),
    },
    {
      label: "Variación",
      value: percentage(line.variationPercentage),
    },
  ];

  return (
    <div className="grid min-w-0 gap-5">
      <p className="text-sm text-muted">
        {order.recipe.code} · {order.recipe.name} · Versión{" "}
        {order.version}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={order.status} />
        <p>
          {order.location.name} · {order.location.code}
        </p>
      </div>

      <dl className="grid gap-4 md:grid-cols-3">
        {metadata.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="m-0 mt-1 text-sm [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {order.status === "CANCELLED" && (
        <Notice>
          Cancelada por {order.cancelledByName || "—"}
          {" · "}
          {timestamp(order.cancelledAt, zone)}. Motivo:{" "}
          {order.cancellationReason || "—"}
        </Notice>
      )}

      {movement ? (
        <>
          {ledger.pending && (
            <Notice>Consultando movimiento valorizado…</Notice>
          )}
          {ledger.error && (
            <Notice>
              {ledger.error}{" "}
              <Button variant="secondary" onClick={ledger.refresh}>
                Reintentar
              </Button>
            </Notice>
          )}

          {!ledger.pending && !ledger.error && ledger.data && (
            <>
              <Notice>
                Movimiento M-{ledger.data.id}
                {" · "}
                {timestamp(ledger.data.createdAt, zone)}
                {" · "}
                {ledger.data.createdByName}
              </Notice>

              <Records
                label="Movimiento valorizado"
                rows={ledger.data.lines.map((line) => ({
                  id: line.id,
                  fields: [
                    {
                      label: "Artículo",
                      value: line.inventoryItemName,
                    },
                    {
                      label: "Dirección",
                      value:
                        line.direction === "IN"
                          ? "Entrada"
                          : "Salida",
                    },
                    {
                      label: "Cantidad",
                      value: quantity(line.quantity, line.baseUnit),
                    },
                    {
                      label: "Costo unitario",
                      value: cost(
                        line.unitCost,
                        line.baseUnit,
                        currency
                      ),
                    },
                    {
                      label: "Valor",
                      value: cash(line.totalCost, currency),
                    },
                    {
                      label: "Saldo anterior",
                      value: quantity(
                        line.balanceBefore,
                        line.baseUnit
                      ),
                    },
                    {
                      label: "Saldo resultante",
                      value: quantity(
                        line.balanceAfter,
                        line.baseUnit
                      ),
                    },
                  ],
                }))}
              />
            </>
          )}
        </>
      ) : (
        <>
          <h3 className="font-semibold">Insumos</h3>
          <Records
            label="Insumos de producción"
            rows={performance.inputs.map((line) => ({
              id: line.inventoryItemId,
              fields: [
                ...common(line),
                {
                  label: "Costo unitario",
                  value: cost(
                    line.actualUnitCost,
                    line.baseUnit,
                    currency
                  ),
                },
                {
                  label: "Costo esperado",
                  value: cash(
                    line.expectedCostAtActualRate,
                    currency
                  ),
                },
                {
                  label: "Costo real",
                  value: cash(line.actualCost, currency),
                },
              ],
            }))}
          />

          <h3 className="font-semibold">Productos obtenidos</h3>
          <Records
            label="Productos obtenidos"
            rows={performance.outputs.map((line) => ({
              id: line.inventoryItemId,
              fields: [
                ...common(line),
                {
                  label: "Rendimiento",
                  value: percentage(line.yieldPercentage),
                },
                {
                  label: "Costo %",
                  value: percentage(line.costAllocationPercentage),
                },
                {
                  label: "Costo unitario resultante",
                  value: cost(
                    line.actualUnitCost,
                    line.baseUnit,
                    currency
                  ),
                },
                {
                  label: "Valor producido",
                  value: cash(line.actualCost, currency),
                },
              ],
            }))}
          />

          <Metrics
            rows={[
              {
                label: "Costo esperado al promedio de ejecución",
                value: cash(
                  performance.summary.expectedInputCostAtActualRate,
                  currency
                ),
              },
              {
                label: "Costo real de insumos",
                value: cash(
                  performance.summary.actualInputCost,
                  currency
                ),
              },
              {
                label: "Variación de costo",
                value: cash(
                  performance.summary.inputCostDifference,
                  currency
                ),
              },
              {
                label: "Desperdicio explícito",
                value: cash(
                  performance.summary.declaredWasteCost,
                  currency
                ),
              },
              {
                label: "Costo total de recursos",
                value: cash(
                  performance.summary.totalResourceCost,
                  currency
                ),
              },
              {
                label: "Valor producido",
                value: cash(
                  performance.summary.producedInventoryValue,
                  currency
                ),
              },
            ]}
          />

          <h3 className="font-semibold">Desperdicios explícitos</h3>
          {!waste.length && (
            <div className="rounded-xl border border-outline p-8 text-center text-muted">
              Sin desperdicios registrados
            </div>
          )}

          <Records
            label="Desperdicios registrados"
            rows={waste.flatMap((record) =>
              record.lines.map((line) => ({
                id: record.id + ":" + line.id,
                fields: [
                  {
                    label: "Artículo / SKU",
                    value:
                      line.inventoryItemName +
                      " · " +
                      (line.inventoryItemSku || "Sin SKU"),
                  },
                  {
                    label: "Cantidad",
                    value: quantity(line.quantity, line.baseUnit),
                  },
                  {
                    label: "Costo",
                    value: cash(line.totalCost, currency),
                  },
                  { label: "Motivo", value: record.reason },
                  { label: "Notas", value: line.notes || "—" },
                  {
                    label: "Responsable",
                    value: record.recordedByName,
                  },
                  {
                    label: "Fecha",
                    value: timestamp(record.createdAt, zone),
                  },
                  {
                    label: "Movimiento",
                    value: "M-" + record.inventoryMovementId,
                  },
                ],
              }))
            )}
          />

          <section className="grid gap-3 border-t border-outline pt-4 text-sm text-muted">
            <h3 className="font-semibold text-heading">
              Trazabilidad
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <p>
                Creada por: {order.createdByName}
                {" · "}
                {timestamp(order.createdAt, zone)}
              </p>
              <p>
                Iniciada por: {order.startedByName || "Pendiente"}
              </p>
              <p>
                Completada por: {order.completedByName || "Pendiente"}
              </p>
              <p>
                Movimiento relacionado:{" "}
                {order.inventoryMovementId
                  ? "M-" + order.inventoryMovementId
                  : "Sin aplicar"}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
