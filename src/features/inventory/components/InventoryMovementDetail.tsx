import { useCallback } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadMovement } from "../services/inventory-audit.service";
import {
  add,
  subtract,
  money,
  cost,
  quantity,
} from "../utils/inventory-value";
import { movementLabels } from "../utils/inventory-audit";
import { Button } from "./InventoryButton";
import { DataTable, Modal, Notice } from "./InventoryLocationUI";

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
  const known = movement?.lines.every(
    (line) => line.totalCost !== null
  );

  const outgoing = movement
    ? add(
        ...movement.lines
          .filter((line) => line.direction === "OUT")
          .map((line) => line.totalCost ?? "0")
      )
    : "0";

  const incoming = movement
    ? add(
        ...movement.lines
          .filter((line) => line.direction === "IN")
          .map((line) => line.totalCost ?? "0")
      )
    : "0";

  return (
    <Modal
      wide
      title={
        production ? "Detalle de producción" : "Detalle de movimiento"
      }
      onClose={onClose}
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

      {movement && (
        <div className="grid gap-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            {Object.entries({
              Registro: "M-" + movement.id,
              Tipo: movementLabels[movement.movementType],
              Ubicación: movement.location
                ? movement.location.name +
                  " · " +
                  movement.location.code
                : "Sin ubicación histórica",
              Fecha: new Intl.DateTimeFormat("es-CO", {
                timeZone: timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(movement.createdAt)),
              Responsable: movement.createdByName,
              Referencia: movement.externalReference ?? "—",
              Notas: movement.notes ?? "—",
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <Notice>
            {known
              ? (movement.movementType === "PRODUCTION"
                  ? "Costo trasladado: " +
                    money(outgoing, currency) +
                    ". "
                  : "") +
                "Impacto neto: " +
                money(subtract(incoming, outgoing), currency)
              : "Este registro contiene líneas históricas sin valoración. No es posible calcular su impacto económico completo."}
          </Notice>

          <DataTable
            headers={[
              "Artículo",
              "Operación",
              "Cantidad",
              "Saldo anterior",
              "Saldo resultante",
              "Costo unitario",
              "Costo total",
              "Promedio anterior",
              "Promedio nuevo",
              "Valor anterior",
              "Valor resultante",
            ]}
          >
            {movement.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.inventoryItemName}</td>
                <td>
                  {line.direction === "IN"
                    ? production
                      ? "Obtenido"
                      : "Entrada"
                    : production
                      ? "Consumido"
                      : "Salida"}
                </td>
                <td>{quantity(line.quantity, line.baseUnit)}</td>
                <td>{quantity(line.balanceBefore, line.baseUnit)}</td>
                <td>{quantity(line.balanceAfter, line.baseUnit)}</td>
                <td>
                  {cost(line.unitCost, line.baseUnit, currency)}
                </td>
                <td>{money(line.totalCost, currency)}</td>
                <td>
                  {cost(
                    line.averageUnitCostBefore,
                    line.baseUnit,
                    currency
                  )}
                </td>
                <td>
                  {cost(
                    line.averageUnitCostAfter,
                    line.baseUnit,
                    currency
                  )}
                </td>
                <td>{money(line.inventoryValueBefore, currency)}</td>
                <td>{money(line.inventoryValueAfter, currency)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </Modal>
  );
}
