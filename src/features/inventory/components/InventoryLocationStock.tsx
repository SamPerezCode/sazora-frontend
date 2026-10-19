import { Fragment, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Search,
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
  const [params, setParams] = useSearchParams();

  const [attention, setAttention] = useState(
    () => params.get("stockReview") === "attention"
  );

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const [physicalFilter, setPhysical] = useState(() =>
    params.get("stockReview") === "negative" ? "negative" : ""
  );

  const [valuation, setValuation] = useState(() =>
    params.get("stockReview") === "unvalued" ? "unvalued" : ""
  );

  const [activity, setActivity] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        (!attention ||
          rows.some(
            (row) => unvalued(row) || fixed(row.currentStock) < 0n
          )) &&
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
    <div className="inventory-stock grid min-w-0 gap-5">
      {attention && (
        <Notice>
          Mostrando artículos con existencias sin costo o saldos
          negativos.
        </Notice>
      )}
      <div className="grid gap-4 border-b border-outline pb-5">
        <div className="grid min-w-0 grid-cols-1 items-end gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid min-w-0 gap-2 text-[14px] text-heading">
            <span>Buscar</span>

            <span className="relative block min-w-0">
              <Search
                size={18}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  change(setSearch)(event.target.value)
                }
                placeholder="Buscar artículo o SKU"
                autoComplete="off"
                className="block h-9 w-full min-w-0 rounded-xl border border-outline bg-surface pr-3 pl-10 text-[14px] text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:h-10 sm:text-[16px]"
              />
            </span>
          </label>

          <Button
            variant="ghost"
            className="justify-self-end"
            onClick={() => {
              setSearch("");
              setType("");
              setPhysical("");
              setValuation("");
              setActivity("");
              setAttention(false);
              setPage(1);

              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);

                  next.delete("stockReview");

                  return next;
                },
                { replace: true }
              );
            }}
          >
            <FilterX size={16} aria-hidden />
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
      <div className="hidden min-w-0 lg:block [&_table]:min-w-[1180px]">
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
                    {locationId ? (
                      <span className="font-semibold">
                        {item.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-expanded={expanded.includes(item.id)}
                        aria-label={
                          (expanded.includes(item.id)
                            ? "Ocultar"
                            : "Mostrar") +
                          " saldos por ubicación de " +
                          item.name
                        }
                        onClick={() =>
                          setExpanded((previous) =>
                            previous.includes(item.id)
                              ? previous.filter(
                                  (id) => id !== item.id
                                )
                              : [...previous, item.id]
                          )
                        }
                      >
                        <ChevronDown
                          size={16}
                          aria-hidden
                          className={
                            "shrink-0 transition-transform motion-reduce:transition-none " +
                            (expanded.includes(item.id)
                              ? "rotate-180"
                              : "")
                          }
                        />

                        <span>{item.name}</span>
                      </button>
                    )}

                    {!item.isActive && (
                      <small className="block text-muted">
                        Inactivo
                      </small>
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
                  <td>
                    {quantity(total.currentStock, item.baseUnit)}
                  </td>
                  <td>
                    {quantity(total.minimumStock, item.baseUnit)}
                  </td>
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
                        {total.problems} ubicaciones requieren
                        atención
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
                    {actions(
                      item.id,
                      item.isActive,
                      rows,
                      locationId
                    )}
                  </td>
                </tr>

                {!locationId &&
                  expanded.includes(item.id) &&
                  rows.length === 0 && (
                    <tr className="bg-secondary/15">
                      <td colSpan={11}>
                        <Notice>
                          Este artículo todavía no tiene saldos por
                          ubicación.
                        </Notice>
                      </td>
                    </tr>
                  )}

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
      </div>
      <div className="grid min-w-0 gap-3 lg:hidden">
        {groups
          .slice((current - 1) * pageSize, current * pageSize)
          .map(({ item, rows, total }, index) => {
            const open = expanded.includes(item.id);

            const local = data.locations.find(
              (location) => location.id === locationId
            );

            const locationLabel = locationId
              ? [local?.name, local?.code].filter(Boolean).join(" · ")
              : "Consolidado";

            const panelId = "stock-mobile-balances-" + item.id;

            const valuationLabel = total.hasUnvalued
              ? "Sin valorar"
              : fixed(total.currentStock) === 0n
                ? "Sin existencias"
                : total.averageUnitCost === null
                  ? "Sin costo vigente"
                  : "Valorado";

            return (
              <article
                key={item.id}
                aria-label={item.name}
                className={
                  "min-w-0 rounded-2xl border border-outline p-4 text-heading " +
                  (index % 2 === 0 ? "bg-surface" : "bg-secondary/40")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words pt-1 text-[18px] font-semibold leading-6">
                    {item.name}
                  </h3>

                  <div className="shrink-0">
                    {actions(
                      item.id,
                      item.isActive,
                      rows,
                      locationId
                    )}
                  </div>
                </div>

                <p className="mt-2 break-words text-[13px] leading-5 text-muted">
                  {item.sku ?? "Sin SKU"} ·{" "}
                  {itemTypeLabels[item.itemType]} · {locationLabel}
                </p>

                {!item.isActive && (
                  <p className="mt-1 text-xs text-muted">
                    Artículo inactivo
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 [&_dt]:text-[13px] [&_dt]:leading-5 [&_dt]:text-muted [&_dd]:mt-1 [&_dd]:break-words [&_dd]:text-[16px] [&_dd]:leading-6">
                  <div className="min-w-0">
                    <dt>Existencia</dt>
                    <dd>
                      {quantity(total.currentStock, item.baseUnit)}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt>Stock mínimo local</dt>
                    <dd>
                      {quantity(total.minimumStock, item.baseUnit)}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt>Costo promedio</dt>
                    <dd>
                      {total.hasUnvalued
                        ? "Sin valorar"
                        : cost(
                            locationId
                              ? (rows[0]?.averageUnitCost ?? null)
                              : total.averageUnitCost,
                            item.baseUnit,
                            currency
                          )}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt>Valor de inventario</dt>
                    <dd>
                      {money(
                        locationId &&
                          rows[0] &&
                          fixed(rows[0].currentStock) !== 0n
                          ? rows[0].inventoryValue
                          : total.inventoryValue,
                        currency
                      )}

                      {(!total.complete || total.hasUnvalued) && (
                        <span className="mt-1 block text-xs text-muted">
                          Valor conocido parcial
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <StockBadge
                    label={
                      locationId && rows[0]
                        ? physical(rows[0])
                        : physical(total)
                    }
                  />

                  <span className="text-[13px] text-muted">
                    {valuationLabel}
                  </span>
                </div>

                {!locationId && (
                  <div className="mt-3">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-heading transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      onClick={() =>
                        setExpanded((previous) =>
                          previous.includes(item.id)
                            ? previous.filter((id) => id !== item.id)
                            : [...previous, item.id]
                        )
                      }
                    >
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className={
                          "shrink-0 transition-transform motion-reduce:transition-none " +
                          (open ? "rotate-180" : "")
                        }
                      />
                      Desglose por ubicación
                    </button>

                    <div id={panelId} hidden={!open}>
                      <div className="mt-2 border-t border-outline pt-3">
                        {rows.length === 0 ? (
                          <p className="text-[13px] leading-5 text-muted">
                            Este artículo todavía no tiene saldos por
                            ubicación.
                          </p>
                        ) : (
                          <ul className="grid gap-3">
                            {rows.map((balance) => (
                              <li
                                key={balance.location.id}
                                className="min-w-0"
                              >
                                <p className="break-words text-[13px] font-medium leading-5">
                                  {balance.location.name} ·{" "}
                                  {balance.location.code}
                                </p>

                                <p className="mt-1 break-words text-[13px] leading-5 text-muted">
                                  {quantity(
                                    balance.currentStock,
                                    balance.baseUnit
                                  )}
                                  {" · "}
                                  {unvalued(balance)
                                    ? "Sin valorar"
                                    : cost(
                                        balance.averageUnitCost,
                                        balance.baseUnit,
                                        currency
                                      )}
                                  {" · "}
                                  {money(
                                    fixed(balance.currentStock) === 0n
                                      ? "0"
                                      : balance.inventoryValue,
                                    currency
                                  )}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
      </div>
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
