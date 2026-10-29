import { useState, useCallback } from "react";
import {
  Eye,
  Pencil,
  CalendarCheck,
  Play,
  Trash2,
  CircleCheck,
  ChartNoAxesCombined,
  History,
  FlaskConical,
  Plus,
  FilterX,
} from "lucide-react";

import { useAppShell } from "../../../../../../app/layout/shell-context";
import { calendarToday } from "../../../../../../components/forms/calendar-date";
import { ActionMenu } from "../../../../../../components/ui/ActionMenu";
import { Pagination } from "../../../../../../components/ui/Pagination";
import type { AuthSession } from "../../../../../auth/types/auth.types";

import { useInventoryQuery } from "../../../../hooks/useInventoryQuery";
import {
  searchKey,
  dayKey,
} from "../../../../utils/inventory-format";
import { quantity } from "../../../../utils/inventory-value";

import { Button } from "../../../InventoryButton";
import { Choice } from "../../../InventoryLocationUI";

import {
  ProductionOrderRecords,
  type ProductionOrderRecord,
} from "./ProductionOrderRecords";

import { listOrders } from "../../services/production.queries";
import { loadPeriod } from "../../services/production.reports";
import {
  productionRoles,
  allowedActions,
  isAdmin,
} from "../../utils/production.access";
import {
  cash,
  actionLabels,
  statusLabels,
} from "../../utils/production.utils";

import { useOrderPage } from "../../hooks/useOrderPage";
import { ProductionListState } from "../shared/ProductionListState";
import { ProductionCreateDialog } from "../forms/ProductionCreateDialog";
import { ProductionOrderDialog } from "./ProductionOrderDialog";

import type {
  CreationKind,
  Action,
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

  const [selection, setSelection] = useState<{
    id: string;
    action: Action;
  } | null>(null);

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

  const filtered = items.filter(
    (row) =>
      (!status || row.status === status) &&
      searchKey(
        "OP-" + row.id + " " + row.recipe.code + " " + row.recipe.name
      ).includes(searchKey(search))
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size))
  );

  const visible = filtered.slice(
    (current - 1) * size,
    current * size
  );

  const idsKey = JSON.stringify(visible.map((row) => row.id));
  const details = useOrderPage(idsKey, revision);

  const icons = {
    detail: Eye,
    edit: Pencil,
    plan: CalendarCheck,
    start: Play,
    cancel: Trash2,
    complete: CircleCheck,
    waste: Trash2,
    performance: ChartNoAxesCombined,
    movement: History,
  };

  const rows: ProductionOrderRecord[] = visible.map((summary) => {
    const detail = details.data?.find(
      (item) =>
        item.order.id === summary.id &&
        item.order.version >= summary.version
    );

    const row = detail?.order ?? summary;

    return {
      id: row.id,
      number: "OP-" + row.id,
      recipeName: row.recipe.name,
      recipeCode: row.recipe.code,
      plantName: row.location.name,
      plantCode: row.location.code,
      status: row.status,

      plannedDate: row.plannedFor
        ? dayKey(row.plannedFor, zone)
        : "Sin fecha",

      responsible:
        row.completedByName ?? row.startedByName ?? row.createdByName,

      products: detail
        ? detail.order.outputs
            .map(
              (line) =>
                line.inventoryItemName +
                " · " +
                quantity(line.plannedQuantity, line.baseUnit)
            )
            .join("; ")
        : details.pending
          ? "Cargando…"
          : summary.outputCount + " resultados · consulta el detalle",

      producedValue:
        row.status !== "COMPLETED"
          ? "No aplicado"
          : detail
            ? cash(detail.value, currency)
            : details.pending
              ? "Cargando…"
              : "Sin valoración",

      actions: (
        <ActionMenu
          label={"Acciones de OP-" + row.id}
          actions={allowedActions(session, row).map((action) => {
            const Icon = icons[action];

            return {
              id: action,
              label: actionLabels[action],
              icon: <Icon size={16} aria-hidden />,
              danger: action === "cancel",
              separatorBefore: action === "cancel",
              onSelect: () => setSelection({ id: row.id, action }),
            };
          })}
        />
      ),
    };
  });

  const listLoading =
    query.pending ||
    (!query.error && visible.length > 0 && details.pending);

  const listError =
    query.error || (visible.length > 0 ? details.error : null);

  function count(value: Order["status"]) {
    if (!query.data) {
      return query.pending ? "…" : "—";
    }

    return items.filter((row) => row.status === value).length;
  }

  function saved(order: Order) {
    setReturned(order);
    setSelection(null);

    setNotice(
      "Orden OP-" +
        order.id +
        " actualizada. Estado: " +
        statusLabels[order.status] +
        "."
    );

    onChanged();
  }

  return (
    <div className="grid min-w-0 gap-5">
      {notice && (
        <p
          role="status"
          aria-live="polite"
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
              setSelection(null);
              setCreation("quick");
            }}
          >
            <FlaskConical size={16} />
            Producción rápida
          </Button>

          {isAdmin(session) && (
            <Button
              size="compact"
              onClick={() => {
                setNotice("");
                setSelection(null);
                setCreation("order");
              }}
            >
              <Plus size={16} />
              Nueva orden
            </Button>
          )}
        </div>
      </div>

      <dl className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-3">
        {[
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
            value: period.pending
              ? "…"
              : period.error
                ? "—"
                : (period.data?.summary.completedCount ?? "—"),
          },
          {
            label: "Órdenes con variación de costo",
            value: period.pending
              ? "…"
              : period.error
                ? "—"
                : (period.data?.variations ?? "—"),
          },
          {
            label: "Costo producido durante el período",
            value: period.pending
              ? "…"
              : period.error
                ? "—"
                : cash(
                    period.data?.summary.producedInventoryValue ??
                      null,
                    currency
                  ),
          },
        ].map((metric) => (
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
            "No fue posible cargar el resumen.\n" + period.error
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

      {listLoading ? (
        <ProductionListState state="loading" />
      ) : listError ? (
        <ProductionListState
          state="error"
          message={
            "No fue posible cargar la producción. Intenta de nuevo.\n" +
            listError
          }
          onRetry={query.error ? query.refresh : details.refresh}
        />
      ) : !filtered.length ? (
        <ProductionListState state="empty" />
      ) : (
        <>
          <ProductionOrderRecords
            rows={rows}
            onOpen={(id) => setSelection({ id, action: "detail" })}
          />

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
        </>
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

      {selection && (
        <ProductionOrderDialog
          key={selection.id + ":" + selection.action}
          {...selection}
          currency={currency}
          zone={zone}
          onClose={() => setSelection(null)}
          onSaved={saved}
          onStale={onChanged}
        />
      )}
    </div>
  );
}
