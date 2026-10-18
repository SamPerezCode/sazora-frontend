import { useCallback, useState } from "react";
import { Eye, FilterX } from "lucide-react";
import type { AuthSession } from "../../auth/types/auth.types";
import { DateField } from "../../../components/forms/DateField";
import { calendarToday } from "../../../components/forms/calendar-date";
import { Pagination } from "../../../components/ui/Pagination";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadKardex } from "../services/inventory-audit.service";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { movementLabels } from "../utils/inventory-audit";
import { cost, money, quantity } from "../utils/inventory-value";
import { Button } from "./InventoryButton";
import { Choice, DataTable, Notice } from "./InventoryLocationUI";
import { InventoryMovementDetail } from "./InventoryMovementDetail";

export function InventoryKardex({
  data,
  locationId,
  initialItemId,
  currency,
  timezone,
  revision,
}: {
  data: InventoryWorkspace;
  locationId: string;
  initialItemId: string;
  currency: string;
  timezone: string;
  revision: number;
}) {
  const today = calendarToday(timezone);

  const defaults = {
    from: today.slice(0, 7) + "-01",
    to: today,
    inventoryItemId: initialItemId,
    movementType: "",
  };

  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState({
    ...defaults,
    page: 1,
    pageSize: 20,
  });
  const [opened, setOpened] = useState("");

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadKardex(session, signal, {
        ...filters,
        locationId,
      }),
    [filters, locationId]
  );

  const query = useInventoryQuery(
    JSON.stringify(["kardex", filters, locationId]),
    loader,
    revision
  );

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DateField
          label="Desde"
          value={draft.from}
          max={draft.to}
          clearable={false}
          timeZone={timezone}
          onValueChange={(from) =>
            setDraft((previous) => ({ ...previous, from }))
          }
        />

        <DateField
          label="Hasta"
          value={draft.to}
          min={draft.from}
          clearable={false}
          timeZone={timezone}
          onValueChange={(to) =>
            setDraft((previous) => ({ ...previous, to }))
          }
        />

        <Choice
          label="Artículo"
          value={draft.inventoryItemId}
          onValueChange={(inventoryItemId) =>
            setDraft((previous) => ({
              ...previous,
              inventoryItemId,
            }))
          }
          options={[
            { value: "", label: "Todos los artículos" },
            ...data.items.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
        />

        <Choice
          label="Tipo de movimiento"
          value={draft.movementType}
          onValueChange={(movementType) =>
            setDraft((previous) => ({
              ...previous,
              movementType,
            }))
          }
          options={[
            { value: "", label: "Todos los tipos" },
            ...Object.entries(movementLabels).map(
              ([value, label]) => ({ value, label })
            ),
          ]}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            const value = {
              ...defaults,
              inventoryItemId: "",
            };

            setDraft(value);
            setFilters({
              ...value,
              page: 1,
              pageSize: filters.pageSize,
            });
          }}
        >
          <FilterX size={17} />
          Limpiar filtros
        </Button>

        <Button
          disabled={!draft.from || !draft.to || draft.from > draft.to}
          onClick={() =>
            setFilters({
              ...draft,
              page: 1,
              pageSize: filters.pageSize,
            })
          }
        >
          Aplicar filtros
        </Button>
      </div>

      <Notice>
        Los saldos y costos corresponden a cada artículo y ubicación.
        Las cantidades de unidades diferentes no se suman.
      </Notice>

      {query.pending && <Notice>Consultando kardex…</Notice>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="secondary" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!query.pending && !query.error && query.data && (
        <>
          <DataTable
            headers={[
              "Fecha",
              "Artículo",
              "Ubicación",
              "Tipo",
              "Entrada",
              "Salida",
              "Saldo anterior",
              "Saldo posterior",
              "Costo unitario",
              "Costo total",
              "Promedio anterior",
              "Promedio nuevo",
              "Valoración",
              "Acción",
            ]}
          >
            {query.data.entries.map((entry) => (
              <tr key={entry.movementLineId}>
                <td>
                  {new Intl.DateTimeFormat("es-CO", {
                    timeZone: timezone,
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(entry.createdAt))}
                </td>
                <td>{entry.inventoryItemName}</td>
                <td>
                  {entry.location
                    ? entry.location.name +
                      " · " +
                      entry.location.code
                    : "Sin ubicación histórica"}
                </td>
                <td>{movementLabels[entry.movementType]}</td>
                <td>
                  {entry.direction === "IN"
                    ? quantity(entry.quantity, entry.baseUnit)
                    : "—"}
                </td>
                <td>
                  {entry.direction === "OUT"
                    ? quantity(entry.quantity, entry.baseUnit)
                    : "—"}
                </td>
                <td>
                  {quantity(entry.balanceBefore, entry.baseUnit)}
                </td>
                <td>
                  {quantity(entry.balanceAfter, entry.baseUnit)}
                </td>
                <td>
                  {cost(entry.unitCost, entry.baseUnit, currency)}
                </td>
                <td>{money(entry.totalCost, currency)}</td>
                <td>
                  {cost(
                    entry.averageUnitCostBefore,
                    entry.baseUnit,
                    currency
                  )}
                </td>
                <td>
                  {cost(
                    entry.averageUnitCostAfter,
                    entry.baseUnit,
                    currency
                  )}
                </td>
                <td>
                  {entry.costStatus === "VALUED"
                    ? "Valorado"
                    : "Histórico sin valorar"}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => setOpened(entry.movementId)}
                  >
                    <Eye size={16} />
                    Ver detalle
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>

          {!query.data.entries.length && (
            <Notice>No hay movimientos para estos filtros.</Notice>
          )}

          <Pagination
            page={filters.page}
            pageSize={filters.pageSize}
            totalItems={query.data.pagination.total}
            itemLabel="líneas"
            onPageChange={(page) =>
              setFilters((previous) => ({ ...previous, page }))
            }
            onPageSizeChange={(pageSize) =>
              setFilters((previous) => ({
                ...previous,
                pageSize,
                page: 1,
              }))
            }
          />
        </>
      )}

      {opened && (
        <InventoryMovementDetail
          id={opened}
          currency={currency}
          timezone={timezone}
          onClose={() => setOpened("")}
        />
      )}
    </div>
  );
}
