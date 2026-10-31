import { FilterX } from "lucide-react";

import { calendarToday } from "../../../../../../components/forms/calendar-date";
import { DateField } from "../../../../../../components/forms/DateField";
import { Pagination } from "../../../../../../components/ui/Pagination";

import { Button } from "../../../InventoryButton";
import { Choice } from "../../../InventoryLocationUI";

import { useProductionReports } from "../../hooks/useProductionReports";

import {
  dateFieldSchema,
  statusFilterSchema,
  type ReportGroup,
  type ReportSummary,
  type ReportView,
} from "../../schemas/report.schemas";

import { reportDateLabels } from "../../utils/report.utils";
import { cash, statusLabels } from "../../utils/production.utils";

import { ProductionOrderResults } from "../orders/ProductionOrderResults";
import { ProductionListState } from "../shared/ProductionListState";

const tabs: {
  id: ReportView;
  label: string;
}[] = [
  { id: "summary", label: "Resumen" },
  { id: "history", label: "Historial de órdenes" },
  { id: "LOCATION", label: "Por planta" },
  { id: "OUTPUT", label: "Por producto obtenido" },
  { id: "EMPLOYEE", label: "Por responsable" },
];

const choiceClass =
  "[&_.select-field-label]:text-xs! " +
  "[&_.select-field-trigger]:h-9! " +
  "[&_.select-field-trigger]:min-h-9!";

const dateClass =
  "[&_.date-field-label]:text-xs! " +
  "[&_.date-field-trigger]:h-9! " +
  "[&_.date-field-trigger]:min-h-9!";

const countFields = [
  ["orderCount", "Total de órdenes"],
  ["draftCount", "Borrador"],
  ["plannedCount", "Planificada"],
  ["inProgressCount", "En proceso"],
  ["completedCount", "Completada"],
  ["cancelledCount", "Cancelada"],
] as const;

const costFields = [
  ["expectedInputCostAtActualRate", "Costo esperado"],
  ["actualInputCost", "Costo real"],
  ["inputCostDifference", "Variación de costo"],
  ["declaredWasteCost", "Desperdicio declarado"],
  ["totalResourceCost", "Costo de recursos consumidos"],
  ["producedInventoryValue", "Valor producido"],
] as const;

const groupFields = [
  ["orderCount", "Órdenes"],
  ["completedCount", "Completadas"],
  ["expectedInputCostAtActualRate", "Costo esperado asignado"],
  ["actualInputCost", "Costo real asignado"],
  ["inputCostDifference", "Variación"],
  ["declaredWasteCost", "Desperdicio asignado"],
  ["producedInventoryValue", "Valor producido"],
] as const;

function ReportMetrics({
  summary,
  pending,
  currency,
}: {
  summary?: ReportSummary;
  pending: boolean;
  currency: string;
}) {
  const placeholder = pending ? "…" : "—";

  const metrics = [
    ...countFields.map(([key, label]) => ({
      label,
      value: summary ? summary[key] : placeholder,
    })),

    ...costFields.map(([key, label]) => ({
      label,
      value: summary ? cash(summary[key], currency) : placeholder,
    })),
  ];

  return (
    <dl
      aria-label="Indicadores de producción"
      aria-busy={pending}
      className="m-0 grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-3"
    >
      {metrics.map(({ label, value }) => (
        <div
          key={label}
          className="min-w-0 rounded-xl border border-outline bg-surface p-4"
        >
          <dt className="text-xs leading-5 text-muted">{label}</dt>

          <dd className="m-0 mt-2 text-xl font-bold leading-7 tabular-nums [overflow-wrap:anywhere]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReportGroups({
  rows,
  product,
  currency,
}: {
  rows: ReportGroup[];
  product: boolean;
  currency: string;
}) {
  const fields = (row: ReportGroup) =>
    groupFields.map(([key, label]) => ({
      label,
      value:
        key === "orderCount" || key === "completedCount"
          ? row[key]
          : cash(row[key], currency),
    }));

  const rowKey = (row: ReportGroup) =>
    JSON.stringify([row.key, row.label]);

  return (
    <div className="min-w-0 max-w-full">
      <ul
        aria-label="Resultados agrupados"
        className="m-0 grid list-none gap-3 p-0 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="min-w-0 rounded-2xl border border-outline bg-surface p-4"
          >
            <h4 className="mb-3 text-sm font-semibold [overflow-wrap:anywhere]">
              {row.label}
            </h4>

            <dl className="m-0 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-xs leading-4">
              {fields(row).map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-muted">{field.label}</dt>

                  <dd className="m-0 mt-0.5 font-medium tabular-nums [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div
        role="region"
        aria-label="Tabla de resultados agrupados"
        tabIndex={0}
        className="hidden max-w-full overflow-x-auto rounded-xl border border-outline bg-surface focus-visible:outline-2 focus-visible:outline-accent md:block"
      >
        <table className="w-full min-w-[1100px] text-left text-xs leading-4">
          <caption className="sr-only">
            Informe {product ? "por producto obtenido" : "agrupado"}
          </caption>

          <thead className="bg-secondary/40 text-muted">
            <tr>
              <th
                scope="col"
                className="min-w-[180px] px-3 py-3 font-normal"
              >
                {product ? "Producto" : "Agrupación"}
              </th>

              {groupFields.map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  className="px-3 py-3 font-normal"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="h-16 border-t border-outline"
              >
                <th scope="row" className="px-3 py-3 font-normal">
                  {row.label}
                </th>

                {fields(row).map((field) => (
                  <td
                    key={field.label}
                    className="px-3 py-3 tabular-nums"
                  >
                    {field.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Option = {
  value: string;
  label: string;
};

function selectedOptions(
  options: Option[],
  selected: string,
  fallback: string
) {
  return selected &&
    !options.some((option) => option.value === selected)
    ? [
        ...options,
        {
          value: selected,
          label: fallback,
        },
      ]
    : options;
}

export function ProductionReports({
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
  const report = useProductionReports(
    locationId,
    calendarToday(zone),
    revision
  );

  const {
    filters,
    change,
    view,
    summary,
    history,
    groups,
    options,
    settling,
    validationError,
  } = report;

  const summaryReady =
    !settling &&
    !validationError &&
    !summary.pending &&
    !summary.error;

  const visibleSummary = summaryReady
    ? summary.data?.summary
    : undefined;

  const available =
    !options.pending && !options.error ? options.data : null;

  const employees = selectedOptions(
    available?.employees ?? [],
    filters.membershipId,
    "Responsable seleccionado"
  );

  const outputs = selectedOptions(
    available?.outputs ?? [],
    filters.outputInventoryItemId,
    "Producto seleccionado"
  );

  const groupPending = settling || groups.pending;
  const historyPending = settling || history.pending;

  const historyReady =
    !historyPending && !validationError && !history.error;

  const pagination = historyReady ? history.data?.pagination : null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <h3 className="text-sm font-semibold">
        Rendimiento e informes
      </h3>

      <ReportMetrics
        summary={visibleSummary}
        currency={currency}
        pending={!validationError && (settling || summary.pending)}
      />

      {!settling && !validationError && summary.error && (
        <ProductionListState
          state="error"
          message={
            "No fue posible cargar el resumen. " + summary.error
          }
          onRetry={summary.refresh}
        />
      )}

      <nav
        aria-label="Vistas de informes"
        className="flex min-w-0 max-w-full gap-1 overflow-x-auto pb-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={view === tab.id ? "page" : undefined}
            onClick={() => report.setView(tab.id)}
            className={
              "h-8 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-medium " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (view === tab.id
                ? "bg-secondary text-heading"
                : "text-muted hover:bg-secondary/60")
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="grid min-w-0 gap-3 border-b border-outline pb-4">
        <div className="grid min-w-0 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid min-w-0 gap-2 text-xs">
            Buscar
            <input
              type="search"
              maxLength={100}
              value={filters.search}
              onChange={(event) =>
                change("search", event.target.value)
              }
              placeholder="Número, código o nombre de receta"
              className="h-9 min-w-0 rounded-xl border border-outline bg-surface px-3 text-sm text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <Button
            size="compact"
            variant="ghost"
            className="justify-self-end"
            onClick={report.reset}
          >
            <FilterX size={16} aria-hidden />
            Limpiar filtros
          </Button>
        </div>

        <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Choice
            label="Estado"
            value={filters.status}
            className={choiceClass}
            onValueChange={(value) =>
              change("status", statusFilterSchema.parse(value))
            }
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

          <DateField
            label="Desde"
            value={filters.from}
            timeZone={zone}
            clearable={false}
            className={dateClass}
            onValueChange={(value) => change("from", value)}
          />

          <DateField
            label="Hasta"
            value={filters.to}
            timeZone={zone}
            clearable={false}
            className={dateClass}
            onValueChange={(value) => change("to", value)}
          />

          <Choice
            label="Responsable"
            value={filters.membershipId}
            className={choiceClass}
            disabled={options.pending}
            onValueChange={(value) => change("membershipId", value)}
            options={[
              {
                value: "",
                label: "Todos los responsables",
              },
              ...employees,
            ]}
          />

          <Choice
            label="Campo de fecha"
            value={filters.dateField}
            className={choiceClass}
            onValueChange={(value) =>
              change("dateField", dateFieldSchema.parse(value))
            }
            options={Object.entries(reportDateLabels).map(
              ([value, label]) => ({
                value,
                label,
              })
            )}
          />

          <Choice
            label="Producto obtenido"
            value={filters.outputInventoryItemId}
            className={choiceClass}
            disabled={options.pending}
            onValueChange={(value) =>
              change("outputInventoryItemId", value)
            }
            options={[
              {
                value: "",
                label: "Todos los productos",
              },
              ...outputs,
            ]}
          />
        </div>

        {validationError && (
          <p
            role="alert"
            className="text-sm text-red-600 dark:text-red-400"
          >
            {validationError}
          </p>
        )}

        {options.pending && (
          <p role="status" className="text-xs text-muted">
            Cargando responsables y productos del período…
          </p>
        )}

        {options.error && (
          <ProductionListState
            state="error"
            message={
              "No fue posible cargar los filtros. " + options.error
            }
            onRetry={options.refresh}
          />
        )}
      </div>

      {view === "summary" &&
        !validationError &&
        (settling || summary.pending ? (
          <ProductionListState state="loading" />
        ) : visibleSummary && visibleSummary.orderCount === 0 ? (
          <ProductionListState state="empty" />
        ) : summaryReady && summary.data ? (
          <div className="grid gap-2 rounded-xl border border-outline bg-surface p-4 text-sm">
            <p className="font-semibold">
              {visibleSummary?.orderCount} órdenes en el período
              seleccionado
            </p>

            <p className="text-muted">
              {summary.data.period.from} a {summary.data.period.to} ·{" "}
              {reportDateLabels[summary.data.dateField]} ·{" "}
              {summary.data.period.timezone}.
            </p>

            <p className="text-muted">
              Los indicadores superiores reflejan los filtros
              seleccionados. Consulta el historial para revisar las
              órdenes o elige una agrupación para comparar sus
              resultados.
            </p>
          </div>
        ) : null)}

      {view === "history" && (
        <>
          <ProductionOrderResults
            ids={
              history.data?.orders.map(
                (order) => order.productionOrderId
              ) ?? []
            }
            currency={currency}
            zone={zone}
            revision={revision}
            pending={!validationError && historyPending}
            error={validationError || history.error}
            onRetry={history.refresh}
            onChanged={onChanged}
          />

          {pagination && pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.total}
              itemLabel="órdenes"
              onPageChange={report.setPage}
              onPageSizeChange={report.changeSize}
            />
          )}
        </>
      )}

      {view !== "summary" &&
        view !== "history" &&
        !validationError &&
        (groupPending ? (
          <ProductionListState state="loading" />
        ) : groups.error ? (
          <ProductionListState
            state="error"
            message={groups.error}
            onRetry={groups.refresh}
          />
        ) : !groups.data?.groups.length ? (
          <ProductionListState state="empty" />
        ) : (
          <ReportGroups
            rows={groups.data.groups}
            product={view === "OUTPUT"}
            currency={currency}
          />
        ))}

      {!validationError && (
        <p className="text-xs leading-5 text-muted">
          El costo esperado se valora a la tarifa real de los insumos.
          Los costos de producción corresponden a órdenes completadas;
          el desperdicio también puede estar registrado en órdenes en
          proceso. “Sin valoración” indica que no hay un importe
          disponible.
          {view === "OUTPUT" &&
            " Una orden con varios productos puede aparecer en varias filas; sus costos se distribuyen según la asignación de cada producto."}
          {filters.outputInventoryItemId &&
            " El resumen y el historial consideran las órdenes que contienen el producto; la agrupación por producto muestra únicamente su costo asignado."}
        </p>
      )}
    </div>
  );
}
