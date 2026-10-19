import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
} from "lucide-react";

import type { AuthSession } from "../../auth/types/auth.types";
import { DateField } from "../../../components/forms/DateField";
import { calendarToday } from "../../../components/forms/calendar-date";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadSummary } from "../services/inventory-location.service";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { loadInventoryPeriod } from "../services/inventory-summary.service";
import type { Balance } from "../schemas/inventory-location.schema";
import { fixed, money, unvalued } from "../utils/inventory-value";
import { dayKey } from "../utils/inventory-format";
import { movementLabels } from "../utils/inventory-audit";
import { Notice } from "./InventoryLocationUI";
import { InventoryMovementDetail } from "./InventoryMovementDetail";

type Review = "unvalued" | "negative" | "attention";

type TableRow = {
  id: string;
  cells: ReactNode[];
};

const actionClass =
  "inline-flex min-h-10 w-fit max-w-full shrink-0 items-center justify-center gap-2 " +
  "rounded-xl border px-3 py-2 text-[14px] leading-5 transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const linkClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 " +
  "text-[13px] text-heading hover:bg-secondary focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent";

const countItems = (rows: Balance[]) =>
  new Set(rows.map((row) => row.inventoryItemId)).size;

function ResponsiveTable({
  headers,
  rows,
  empty,
  firstColumnClass = "w-[16%]",
}: {
  headers: string[];
  rows: TableRow[];
  empty: string;
  firstColumnClass?: string;
}) {
  if (!rows.length) {
    return <Notice>{empty}</Notice>;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[14px] border border-outline bg-surface md:block">
        <table className="w-full table-fixed border-collapse text-left text-[13px] leading-[18px]">
          <thead className="bg-secondary/50 text-muted">
            <tr>
              {headers.map((label, index) => (
                <th
                  key={label}
                  className={
                    "px-3 py-[14px] font-normal " +
                    (index === 0 ? firstColumnClass : "")
                  }
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-outline">
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td
                    key={headers[index]}
                    className="break-words px-3 py-[14px] align-top"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <dl
            key={row.id}
            className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[14px] border border-outline bg-surface p-4"
          >
            {row.cells.map((cell, index) => (
              <div
                key={headers[index]}
                className={
                  index === 0 ? "col-span-2 min-w-0" : "min-w-0"
                }
              >
                <dt className="mb-1 text-[12px] leading-4 text-muted">
                  {headers[index]}
                </dt>

                <dd className="break-words text-[13px] leading-5 text-heading">
                  {cell}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </>
  );
}

export function InventorySummary({
  data,
  locationId,
  currency,
  timezone,
  revision,
  workspaceReady,
  onReview,
  onMovements,
}: {
  data: InventoryWorkspace;
  locationId: string;
  currency: string;
  timezone: string;
  revision: number;
  workspaceReady: boolean;
  onReview: (filter: Review) => void;
  onMovements: () => void;
}) {
  const [today, setToday] = useState(() => calendarToday(timezone));

  const [dates, setDates] = useState(() => ({
    from: calendarToday(timezone).slice(0, 7) + "-01",
    to: calendarToday(timezone),
  }));

  const [opened, setOpened] = useState<{
    id: string;
    production: boolean;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(calendarToday(timezone)),
      60_000
    );

    return () => window.clearInterval(timer);
  }, [timezone]);

  const summaryLoader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadSummary(session, signal, locationId),
    [locationId]
  );

  const periodLoader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadInventoryPeriod(
        session,
        signal,
        { ...dates, locationId },
        timezone
      ),
    [dates, locationId, timezone]
  );

  const current = useInventoryQuery(
    "inventory-summary:" + locationId,
    summaryLoader,
    revision
  );

  const period = useInventoryQuery(
    JSON.stringify([
      "inventory-summary-period",
      locationId,
      dates,
      timezone,
      today,
    ]),
    periodLoader,
    revision
  );

  const ready =
    workspaceReady &&
    !current.pending &&
    !current.error &&
    !!current.data;

  const report = ready ? current.data : null;

  const financial =
    !period.pending && !period.error ? period.data : null;

  const cash = (value: string | null) =>
    money(value, currency).replace(/,00(?=\D*$)/, "");

  const balances = data.balances.filter(
    (row) => !locationId || row.location.id === locationId
  );

  const active = balances.filter((row) => row.isItemActive);

  const withoutCost = balances.filter(unvalued);

  const negative = balances.filter(
    (row) => fixed(row.currentStock) < 0n
  );

  const attention = balances.filter(
    (row) => unvalued(row) || fixed(row.currentStock) < 0n
  );

  const metrics = [
    {
      label: "Valor total del inventario",
      value: report ? cash(report.summary.totalInventoryValue) : "—",
      color: "text-heading",
    },
    {
      label: "Artículos activos",
      value: ready
        ? locationId
          ? countItems(active)
          : data.items.filter((item) => item.isActive).length
        : "—",
      color: "text-heading",
    },
    {
      label: "Artículos agotados",
      value: ready
        ? countItems(
            active.filter((row) => fixed(row.currentStock) <= 0n)
          )
        : "—",
      color: "text-red-600 dark:text-red-400",
    },
    {
      label: "Artículos bajo mínimo",
      value: ready
        ? countItems(
            active.filter((row) => row.stockStatus === "LOW_STOCK")
          )
        : "—",
      color: "text-accent",
    },
    {
      label: "Artículos sin valorar",
      value: ready ? countItems(withoutCost) : "—",
      color: "text-accent",
    },
    {
      label: "Movimientos del día",
      value: financial
        ? financial.movements.filter(
            (row) => dayKey(row.createdAt, timezone) === today
          ).length
        : "—",
      color: "text-heading",
    },
    {
      label: "Compras del período",
      value: financial ? cash(financial.purchases) : "—",
      color: "text-heading",
    },
    {
      label: "Costo de producción del período",
      value: financial ? cash(financial.production) : "—",
      color: "text-heading",
    },
  ];

  const locations = new Map(
    data.locations.map((location) => [
      location.id,
      {
        id: location.id,
        name: location.name,
        code: location.code,
      },
    ])
  );

  for (const row of data.balances) {
    locations.set(row.location.id, row.location);
  }

  for (const row of report?.byLocation ?? []) {
    locations.set(row.location.id, row.location);
  }

  const locationRows: TableRow[] = [...locations.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((location) => {
      const local = data.balances.filter(
        (row) => row.location.id === location.id
      );

      const totals = report?.byLocation.find(
        (row) => row.location.id === location.id
      );

      return {
        id: location.id,
        cells: [
          location.name + " · " + location.code,

          countItems(local.filter((row) => row.isItemActive)),

          totals
            ? cash(totals.totalInventoryValue)
            : local.length
              ? "—"
              : cash("0"),

          countItems(
            local.filter(
              (row) =>
                row.isItemActive && row.stockStatus !== "AVAILABLE"
            )
          ),

          countItems(local.filter(unvalued)),
        ],
      };
    });

  const dateFormat = new Intl.DateTimeFormat("es-CO", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const recentRows: TableRow[] = (financial?.recent ?? []).map(
    (row) => ({
      id: row.id,
      cells: [
        dateFormat.format(new Date(row.createdAt)),

        movementLabels[row.movementType],

        row.location
          ? row.location.name + " · " + row.location.code
          : "Sin ubicación histórica",

        row.externalReference || "M-" + row.id,

        row.movementType === "PRODUCTION" ? (
          <div>
            <p>Costo trasladado: {cash(row.outgoing)}</p>
            <p className="text-muted">
              Impacto neto: {cash(row.impact)}
            </p>
          </div>
        ) : row.impact === null ? (
          "Sin valorar"
        ) : (
          cash(row.impact)
        ),

        <button
          type="button"
          className={linkClass}
          aria-label={"Ver detalle del movimiento " + row.id}
          onClick={() =>
            setOpened({
              id: row.id,
              production: row.movementType === "PRODUCTION",
            })
          }
        >
          Ver detalle
        </button>,
      ],
    })
  );

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-h-[80px] min-w-0 flex-col justify-center gap-2 rounded-[14px] border border-outline bg-surface px-4 py-3 sm:min-h-[96px] sm:px-[18px] sm:py-4"
          >
            <p className="text-[12px] leading-5 text-muted sm:text-[14px]">
              {metric.label}
            </p>

            <strong
              className={
                "break-words text-[20px] leading-7 font-bold tabular-nums sm:text-[24px] " +
                metric.color
              }
            >
              {metric.value}
            </strong>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DateField
          label="Desde"
          value={dates.from}
          timeZone={timezone}
          clearable={false}
          onValueChange={(from) =>
            setDates((previous) => ({
              ...previous,
              from,
            }))
          }
          className="[&_.date-field-label]:text-[14px] [&_.date-field-label]:text-heading [&_.date-field-trigger]:h-10 [&_.date-field-trigger]:text-[14px]"
        />

        <DateField
          label="Hasta"
          value={dates.to}
          timeZone={timezone}
          clearable={false}
          onValueChange={(to) =>
            setDates((previous) => ({
              ...previous,
              to,
            }))
          }
          className="[&_.date-field-label]:text-[14px] [&_.date-field-label]:text-heading [&_.date-field-trigger]:h-10 [&_.date-field-trigger]:text-[14px]"
        />

        <p className="text-[12px] leading-5 text-muted sm:col-span-2">
          El período filtra compras, producción y actividad reciente.
          Las existencias muestran el estado actual.
        </p>
      </div>

      {current.error && (
        <Notice>
          {current.error}{" "}
          <button
            type="button"
            className={linkClass}
            onClick={current.refresh}
          >
            Reintentar resumen
          </button>
        </Notice>
      )}

      {(current.pending || period.pending) && (
        <p role="status" className="text-[13px] text-muted">
          Actualizando resumen…
        </p>
      )}

      {ready && attention.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {withoutCost.length > 0 && (
            <button
              type="button"
              onClick={() => onReview("unvalued")}
              className={
                actionClass +
                " border-accent/40 bg-transparent text-accent hover:bg-accent/10"
              }
            >
              <CircleAlert
                size={16}
                className="shrink-0"
                aria-hidden
              />
              {withoutCost.length}{" "}
              {withoutCost.length === 1
                ? "existencia local sin costo"
                : "existencias locales sin costo"}
            </button>
          )}

          {negative.length > 0 && (
            <button
              type="button"
              onClick={() => onReview("negative")}
              className={
                actionClass +
                " border-red-500/40 bg-transparent text-red-600 hover:bg-red-500/10 dark:text-red-400"
              }
            >
              <CircleAlert
                size={16}
                className="shrink-0"
                aria-hidden
              />
              {negative.length}{" "}
              {negative.length === 1
                ? "saldo negativo"
                : "saldos negativos"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onReview("attention")}
            className={
              actionClass +
              " border-outline bg-transparent text-heading hover:bg-secondary"
            }
          >
            <ClipboardCheck
              size={16}
              className="shrink-0"
              aria-hidden
            />
            Revisar {countItems(attention)}{" "}
            {countItems(attention) === 1 ? "artículo" : "artículos"}
          </button>
        </div>
      )}

      {report?.summary.hasUnvaluedStock && (
        <Notice>
          El valor total no está disponible mientras existan saldos
          sin valorar.
        </Notice>
      )}

      {!locationId && (
        <section
          className="grid min-w-0 gap-3"
          aria-label="Comparación por ubicación"
        >
          <h3 className="text-[16px] leading-6 font-bold">
            Comparación por ubicación
          </h3>

          {ready ? (
            <ResponsiveTable
              firstColumnClass="w-[34%]"
              headers={[
                "Ubicación",
                "Artículos",
                "Valor total",
                "Artículos críticos",
                "Sin valorar",
              ]}
              rows={locationRows}
              empty="No hay ubicaciones de inventario disponibles."
            />
          ) : (
            <p className="text-[13px] text-muted">
              Comparación pendiente de actualización.
            </p>
          )}

          {ready && !balances.length && data.locations.length > 0 && (
            <p className="text-[12px] leading-5 text-muted">
              Todavía no hay saldos registrados por ubicación. Los
              artículos del catálogo aparecerán aquí cuando tengan un
              saldo local.
            </p>
          )}
        </section>
      )}

      <section
        className="grid min-w-0 gap-3"
        aria-label="Actividad reciente"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] leading-6 font-bold">
            Actividad reciente
          </h3>

          <button
            type="button"
            className={linkClass}
            onClick={onMovements}
          >
            Ver movimientos
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>

        {period.error ? (
          <Notice>
            {period.error}{" "}
            <button
              type="button"
              className={linkClass}
              onClick={period.refresh}
            >
              Reintentar actividad
            </button>
          </Notice>
        ) : period.pending ? (
          <p className="text-[13px] text-muted">
            Consultando movimientos…
          </p>
        ) : (
          <ResponsiveTable
            headers={[
              "Fecha",
              "Tipo",
              "Ubicación",
              "Referencia",
              "Impacto económico",
              "Acción",
            ]}
            rows={recentRows}
            empty="No hay movimientos para esta ubicación y período."
          />
        )}

        {financial &&
          (financial.purchases === null ||
            financial.production === null) && (
            <Notice>
              Hay operaciones sin valorar. Los totales incompletos se
              muestran con «—».
            </Notice>
          )}
      </section>

      {opened && (
        <InventoryMovementDetail
          id={opened.id}
          production={opened.production}
          currency={currency}
          timezone={timezone}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
