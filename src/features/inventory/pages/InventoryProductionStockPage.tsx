import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { Boxes, Factory, FilterX } from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { useInventoryRealtime } from "../../../hooks/useInventoryRealtime";
import { Pagination } from "../../../components/ui/Pagination";

import type {
  AuthSession,
  RoleCode,
} from "../../auth/types/auth.types";
import type { Balance } from "../schemas/inventory-location.schema";

import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadProductionStock } from "../services/production-stock.service";
import { Button } from "../components/InventoryButton";
import {
  Choice,
  Field,
  Notice,
  StockBadge,
} from "../components/InventoryLocationUI";
import { InventoryResponsiveRecords } from "../components/InventoryResponsiveRecords";
import { ProductionListState } from "../components/production/components/shared/ProductionListState";
import { assignedPlant } from "../components/production/utils/production.access";
import {
  formatQuantity,
  itemTypeLabels,
  searchKey,
} from "../utils/inventory-format";
import {
  fixed,
  physical,
  quantity,
  unit,
} from "../utils/inventory-value";

const allowedRoles: readonly RoleCode[] = ["PRODUCTION"];

const tabs = [
  { id: "stock", label: "Existencias", Icon: Boxes },
  { id: "production", label: "Producción", Icon: Factory },
];

function valuationLabel(row: Balance) {
  if (fixed(row.currentStock) === 0n) {
    return "Sin existencias";
  }

  return row.valuationStatus === "UNVALUED"
    ? "Sin valorar"
    : "Valorado";
}

export function InventoryProductionStockPage() {
  const { session } = useAppShell();
  const [params, setParams] = useSearchParams();

  const plant = assignedPlant(session);
  const requestedLocation = params.get("locationId") ?? "";

  const load = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      loadProductionStock(current, signal, requestedLocation),
    [requestedLocation]
  );

  const query = useInventoryQuery(
    JSON.stringify([
      "production-stock",
      requestedLocation,
      plant?.id ?? null,
      session.authorization.roles,
    ]),
    load,
    0,
    allowedRoles
  );

  useInventoryRealtime(session, () => {
    if (query.pending) return false;

    query.refresh();
    return true;
  });

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 text-heading">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">INVENTARIO</p>

          <h2 className="text-[20px] font-bold leading-7 sm:text-[24px]">
            Existencias
          </h2>

          <p className="mt-1 text-xs leading-5 text-muted">
            Consulta los saldos y costos de tu planta asignada.
          </p>
        </div>

        <div className="w-full min-w-0 sm:w-[360px]">
          <Choice
            label="Planta"
            value={plant?.id ?? ""}
            disabled
            onValueChange={() => {}}
            options={
              plant
                ? [{ value: plant.id, label: plant.name }]
                : [
                    {
                      value: "",
                      label: "Sin planta válida asignada",
                    },
                  ]
            }
          />
        </div>
      </header>

      <nav
        aria-label="Secciones de inventario"
        className="flex min-w-0 max-w-full gap-1 overflow-x-auto border-b border-outline pb-2"
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={id === "stock" ? "page" : undefined}
            className={
              "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (id === "stock"
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-secondary")
            }
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);

                next.set("tab", id);
                next.delete("locationId");

                return next;
              })
            }
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <Notice>
        Solo consulta. Los importes se muestran en la moneda del
        negocio, sin símbolo.
      </Notice>

      {query.error ? (
        <ProductionListState
          state="error"
          message={query.error}
          onRetry={query.refresh}
        />
      ) : query.pending || !query.data ? (
        <ProductionListState
          state="loading"
          message="Cargando existencias…"
        />
      ) : (
        <StockResults
          key={query.data.location.id}
          balances={query.data.balances}
        />
      )}
    </section>
  );
}

function StockResults({ balances }: { balances: Balance[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [stock, setStock] = useState("");
  const [valuation, setValuation] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const change =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
    };

  const filtered = balances.filter(
    (row) =>
      searchKey(row.name + " " + (row.sku ?? "")).includes(
        searchKey(search)
      ) &&
      (!type || row.itemType === type) &&
      (!stock ||
        (stock === "negative"
          ? fixed(row.currentStock) < 0n
          : row.stockStatus === stock)) &&
      (!valuation || row.valuationStatus === valuation)
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize))
  );

  const rows = filtered
    .slice((current - 1) * pageSize, current * pageSize)
    .map((row) => ({
      id: row.inventoryItemId,
      fields: [
        {
          label: "Artículo",
          value: <strong>{row.name}</strong>,
        },
        {
          label: "SKU",
          value: row.sku ?? "—",
        },
        {
          label: "Tipo",
          value: itemTypeLabels[row.itemType],
        },
        {
          label: "Existencia",
          value: quantity(row.currentStock, row.baseUnit),
        },
        {
          label: "Mínimo local",
          value: quantity(row.minimumStock, row.baseUnit),
        },
        {
          label: "Costo promedio",
          value:
            row.averageUnitCost === null
              ? "Sin costo"
              : formatQuantity(row.averageUnitCost) +
                "/" +
                unit(row.baseUnit),
        },
        {
          label: "Valor de inventario",
          value:
            row.inventoryValue === null
              ? "Sin valorar"
              : formatQuantity(row.inventoryValue),
        },
        {
          label: "Estado físico",
          value: <StockBadge label={physical(row)} />,
        },
        {
          label: "Valoración",
          value: valuationLabel(row),
        },
      ],
    }));

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-4 border-b border-outline pb-5">
        <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field
            label="Buscar"
            value={search}
            onChange={change(setSearch)}
            placeholder="Buscar artículo o SKU"
          />

          <Button
            variant="ghost"
            className="justify-self-end"
            onClick={() => {
              setSearch("");
              setType("");
              setStock("");
              setValuation("");
              setPage(1);
            }}
          >
            <FilterX size={16} aria-hidden />
            Limpiar filtros
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            value={stock}
            onValueChange={change(setStock)}
            options={[
              {
                value: "",
                label: "Todos los estados físicos",
              },
              {
                value: "AVAILABLE",
                label: "Disponible",
              },
              {
                value: "LOW_STOCK",
                label: "Bajo mínimo",
              },
              {
                value: "OUT_OF_STOCK",
                label: "Agotado",
              },
              {
                value: "negative",
                label: "Saldo negativo",
              },
            ]}
          />

          <Choice
            label="Valoración"
            value={valuation}
            onValueChange={change(setValuation)}
            options={[
              { value: "", label: "Toda valoración" },
              { value: "VALUED", label: "Valorado" },
              { value: "UNVALUED", label: "Sin valorar" },
            ]}
          />
        </div>
      </div>

      {filtered.length ? (
        <>
          <InventoryResponsiveRecords
            label="Existencias de la planta"
            rows={rows}
            wide
          />

          <Pagination
            page={current}
            pageSize={pageSize}
            totalItems={filtered.length}
            itemLabel="artículos"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </>
      ) : (
        <ProductionListState
          state="empty"
          message={
            balances.length
              ? "No hay artículos que coincidan con los filtros."
              : "No hay existencias registradas para tu planta."
          }
        />
      )}
    </div>
  );
}
