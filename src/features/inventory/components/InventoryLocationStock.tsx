import { Fragment, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  PackagePlus,
  Scale,
  ArrowLeftRight,
  Power,
  FilterX,
} from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Button } from "./InventoryButton";
import { Pagination } from "../../../components/ui/Pagination";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import type { ItemAction } from "./InventoryItemLocationDialog";
import type { Balance } from "../schemas/inventory-location.schema";
import { useSearchParams } from "react-router";
import {
  aggregate,
  canValue,
  cost,
  fixed,
  money,
  physical,
  quantity,
  unvalued,
} from "../utils/inventory-value";
import {
  itemTypeLabels,
  searchKey,
  unitLabels,
} from "../utils/inventory-format";
import {
  Choice,
  DataTable,
  Field,
  Notice,
  StockBadge,
} from "./InventoryLocationUI";

export function InventoryLocationStock({
  data,
  locationId,
  currency,
  onAction,
  onMovement,
}: {
  data: InventoryWorkspace;
  locationId: string;
  currency: string;
  onAction: (action: ItemAction) => void;
  onMovement: (itemId: string, locationId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [physicalFilter, setPhysical] = useState("");
  const [valuation, setValuation] = useState("");
  const [activity, setActivity] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [, setParams] = useSearchParams();

  const groups = data.items
    .map((item) => {
      const rows = data.balances.filter(
        (balance) =>
          balance.inventoryItemId === item.id &&
          (!locationId || balance.location.id === locationId)
      );

      return { item, rows, total: aggregate(rows) };
    })
    .filter(
      ({ item, rows, total }) =>
        searchKey(item.name + " " + (item.sku ?? "")).includes(
          searchKey(search)
        ) &&
        (!type || item.itemType === type) &&
        (!activity || item.isActive === (activity === "active")) &&
        (!physicalFilter ||
          (physicalFilter === "negative"
            ? rows.some((balance) => fixed(balance.currentStock) < 0n)
            : rows.some(
                (balance) => balance.stockStatus === physicalFilter
              ))) &&
        (!valuation ||
          (valuation === "unvalued"
            ? total.hasUnvalued
            : rows.some(
                (balance) =>
                  !unvalued(balance) &&
                  fixed(balance.currentStock) !== 0n
              )))
    );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(groups.length / pageSize))
  );

  const change =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
    };

  function actions(
    itemId: string,
    isActive: boolean,
    rows: Balance[],
    selectedLocation: string
  ) {
    return (
      <ActionMenu
        appearance="compact"
        label="Acciones del artículo"
        actions={[
          {
            id: "detail",
            label: "Ver detalle",
            icon: <Eye size={18} />,
            onSelect: () =>
              onAction({
                kind: "detail",
                itemId,
                locationId: selectedLocation,
              }),
          },
          {
            id: "edit",
            label: "Editar información y mínimo",
            icon: <Pencil size={18} />,
            onSelect: () =>
              onAction({
                kind: "edit",
                itemId,
                locationId: selectedLocation,
              }),
          },
          ...(isActive
            ? [
                {
                  id: "presentation",
                  label: "Agregar presentación",
                  icon: <PackagePlus size={18} />,
                  onSelect: () =>
                    onAction({
                      kind: "presentation",
                      itemId,
                      locationId: selectedLocation,
                    }),
                },
              ]
            : []),
          ...(rows.some(canValue)
            ? [
                {
                  id: "valuation",
                  label: "Valorar existencia inicial",
                  icon: <Scale size={18} />,
                  onSelect: () =>
                    onAction({
                      kind: "valuation",
                      itemId,
                      locationId: selectedLocation,
                    }),
                },
              ]
            : []),
          ...(isActive
            ? [
                {
                  id: "movement",
                  label: "Registrar movimiento",
                  icon: <ArrowLeftRight size={18} />,
                  onSelect: () =>
                    onMovement(itemId, selectedLocation),
                },
              ]
            : []),
          {
            id: "kardex",
            label: "Ver kardex",
            icon: <BookOpen size={18} />,
            onSelect: () =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);

                next.set("tab", "kardex");
                next.set("inventoryItemId", itemId);

                if (selectedLocation) {
                  next.set("locationId", selectedLocation);
                } else {
                  next.delete("locationId");
                }

                return next;
              }),
          },
          {
            id: "status",
            label: isActive
              ? "Desactivar artículo"
              : "Activar artículo",
            icon: <Power size={18} />,
            danger: isActive,
            separatorBefore: true,
            onSelect: () =>
              onAction({
                kind: "status",
                itemId,
                locationId: selectedLocation,
              }),
          },
        ]}
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-4 border-b border-outline pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <Field
              label="Buscar"
              value={search}
              onChange={change(setSearch)}
            />
          </div>

          <Button
            variant="soft"
            onClick={() => {
              setSearch("");
              setType("");
              setPhysical("");
              setValuation("");
              setActivity("");
              setPage(1);
            }}
          >
            <FilterX size={16} />
            Limpiar filtros
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Choice
            label="Tipo de artículo"
            value={type}
            onValueChange={change(setType)}
            options={[
              { value: "", label: "Todos los tipos" },
              ...Object.entries(itemTypeLabels).map(
                ([value, label]) => ({ value, label })
              ),
            ]}
          />

          <Choice
            label="Estado físico"
            value={physicalFilter}
            onValueChange={change(setPhysical)}
            options={[
              { value: "", label: "Todos los estados físicos" },
              { value: "AVAILABLE", label: "Disponible" },
              { value: "LOW_STOCK", label: "Bajo mínimo" },
              { value: "OUT_OF_STOCK", label: "Agotado" },
              { value: "negative", label: "Saldo negativo" },
            ]}
          />

          <Choice
            label="Estado de valoración"
            value={valuation}
            onValueChange={change(setValuation)}
            options={[
              { value: "", label: "Toda valoración" },
              { value: "valued", label: "Valorado con existencias" },
              { value: "unvalued", label: "Sin valorar" },
            ]}
          />

          <Choice
            label="Estado del artículo"
            value={activity}
            onValueChange={change(setActivity)}
            options={[
              { value: "", label: "Activos e inactivos" },
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Inactivos" },
            ]}
          />
        </div>
      </div>

      {!locationId && (
        <Notice>
          Vista consolidada de consulta. Cada artículo conserva sus
          saldos y costos por ubicación.
        </Notice>
      )}

      <DataTable
        headers={[
          "Artículo",
          "SKU",
          "Tipo / unidad",
          "Ubicación",
          "Existencia",
          "Mínimo local",
          "Costo promedio",
          "Valor",
          "Estado físico",
          "Valoración",
          "Acciones",
        ]}
      >
        {groups
          .slice((current - 1) * pageSize, current * pageSize)
          .map(({ item, rows, total }) => (
            <Fragment key={item.id}>
              <tr>
                <td>
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-2 text-left font-semibold"
                    disabled={!!locationId || !rows.length}
                    aria-expanded={
                      !locationId
                        ? expanded.includes(item.id)
                        : undefined
                    }
                    onClick={() =>
                      setExpanded((previous) =>
                        previous.includes(item.id)
                          ? previous.filter((id) => id !== item.id)
                          : [...previous, item.id]
                      )
                    }
                  >
                    {!locationId &&
                      (expanded.includes(item.id) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      ))}
                    {item.name}
                  </button>

                  {!item.isActive && (
                    <small className="text-muted">Inactivo</small>
                  )}
                </td>

                <td>{item.sku ?? "—"}</td>
                <td>
                  {itemTypeLabels[item.itemType]}
                  <small className="block text-muted">
                    {unitLabels[item.baseUnit]}
                  </small>
                </td>
                <td>
                  {locationId
                    ? data.locations.find(
                        (location) => location.id === locationId
                      )?.name
                    : "Consolidado"}
                </td>
                <td>{quantity(total.currentStock, item.baseUnit)}</td>
                <td>{quantity(total.minimumStock, item.baseUnit)}</td>
                <td>
                  {total.hasUnvalued
                    ? "Sin valorar"
                    : cost(
                        locationId
                          ? (rows[0]?.averageUnitCost ?? null)
                          : total.averageUnitCost,
                        item.baseUnit,
                        currency
                      )}
                </td>
                <td>
                  {money(
                    locationId &&
                      rows[0] &&
                      fixed(rows[0].currentStock) !== 0n
                      ? rows[0].inventoryValue
                      : total.inventoryValue,
                    currency
                  )}

                  {(!total.complete || total.hasUnvalued) && (
                    <small className="block text-muted">
                      Valor conocido parcial
                    </small>
                  )}
                </td>
                <td>
                  <StockBadge
                    label={
                      locationId && rows[0]
                        ? physical(rows[0])
                        : physical(total)
                    }
                  />

                  {!locationId && total.problems > 0 && (
                    <small className="block text-muted">
                      {total.problems} ubicaciones requieren atención
                    </small>
                  )}
                </td>
                <td>
                  {total.hasUnvalued
                    ? "Sin valorar"
                    : fixed(total.currentStock) === 0n
                      ? "Sin existencias"
                      : total.averageUnitCost === null
                        ? "Sin costo vigente"
                        : "Valorado"}
                </td>
                <td>
                  {actions(item.id, item.isActive, rows, locationId)}
                </td>
              </tr>

              {!locationId &&
                expanded.includes(item.id) &&
                rows.map((balance) => (
                  <tr
                    key={balance.location.id}
                    className="bg-secondary/15"
                  >
                    <td className="text-muted">↳ {item.name}</td>
                    <td>{item.sku ?? "—"}</td>
                    <td>{unitLabels[item.baseUnit]}</td>
                    <td>
                      {balance.location.name} ·{" "}
                      {balance.location.code}
                    </td>
                    <td>
                      {quantity(
                        balance.currentStock,
                        balance.baseUnit
                      )}
                    </td>
                    <td>
                      {quantity(
                        balance.minimumStock,
                        balance.baseUnit
                      )}
                    </td>
                    <td>
                      {cost(
                        balance.averageUnitCost,
                        balance.baseUnit,
                        currency
                      )}
                    </td>
                    <td>
                      {money(
                        fixed(balance.currentStock) === 0n
                          ? "0"
                          : balance.inventoryValue,
                        currency
                      )}
                    </td>
                    <td>
                      <StockBadge label={physical(balance)} />
                    </td>
                    <td>
                      {unvalued(balance)
                        ? "Sin valorar"
                        : fixed(balance.currentStock) === 0n
                          ? "Sin existencias"
                          : "Valorado"}
                    </td>
                    <td>
                      {actions(
                        item.id,
                        item.isActive,
                        [balance],
                        balance.location.id
                      )}
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
      </DataTable>

      {!groups.length && (
        <Notice>
          No hay artículos que coincidan con los filtros.
        </Notice>
      )}

      <Pagination
        page={current}
        pageSize={pageSize}
        totalItems={groups.length}
        itemLabel="artículos"
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </div>
  );
}
