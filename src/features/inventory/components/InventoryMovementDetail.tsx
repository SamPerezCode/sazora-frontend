import { useCallback } from "react";
import type { ReactNode } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadMovement } from "../services/inventory-audit.service";
import {
  subtract,
  money,
  cost,
  quantity,
  unit,
} from "../utils/inventory-value";
import { movementLabels } from "../utils/inventory-audit";
import { formatQuantity } from "../utils/inventory-format";
import {
  allocationLabel,
  valuedTotal,
} from "../utils/inventory-production-view";
import { Button } from "./InventoryButton";
import { Modal, Notice } from "./InventoryLocationUI";
import { InventoryResponsiveRecords } from "./InventoryResponsiveRecords";

const field = (label: string, value: ReactNode) => ({
  label,
  value,
});

export function InventoryMovementDetail({
  id,
  production = false,
  currency,
  timezone,
  onClose,
}: {
  id: string;
  production?: boolean;
  currency: string;
  timezone: string;
  onClose: () => void;
}) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadMovement(session, signal, id, production),
    [id, production]
  );

  const query = useInventoryQuery(
    "movement-detail:" + production + ":" + id,
    loader
  );

  const movement = query.data;

  const inputs =
    movement?.lines.filter((line) => line.direction === "OUT") ?? [];

  const outputs =
    movement?.lines.filter((line) => line.direction === "IN") ?? [];

  const inputTotal = inputs.length
    ? valuedTotal(inputs)
    : production
      ? null
      : "0";

  const outputTotal = outputs.length
    ? valuedTotal(outputs)
    : production
      ? null
      : "0";

  const complete =
    !!movement?.lines.length &&
    inputTotal !== null &&
    outputTotal !== null;

  const impactRows = (movement?.lines ?? []).map((line) => ({
    id: line.id,
    fields: [
      field("Artículo", line.inventoryItemName),
      field(
        "Dirección",
        line.direction === "IN" ? "Entrada" : "Salida"
      ),
      field("Cantidad", formatQuantity(line.quantity)),
      field("Unidad", unit(line.baseUnit, line.quantity)),
      field(
        "Saldo anterior",
        quantity(line.balanceBefore, line.baseUnit)
      ),
      field(
        "Saldo resultante",
        quantity(line.balanceAfter, line.baseUnit)
      ),
      field(
        "Costo unitario",
        cost(line.unitCost, line.baseUnit, currency)
      ),
      field("Costo total", money(line.totalCost, currency)),
      field(
        "Valor anterior",
        money(line.inventoryValueBefore, currency)
      ),
      field(
        "Valor resultante",
        money(line.inventoryValueAfter, currency)
      ),
      ...(production
        ? [
            field(
              "Promedio anterior",
              cost(
                line.averageUnitCostBefore,
                line.baseUnit,
                currency
              )
            ),
            field(
              "Promedio nuevo",
              cost(line.averageUnitCostAfter, line.baseUnit, currency)
            ),
          ]
        : []),
    ],
  }));

  const outputRows = outputs.map((line) => ({
    id: line.id,
    fields: [
      field("Producto obtenido", line.inventoryItemName),
      field("Cantidad", quantity(line.quantity, line.baseUnit)),
      field(
        "Distribución calculada",
        allocationLabel(line, inputTotal)
      ),
      field(
        "Costo asignado",
        money(
          line.costStatus === "VALUED" ? line.totalCost : null,
          currency
        )
      ),
      field(
        "Costo unitario",
        cost(
          line.costStatus === "VALUED" ? line.unitCost : null,
          line.baseUnit,
          currency
        )
      ),
    ],
  }));

  return (
    <Modal
      wide
      title={
        production ? "Detalle de producción" : "Detalle de movimiento"
      }
      onClose={onClose}
      footer={
        <Button
          variant="soft"
          className="mb-[env(safe-area-inset-bottom)] min-h-11"
          onClick={onClose}
        >
          Cerrar
        </Button>
      }
    >
      {query.pending && <p role="status">Consultando detalle…</p>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="secondary" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {movement && !query.pending && !query.error && (
        <div className="grid min-w-0 gap-5">
          <p className="text-sm text-muted">
            M-{movement.id} · {movementLabels[movement.movementType]}
          </p>

          <dl className="grid min-w-0 gap-4 md:grid-cols-3">
            {Object.entries({
              Ubicación: movement.location
                ? movement.location.name +
                  " · " +
                  movement.location.code
                : "Sin ubicación histórica",

              "Fecha y hora": new Intl.DateTimeFormat("es-CO", {
                timeZone: timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(movement.createdAt)),

              Referencia: movement.externalReference ?? "—",
              Responsable: movement.createdByName,
              "Motivo / notas": movement.notes ?? "—",
              Estado: "Registrado",
            }).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs leading-5 text-muted">
                  {label}
                </dt>

                <dd className="m-0 mt-1 text-sm font-semibold [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {!complete && (
            <Notice>
              Este registro no tiene valoración completa. Los importes
              desconocidos se muestran con «—».
            </Notice>
          )}

          {!production && complete && (
            <Notice>
              Impacto neto:{" "}
              {money(subtract(outputTotal!, inputTotal!), currency)}
            </Notice>
          )}

          <h3 className="font-semibold">
            Impacto físico y económico
          </h3>

          <InventoryResponsiveRecords
            label="Impacto físico y económico"
            rows={impactRows}
            wide
          />

          {!impactRows.length && (
            <Notice>Este registro no tiene líneas.</Notice>
          )}

          {production && (
            <>
              <div className="min-w-0 rounded-2xl border border-outline bg-surface p-4">
                <p className="text-sm text-muted">
                  Costo total de insumos
                </p>

                <p className="mt-2 text-2xl font-bold text-heading [overflow-wrap:anywhere]">
                  {inputTotal === null
                    ? "Sin valoración completa"
                    : money(inputTotal, currency)}
                </p>
              </div>

              <InventoryResponsiveRecords
                label="Productos obtenidos"
                rows={outputRows}
              />

              {!outputRows.length && (
                <Notice>
                  No hay productos obtenidos registrados.
                </Notice>
              )}

              {outputRows.length > 0 && (
                <p className="text-xs text-muted">
                  La distribución se calcula a partir de los costos
                  registrados; puede presentar diferencias de
                  redondeo.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
