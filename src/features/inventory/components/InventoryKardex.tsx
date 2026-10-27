import { useCallback, useState } from "react";
import { FilterX, Search } from "lucide-react";

import type { AuthSession } from "../../auth/types/auth.types";

import { DateField } from "../../../components/forms/DateField";
import { calendarToday } from "../../../components/forms/calendar-date";
import { Pagination } from "../../../components/ui/Pagination";

import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadKardexView } from "../services/inventory-kardex-view";
import type { InventoryWorkspace } from "../services/inventory-location.service";

import { movementLabels } from "../utils/inventory-audit";
import {
  dayKey,
  formatQuantity,
  searchKey,
} from "../utils/inventory-format";
import {
  cost,
  money,
  quantity,
  unit,
} from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Choice, Notice } from "./InventoryLocationUI";
import { InventoryResponsiveRecords } from "./InventoryResponsiveRecords";
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

  const [filters, setFilters] = useState({
    from: today.slice(0, 7) + "-01",
    to: today,
    inventoryItemId: initialItemId,
  });

  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseSize, setPurchaseSize] = useState(10);

  const [opened, setOpened] = useState("");

  const resetPages = () => {
    setPage(1);
    setPurchasePage(1);
  };

  const changeFilters = (patch: Partial<typeof filters>) => {
    setFilters((previous) => ({
      ...previous,
      ...patch,
    }));

    resetPages();
  };

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadKardexView(session, signal, {
        ...filters,
        locationId,
      }),
    [filters, locationId]
  );

  const query = useInventoryQuery(
    JSON.stringify(["kardex-view", filters, locationId]),
    loader,
    revision
  );

  const term = searchKey(search);

  const matches = (values: (string | null | undefined)[]) =>
    !term ||
    searchKey(values.filter(Boolean).join(" ")).includes(term);

  const suppliers = new Map(
    (query.data?.purchases ?? []).map(
      (row) => [row.movementId, row.supplierName] as const
    )
  );

  const entries = (query.data?.entries ?? []).filter(
    (entry) =>
      (!movementType || entry.movementType === movementType) &&
      matches([
        entry.externalReference,
        entry.createdByName,
        entry.inventoryItemName,
        entry.location?.name,
        entry.location?.code,
        suppliers.get(entry.movementId),
        movementLabels[entry.movementType],
      ])
  );

  const purchases = (query.data?.purchases ?? []).filter((row) =>
    matches([
      row.externalReference,
      row.supplierName,
      row.createdByName,
      row.inventoryItemName,
      row.location?.name,
      row.location?.code,
    ])
  );

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(entries.length / size))
  );

  const currentPurchasePage = Math.min(
    purchasePage,
    Math.max(1, Math.ceil(purchases.length / purchaseSize))
  );

  const dateTime = (value: string) =>
    new Intl.DateTimeFormat("es-CO", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const locationLabel = (
    location: { name: string; code: string } | null
  ) =>
    location
      ? location.name + " · " + location.code
      : "Sin ubicación histórica";

  const rows = entries
    .slice((currentPage - 1) * size, currentPage * size)
    .map((entry) => ({
      id: entry.movementLineId,
      fields: [
        {
          label: "Fecha y hora",
          value: dateTime(entry.createdAt),
        },
        {
          label: "Artículo",
          value: entry.inventoryItemName,
        },
        {
          label: "Tipo",
          value: movementLabels[entry.movementType],
        },
        {
          label: "Referencia",
          value: entry.externalReference || "—",
        },
        {
          label: "Ubicación",
          value: locationLabel(entry.location),
        },
        {
          label: "Entrada",
          value:
            entry.direction === "IN"
              ? formatQuantity(entry.quantity)
              : "—",
        },
        {
          label: "Salida",
          value:
            entry.direction === "OUT"
              ? formatQuantity(entry.quantity)
              : "—",
        },
        {
          label: "Unidad",
          value: unit(entry.baseUnit, entry.quantity),
        },
        {
          label: "Saldo físico",
          value: quantity(entry.balanceAfter, entry.baseUnit),
        },
        {
          label: "Costo unitario",
          value: cost(
            entry.costStatus === "VALUED" ? entry.unitCost : null,
            entry.baseUnit,
            currency
          ),
        },
        {
          label: "Costo total",
          value: money(
            entry.costStatus === "VALUED" ? entry.totalCost : null,
            currency
          ),
        },
        {
          label: "Saldo valorizado",
          value: money(
            entry.costStatus === "VALUED"
              ? entry.inventoryValueAfter
              : null,
            currency
          ),
        },
        {
          label: "Responsable",
          value: entry.createdByName,
        },
        {
          label: "Acción",
          value: (
            <Button
              variant="ghost"
              size="compact"
              className="min-h-11 hover:bg-accent! hover:text-on-accent!"
              aria-label={"Ver movimiento M-" + entry.movementId}
              onClick={() => setOpened(entry.movementId)}
            >
              Ver detalle
            </Button>
          ),
        },
      ],
    }));

  const purchaseRows = purchases
    .slice(
      (currentPurchasePage - 1) * purchaseSize,
      currentPurchasePage * purchaseSize
    )
    .map((row) => ({
      id: row.movementLineId,
      fields: [
        {
          label: "Artículo",
          value: row.inventoryItemName,
        },
        {
          label: "Fecha",
          value: row.documentDate || dayKey(row.createdAt, timezone),
        },
        {
          label: "Proveedor",
          value: row.supplierName || "—",
        },
        {
          label: "Ubicación",
          value: locationLabel(row.location),
        },
        {
          label: "Cantidad base",
          value: quantity(row.baseQuantity, row.baseUnit),
        },
        {
          label: "Costo de compra / unidad",
          value: cost(
            row.costStatus === "VALUED" ? row.purchaseUnitCost : null,
            row.baseUnit,
            currency
          ),
        },
        {
          label: "Costo previo",
          value: cost(
            row.previousAverageUnitCost,
            row.baseUnit,
            currency
          ),
        },
        {
          label: "Variación",
          value:
            row.costStatus === "VALUED" &&
            row.averageCostVariationPercentage !== null
              ? formatQuantity(row.averageCostVariationPercentage) +
                " %"
              : "—",
        },
        {
          label: "Costo neto",
          value: money(
            row.costStatus === "VALUED" ? row.netCost : null,
            currency
          ),
        },
      ],
    }));

  const summary = query.data?.summary;

  const metrics = [
    {
      label: "Valor inicial",
      value: summary?.initial ?? null,
    },
    {
      label: "Valor de entradas",
      value: summary?.incoming ?? null,
    },
    {
      label: "Valor de salidas",
      value: summary?.outgoing ?? null,
    },
    {
      label: "Valor final",
      value: summary?.final ?? null,
    },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <h3 className="text-base font-semibold text-heading">
        Registro físico y valorizado
      </h3>

      <div className="grid min-w-0 gap-4 border-b border-outline pb-4">
        <div className="grid min-w-0 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
          <label className="grid min-w-0 gap-2 text-sm text-heading">
            <span>Buscar</span>

            <div className="relative min-w-0">
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />

              <input
                type="search"
                value={search}
                placeholder="Buscar referencia, proveedor o responsable"
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPages();
                }}
                className="h-11 w-full min-w-0 rounded-xl border border-outline bg-surface pl-10 pr-3 text-sm text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </label>

          <Button
            variant="ghost"
            className="min-h-11 justify-self-end"
            onClick={() => {
              setFilters({
                from: today.slice(0, 7) + "-01",
                to: today,
                inventoryItemId: "",
              });

              setSearch("");
              setMovementType("");
              resetPages();
            }}
          >
            <FilterX size={17} aria-hidden="true" />
            Limpiar filtros
          </Button>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DateField
            label="Desde"
            value={filters.from}
            max={filters.to}
            clearable={false}
            timeZone={timezone}
            onValueChange={(from) => changeFilters({ from })}
          />

          <DateField
            label="Hasta"
            value={filters.to}
            min={filters.from}
            clearable={false}
            timeZone={timezone}
            onValueChange={(to) => changeFilters({ to })}
          />

          <Choice
            label="Artículo"
            value={filters.inventoryItemId}
            onValueChange={(inventoryItemId) =>
              changeFilters({ inventoryItemId })
            }
            options={[
              {
                value: "",
                label: "Todos los artículos",
              },
              ...data.items.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />

          <Choice
            label="Tipo de movimiento"
            value={movementType}
            onValueChange={(value) => {
              setMovementType(value);
              setPage(1);
            }}
            options={[
              {
                value: "",
                label: "Todos los movimientos",
              },
              ...Object.entries(movementLabels).map(
                ([value, label]) => ({
                  value,
                  label,
                })
              ),
            ]}
          />
        </div>
      </div>

      {!filters.inventoryItemId && (
        <Notice>
          Selecciona un artículo para consultar saldos físicos y
          evolución de su costo en una misma unidad.
        </Notice>
      )}

      {query.pending && <Notice>Consultando kardex y costos…</Notice>}

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
          <dl className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="min-w-0 rounded-xl border border-outline bg-surface p-4"
              >
                <dt className="text-xs leading-5 text-muted">
                  {metric.label}
                </dt>

                <dd className="m-0 mt-2 text-xl font-bold tabular-nums text-heading [overflow-wrap:anywhere]">
                  {money(metric.value, currency)}
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-xs leading-5 text-muted">
            Resumen de los artículos y ubicaciones con movimientos en
            el período. Los valores inicial y final suman los saldos
            antes del primer movimiento y después del último de cada
            artículo y ubicación. La búsqueda y el tipo no cambian
            este resumen. Los valores sin información suficiente
            aparecen como —.
          </p>

          <InventoryResponsiveRecords
            label="Registro físico y valorizado"
            rows={rows}
            wide
          />

          {!entries.length && (
            <Notice>No hay movimientos para estos filtros.</Notice>
          )}

          <Pagination
            page={currentPage}
            pageSize={size}
            totalItems={entries.length}
            itemLabel="registros"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />

          <h3 className="text-base font-semibold text-heading">
            Compras y variación del costo por artículo
          </h3>

          <p className="text-xs leading-5 text-muted">
            Compras del período, ubicación y artículo seleccionados.
            La variación compara el costo promedio posterior con el
            anterior a la compra. El filtro de tipo de movimiento solo
            afecta al kardex.
          </p>

          <InventoryResponsiveRecords
            label="Compras y variación del costo"
            rows={purchaseRows}
          />

          {!purchases.length && (
            <Notice>No hay compras para estos filtros.</Notice>
          )}

          <Pagination
            page={currentPurchasePage}
            pageSize={purchaseSize}
            totalItems={purchases.length}
            itemLabel="líneas de compra"
            onPageChange={setPurchasePage}
            onPageSizeChange={(value) => {
              setPurchaseSize(value);
              setPurchasePage(1);
            }}
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
