import { useState, useCallback } from "react";
import { FlaskConical, Plus, FilterX } from "lucide-react";

import { useAppShell } from "../../../../../../app/layout/shell-context";
import { calendarToday } from "../../../../../../components/forms/calendar-date";
import { Pagination } from "../../../../../../components/ui/Pagination";
import type { AuthSession } from "../../../../../auth/types/auth.types";

import { useInventoryQuery } from "../../../../hooks/useInventoryQuery";
import { searchKey } from "../../../../utils/inventory-format";

import { Button } from "../../../InventoryButton";
import { Choice } from "../../../InventoryLocationUI";

import { listOrders } from "../../services/production.queries";
import { loadPeriod } from "../../services/production.reports";

import {
  productionRoles,
  isAdmin,
} from "../../utils/production.access";

import { cash, statusLabels } from "../../utils/production.utils";

import { ProductionListState } from "../shared/ProductionListState";
import { ProductionCreateDialog } from "../forms/ProductionCreateDialog";
import { ProductionOrderResults } from "./ProductionOrderResults";

import type {
  CreationKind,
  Order,
  OrderSummary,
} from "../../types/production.types";

export function ProductionOrders({
  locationId,
  currency,
  zone,
  revision,
  onChanged,
}: {
  locationId: string;
  currency: string;
  zone: string;
  revision: number;
  onChanged: () => void;
}) {
  const { session } = useAppShell();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [notice, setNotice] = useState("");

  const [creation, setCreation] = useState<CreationKind | null>(null);

  const [returned, setReturned] = useState<Order | null>(null);

  const today = calendarToday(zone);
  const from = today.slice(0, 7) + "-01";

  const loader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      listOrders(current, signal, locationId),
    [locationId]
  );

  const query = useInventoryQuery(
    "production-orders:" + locationId,
    loader,
    revision,
    productionRoles
  );

  const periodLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      loadPeriod(current, signal, locationId, from, today),
    [locationId, from, today]
  );

  const period = useInventoryQuery(
    "production-period:" + locationId + ":" + from + ":" + today,
    periodLoader,
    revision,
    productionRoles
  );

  const items: OrderSummary[] = (query.data ?? []).map((row) =>
    returned?.id === row.id && returned.version >= row.version
      ? {
          ...returned,
          inputCount: returned.inputs.length,
          outputCount: returned.outputs.length,
        }
      : row
  );

  if (
    returned &&
    (!locationId || returned.location.id === locationId) &&
    !items.some((row) => row.id === returned.id)
  ) {
    items.unshift({
      ...returned,
      inputCount: returned.inputs.length,
      outputCount: returned.outputs.length,
    });
  }

  const normalizedSearch = search
    .trim()
    .replace(/^OP-0*(\d+)$/i, "OP-$1");

  const filtered = items.filter(
    (row) =>
      (!status || row.status === status) &&
      searchKey(
        "OP-" + row.id + " " + row.recipe.code + " " + row.recipe.name
      ).includes(searchKey(normalizedSearch))
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size))
  );

  const ids = filtered
    .slice((current - 1) * size, current * size)
    .map((row) => row.id);

  const periodValue = (value: string | number) =>
    period.pending ? "…" : period.error ? "—" : value;

  const count = (value: Order["status"]) =>
    query.pending
      ? "…"
      : query.error
        ? "—"
        : items.filter((row) => row.status === value).length;

  const metrics = [
    {
      label: "Borradores",
      value: count("DRAFT"),
    },
    {
      label: "Planificadas",
      value: count("PLANNED"),
    },
    {
      label: "En proceso",
      value: count("IN_PROGRESS"),
    },
    {
      label: "Completadas durante el período",
      value: periodValue(period.data?.summary.completedCount ?? "—"),
    },
    {
      label: "Órdenes con variación de costo",
      value: periodValue(period.data?.variations ?? "—"),
    },
    {
      label: "Costo producido durante el período",
      value: periodValue(
        cash(
          period.data?.summary.producedInventoryValue ?? null,
          currency
        )
      ),
    },
  ];

  return (
    <div className="grid min-w-0 gap-5">
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Órdenes de producción
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="compact"
            variant="secondary"
            onClick={() => {
              setNotice("");
              setCreation("quick");
            }}
          >
            <FlaskConical size={16} aria-hidden />
            Producción rápida
          </Button>

          {isAdmin(session) && (
            <Button
              size="compact"
              onClick={() => {
                setNotice("");
                setCreation("order");
              }}
            >
              <Plus size={16} aria-hidden />
              Nueva orden
            </Button>
          )}
        </div>
      </div>

      <dl className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded-xl border border-outline bg-surface p-4"
          >
            <dt className="text-xs leading-4 text-muted">
              {metric.label}
            </dt>

            <dd className="m-0 mt-3 text-xl font-semibold leading-6 [overflow-wrap:anywhere]">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs leading-5 text-muted">
        Período: {from} a {today} · Fecha de finalización · {zone}.
        Los estados pendientes abarcan todas las fechas de la planta
        seleccionada.
      </p>

      {period.error && (
        <ProductionListState
          state="error"
          message={
            "No fue posible cargar el resumen. " + period.error
          }
          onRetry={period.refresh}
        />
      )}

      <div className="grid min-w-0 gap-3 border-b border-outline pb-4">
        <div className="grid min-w-0 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid min-w-0 gap-2 text-xs">
            Buscar
            <input
              type="search"
              value={search}
              placeholder="Número, código o nombre de receta"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 rounded-xl border border-outline bg-surface px-3 text-sm text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <Button
            size="compact"
            variant="ghost"
            className="justify-self-end"
            onClick={() => {
              setSearch("");
              setStatus("");
              setPage(1);
            }}
          >
            <FilterX size={16} aria-hidden />
            Limpiar filtros
          </Button>
        </div>

        <div className="min-w-0 md:max-w-[340px]">
          <Choice
            label="Estado"
            value={status}
            className="[&_.select-field-label]:text-xs! [&_.select-field-trigger]:h-9! [&_.select-field-trigger]:min-h-9!"
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              {
                value: "",
                label: "Todos los estados",
              },
              ...Object.entries(statusLabels).map(
                ([value, label]) => ({
                  value,
                  label,
                })
              ),
            ]}
          />
        </div>
      </div>

      <ProductionOrderResults
        ids={ids}
        currency={currency}
        zone={zone}
        revision={revision}
        pending={query.pending}
        error={query.error}
        onRetry={query.refresh}
        onChanged={onChanged}
        onSaved={(order) => {
          setReturned(order);

          setNotice(
            "Orden OP-" +
              order.id +
              " actualizada. Estado: " +
              statusLabels[order.status] +
              "."
          );
        }}
      />

      {!query.pending && !query.error && filtered.length > 0 && (
        <Pagination
          page={current}
          pageSize={size}
          totalItems={filtered.length}
          itemLabel="órdenes"
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setSize(value);
            setPage(1);
          }}
        />
      )}

      {creation && (
        <ProductionCreateDialog
          key={creation}
          kind={creation}
          initialLocationId={locationId}
          currency={currency}
          zone={zone}
          onClose={() => setCreation(null)}
          onRefresh={onChanged}
          onOrderSaved={(order) => {
            setCreation(null);
            setReturned(order);
            setPage(1);
            setSearch("");
            setStatus("");

            setNotice(
              "Orden OP-" +
                order.id +
                " creada en borrador en " +
                order.location.name +
                "."
            );

            onChanged();
          }}
          onQuickSaved={(movement) => {
            setCreation(null);

            setNotice(
              "Producción rápida registrada correctamente. Movimiento M-" +
                movement.id +
                "."
            );

            onChanged();
          }}
        />
      )}
    </div>
  );
}
