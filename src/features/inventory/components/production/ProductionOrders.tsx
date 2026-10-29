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
import { useAppShell } from "../../../../app/layout/shell-context";
import { calendarToday } from "../../../../components/forms/calendar-date";
import { ActionMenu } from "../../../../components/ui/ActionMenu";
import { Pagination } from "../../../../components/ui/Pagination";
import type { AuthSession } from "../../../auth/types/auth.types";
import { useInventoryQuery } from "../../hooks/useInventoryQuery";
import { searchKey, dayKey } from "../../utils/inventory-format";
import { quantity } from "../../utils/inventory-value";
import { Button } from "../InventoryButton";
import { Notice, Choice } from "../InventoryLocationUI";
import { InventoryResponsiveRecords as Records } from "../InventoryResponsiveRecords";
import { listOrders } from "./production.queries";
import { loadPeriod } from "./production.reports";
import {
  productionRoles,
  allowedActions,
  isAdmin,
} from "./production.access";
import { cash, actionLabels, statusLabels } from "./production.utils";
import { useOrderPage } from "./useOrderPage";
import { StatusBadge, Metrics } from "./ProductionUI";
import { ProductionCreateDialog } from "./ProductionCreateDialog";
import { ProductionOrderDialog } from "./ProductionOrderDialog";
import type {
  CreationKind,
  Action,
  Order,
  OrderSummary,
} from "./production.types";

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

  const rows = visible.map((summary) => {
    const detail = details.data?.find(
      (item) =>
        item.order.id === summary.id &&
        item.order.version >= summary.version
    );
    const row = detail?.order ?? summary;

    return {
      id: row.id,
      fields: [
        {
          label: "Orden",
          value: (
            <button
              type="button"
              className="min-h-11 font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              onClick={() =>
                setSelection({ id: row.id, action: "detail" })
              }
            >
              OP-{row.id}
            </button>
          ),
        },
        {
          label: "Receta",
          value: (
            <div>
              {row.recipe.name}
              <p className="text-xs text-muted">{row.recipe.code}</p>
            </div>
          ),
        },
        {
          label: "Planta",
          value: row.location.name + " · " + row.location.code,
        },
        {
          label: "Estado",
          value: <StatusBadge status={row.status} />,
        },
        {
          label: "Fecha prevista",
          value: row.plannedFor
            ? dayKey(row.plannedFor, zone)
            : "Sin fecha",
        },
        {
          label: "Responsable",
          value:
            row.completedByName ??
            row.startedByName ??
            row.createdByName,
        },
        {
          label: "Productos esperados",
          value: detail
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
              : summary.outputCount +
                " resultados · consulta el detalle",
        },
        {
          label: "Valor producido",
          value:
            row.status !== "COMPLETED"
              ? "No aplicado"
              : details.pending
                ? "Cargando…"
                : cash(detail?.value ?? null, currency),
        },
        {
          label: "Acciones",
          value: (
            <ActionMenu
              label={"Acciones de OP-" + row.id}
              actions={allowedActions(session, row).map((action) => {
                const Icon = icons[action];

                return {
                  id: action,
                  label: actionLabels[action],
                  icon: <Icon size={16} />,
                  danger: action === "cancel",
                  separatorBefore: action === "cancel",
                  onSelect: () =>
                    setSelection({ id: row.id, action }),
                };
              })}
            />
          ),
        },
      ],
    };
  });

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
        <h3 className="text-base font-semibold">
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

      {query.pending && <Notice>Consultando órdenes…</Notice>}

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
          <Metrics
            rows={[
              {
                label: "Borradores",
                value: items.filter((row) => row.status === "DRAFT")
                  .length,
              },
              {
                label: "Planificadas",
                value: items.filter((row) => row.status === "PLANNED")
                  .length,
              },
              {
                label: "En proceso",
                value: items.filter(
                  (row) => row.status === "IN_PROGRESS"
                ).length,
              },
              {
                label: "Completadas durante el período",
                value: period.pending
                  ? "…"
                  : period.error
                    ? "Sin datos"
                    : (period.data?.summary.completedCount ??
                      "Sin datos"),
              },
              {
                label: "Órdenes con variación de costo en el período",
                value: period.pending
                  ? "…"
                  : period.error
                    ? "Sin datos"
                    : (period.data?.variations ?? "Sin datos"),
              },
              {
                label: "Costo producido durante el período",
                value: period.pending
                  ? "…"
                  : period.error
                    ? "Sin datos"
                    : cash(
                        period.data?.summary.producedInventoryValue ??
                          null,
                        currency
                      ),
              },
            ]}
          />

          <p className="text-xs text-muted">
            Período: {from} a {today} · Fecha de finalización · {zone}
            . Los estados pendientes abarcan todas las fechas de la
            planta seleccionada.
          </p>

          {period.error && (
            <Notice>
              {period.error}{" "}
              <Button variant="secondary" onClick={period.refresh}>
                Reintentar resumen
              </Button>
            </Notice>
          )}

          <div className="grid gap-3 border-b border-outline pb-4">
            <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm">
                Buscar
                <input
                  type="search"
                  value={search}
                  placeholder="Número, código o nombre de receta"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 min-w-0 rounded-xl border border-outline bg-surface px-3 text-heading outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <Button
                variant="ghost"
                className="min-h-11 justify-self-end"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(1);
                }}
              >
                <FilterX size={17} />
                Limpiar filtros
              </Button>
            </div>

            <div className="md:max-w-xs">
              <Choice
                label="Estado"
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Todos los estados" },
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

          {details.error && (
            <Notice>
              {details.error}{" "}
              <Button variant="secondary" onClick={details.refresh}>
                Reintentar detalles
              </Button>
            </Notice>
          )}

          <Records label="Órdenes de producción" rows={rows} wide />

          {!filtered.length && (
            <Notice>No hay órdenes para estos filtros.</Notice>
          )}

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
