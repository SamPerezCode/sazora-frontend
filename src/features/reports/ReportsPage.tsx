import { useCallback, useMemo, useState } from "react";

import type { AuthSession } from "../auth/types/auth.types";

import { useAppShell } from "../../app/layout/shell-context";
import { ApiError } from "../../lib/http/client";
import { Alert } from "../../components/feedback/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/forms/SelectField";

import { useSalesLocations } from "../sales/hooks/useSalesLocations";
import { getEmployees } from "../employees/services/employee.service";
import { getPreparationAreas } from "../preparation-areas/services/preparation-area.service";
import { HistoryOrderDetail } from "../sales/components/HistoryOrderDetail";

import { useReportQuery } from "./useReportQuery";

import {
  getOverview,
  getSalesReport,
  getCancellationReport,
  getKitchenReport,
  reportError,
} from "./reports.service";

import { filterSchema } from "./reports.schema";

import type {
  ReportFilters as Filters,
  ReportTab,
} from "./reports.schema";

import {
  amount,
  dateRange,
  dateTime,
  eventLabels,
  initialFilters,
  number,
} from "./reports.format";

import { ReportFilters } from "./ReportFilters";
import { Notice, ReportSkeleton } from "./ReportUI";

import {
  Overview,
  SalesView,
  CancellationsView,
  KitchenView,
} from "./ReportViews";

import type { OrderSelection } from "./ReportViews";

import "./reports.css";

const tabs: { id: ReportTab; label: string }[] = [
  { id: "summary", label: "Resumen" },
  { id: "sales", label: "Ventas" },
  { id: "cancellations", label: "Cancelaciones" },
  { id: "kitchen", label: "Cocina" },
];

interface FilterState {
  draft: Filters;
  applied: Filters;
  page: number;
  errors: Record<string, string>;
}

function newState(timezone: string): FilterState {
  const filters = initialFilters(timezone);

  return {
    draft: filters,
    applied: filters,
    page: 1,
    errors: {},
  };
}

export function ReportsPage() {
  const { session, settings } = useAppShell();

  if (
    !session.accessToken ||
    !session.authorization.roles.includes("ADMIN")
  ) {
    return (
      <Alert>No tienes permisos para consultar estos informes.</Alert>
    );
  }

  if (settings.loading) return <ReportSkeleton />;

  if (!settings.data || settings.error) {
    return (
      <Alert>
        {settings.error ??
          "No pudimos cargar la configuración del negocio."}

        <Button variant="soft" onClick={settings.retry}>
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <ReportsContent
      key={[
        session.business.id,
        session.membership.id,
        session.accessToken,
      ].join(":")}
      session={session}
      timezone={settings.data.timezone}
      currency={settings.data.currencyCode}
    />
  );
}

function ReportsContent({
  session,
  timezone,
  currency,
}: {
  session: AuthSession;
  timezone: string;
  currency: string;
}) {
  const locations = useSalesLocations(session);

  const [locationId, setLocationId] = useState("");
  const [tab, setTab] = useState<ReportTab>("summary");

  const [states, setStates] = useState<
    Record<ReportTab, FilterState>
  >(() => ({
    summary: newState(timezone),
    sales: newState(timezone),
    cancellations: newState(timezone),
    kitchen: newState(timezone),
  }));

  const [notice, setNotice] = useState("");
  const [order, setOrder] = useState<OrderSelection | null>(null);

  const active = states[tab];

  const identity = [
    session.business.id,
    session.membership.id,
    session.accessToken,
  ].join(":");

  const changeLocation = useCallback((id: string) => {
    setLocationId(id);
    setOrder(null);

    setStates((previous) => {
      const reset = (state: FilterState) => ({
        ...state,
        page: 1,
        errors: {},
      });

      return {
        summary: reset(previous.summary),
        sales: reset(previous.sales),
        cancellations: reset(previous.cancellations),

        kitchen: {
          ...reset(previous.kitchen),

          draft: {
            ...previous.kitchen.draft,
            preparationAreaId: "",
          },

          applied: {
            ...previous.kitchen.applied,
            preparationAreaId: "",
          },
        },
      };
    });
  }, []);

  const handleError = useCallback(
    (error: ApiError) => {
      if (error.code === "LOCATION_NOT_FOUND") {
        setNotice(reportError(error));
        changeLocation("");
      } else if (error.code === "PREPARATION_AREA_NOT_FOUND") {
        setNotice(reportError(error));

        setStates((previous) => ({
          ...previous,

          kitchen: {
            ...previous.kitchen,
            page: 1,

            draft: {
              ...previous.kitchen.draft,
              preparationAreaId: "",
            },

            applied: {
              ...previous.kitchen.applied,
              preparationAreaId: "",
            },
          },
        }));
      } else if (error.code === "VALIDATION_ERROR") {
        setStates((previous) => ({
          ...previous,

          [tab]: {
            ...previous[tab],

            errors: Object.fromEntries(
              error.errors.map((entry) => [
                entry.field.replace(/^query\./, ""),
                entry.message,
              ])
            ),
          },
        }));
      }
    },
    [changeLocation, tab]
  );

  const loadEmployees = useCallback(
    (signal: AbortSignal) =>
      getEmployees(session.accessToken, signal),
    [session.accessToken]
  );

  const employees = useReportQuery(
    identity + ":report-employees",
    loadEmployees,
    tab === "sales" || tab === "cancellations"
  );

  const loadAreas = useCallback(
    (signal: AbortSignal) =>
      getPreparationAreas(session.accessToken, signal, {
        ...(locationId ? { locationId } : {}),
        activeOnly: true,
      }),
    [session.accessToken, locationId]
  );

  const areas = useReportQuery(
    identity + ":report-areas:" + (locationId || "all"),
    loadAreas,
    tab === "kitchen",
    handleError
  );

  const load = useCallback(
    async (signal: AbortSignal) => {
      switch (tab) {
        case "summary":
          return {
            tab,
            data: await getOverview(session, locationId, signal),
          } as const;

        case "sales":
          return {
            tab,
            data: await getSalesReport(
              session,
              locationId,
              active.applied,
              active.page,
              signal
            ),
          } as const;

        case "cancellations":
          return {
            tab,
            data: await getCancellationReport(
              session,
              locationId,
              active.applied,
              active.page,
              signal
            ),
          } as const;

        case "kitchen":
          return {
            tab,
            data: await getKitchenReport(
              session,
              locationId,
              active.applied,
              signal
            ),
          } as const;
      }
    },
    [tab, session, locationId, active.applied, active.page]
  );

  const key = JSON.stringify([
    "report",
    identity,
    tab,
    locationId || "all",
    active.applied,
    active.page,
  ]);

  const report = useReportQuery(key, load, true, handleError);

  function update(patch: Partial<FilterState>) {
    setStates((previous) => ({
      ...previous,
      [tab]: {
        ...previous[tab],
        ...patch,
      },
    }));
  }

  function apply(draft: Filters) {
    const parsed = filterSchema.safeParse(draft);

    if (!parsed.success) {
      update({
        draft,
        errors: Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ])
        ),
      });

      return;
    }

    const selectedArea = parsed.data.preparationAreaId;

    if (
      tab === "kitchen" &&
      selectedArea &&
      !areas.data?.some(
        (area) =>
          area.id === selectedArea &&
          (!locationId ||
            area.locations.some(
              (location) => location.id === locationId
            ))
      )
    ) {
      update({
        draft,
        errors: {
          preparationAreaId:
            "Selecciona un área disponible para esta ubicación.",
        },
      });

      return;
    }

    setOrder(null);

    update({
      draft: parsed.data,
      applied: parsed.data,
      page: 1,
      errors: {},
    });
  }

  const selectedLocation = locations.options.find(
    (location) => location.id === locationId
  );

  const scope = useMemo(
    () =>
      order
        ? {
            businessId: session.business.id,
            location: {
              id: order.locationId,
              name: order.locationName,
              code: order.locationCode,
            },
          }
        : null,
    [order, session.business.id]
  );

  const formatAmount = useCallback(
    (value: string) => amount(value, currency),
    [currency]
  );

  const formatDate = useCallback(
    (value: string) => dateTime(value, timezone),
    [timezone]
  );

  return (
    <div className="rp-page">
      <div className="rp-toolbar">
        <nav className="rp-tabs" aria-label="Informes">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => {
                setTab(item.id);
                setOrder(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <SelectField
          label="Ubicación"
          value={locationId}
          disabled={locations.loading}
          options={[
            {
              value: "",
              label: "Todas las ubicaciones",
            },
            ...locations.options.map((location) => ({
              value: location.id,
              label: location.name + " · " + location.code,
            })),
          ]}
          onValueChange={(id) => {
            setNotice("");
            changeLocation(id);
          }}
        />
      </div>

      <p className="rp-muted">
        {locationId
          ? selectedLocation
            ? selectedLocation.name + " · " + selectedLocation.code
            : "Ubicación seleccionada"
          : "Todas las ubicaciones"}
      </p>

      {locations.error && (
        <Alert>
          {locations.error}

          <Button variant="soft" onClick={locations.retry}>
            Reintentar ubicaciones
          </Button>
        </Alert>
      )}

      {notice && <Notice>{notice}</Notice>}

      {tab !== "summary" && (
        <>
          <ReportFilters
            tab={tab}
            timeZone={timezone}
            draft={active.draft}
            errors={active.errors}
            employees={(employees.data ?? []).map((employee) => ({
              value: employee.membershipId,
              label:
                employee.fullName +
                (!employee.isActive || !employee.membershipIsActive
                  ? " (inactivo)"
                  : ""),
            }))}
            areas={(areas.data ?? []).map((area) => ({
              value: area.id,
              label: locationId
                ? area.name
                : area.name +
                  " · " +
                  area.locations
                    .filter(
                      (location) =>
                        location.locationType === "POINT_OF_SALE"
                    )
                    .map(
                      (location) =>
                        location.name + " (" + location.code + ")"
                    )
                    .join(", "),
            }))}
            employeesLoading={employees.loading || !!employees.error}
            areasLoading={areas.loading || !!areas.error}
            onChange={(field, value) =>
              update({
                draft: {
                  ...active.draft,
                  [field]: value,
                },
                errors: {},
              })
            }
            onApply={() => apply(active.draft)}
            onClear={() =>
              apply({
                ...initialFilters(timezone),
                from: active.draft.from,
                to: active.draft.to,
              })
            }
            onShortcut={(shortcut) =>
              apply({
                ...active.draft,
                ...dateRange(timezone, shortcut),
              })
            }
          />

          {(tab === "sales" || tab === "cancellations") &&
            employees.error && (
              <Alert>
                {reportError(employees.error)}

                <Button variant="soft" onClick={employees.retry}>
                  Reintentar empleados
                </Button>
              </Alert>
            )}

          {tab === "kitchen" && (
            <>
              {!locationId && (
                <Notice>
                  Las áreas pueden estar asignadas a varias sedes. Sus
                  nombres indican las ubicaciones asociadas.
                </Notice>
              )}

              {areas.error && (
                <Alert>
                  {reportError(areas.error)}

                  <Button variant="soft" onClick={areas.retry}>
                    Reintentar áreas
                  </Button>
                </Alert>
              )}
            </>
          )}
        </>
      )}

      {report.loading && <ReportSkeleton />}

      {report.error && (
        <Alert>
          <p>{reportError(report.error)}</p>

          {report.error.errors.length > 0 && (
            <ul>
              {report.error.errors.map((entry, index) => (
                <li key={entry.field + index}>{entry.message}</li>
              ))}
            </ul>
          )}

          {report.error.status !== 401 &&
            report.error.status !== 403 && (
              <Button variant="soft" onClick={report.retry}>
                Reintentar
              </Button>
            )}
        </Alert>
      )}

      {report.data?.tab === "summary" && (
        <Overview data={report.data.data} />
      )}

      {report.data?.tab === "sales" && (
        <SalesView
          data={report.data.data}
          onOrder={setOrder}
          onPage={(page) => update({ page })}
        />
      )}

      {report.data?.tab === "cancellations" && (
        <CancellationsView
          data={report.data.data}
          onOrder={setOrder}
          onPage={(page) => update({ page })}
        />
      )}

      {report.data?.tab === "kitchen" && (
        <KitchenView data={report.data.data} />
      )}

      {report.data && (
        <footer className="rp-footer">
          <span>
            Actualizado:{" "}
            {dateTime(
              report.data.data.generatedAt,
              report.data.data.business.timezone
            )}
          </span>

          <Button variant="soft" size="sm" onClick={report.retry}>
            Actualizar
          </Button>
        </footer>
      )}

      {order && scope && (
        <HistoryOrderDetail
          row={{
            id: order.orderId,
            serviceType: order.serviceType,
            restaurantTableId: order.restaurantTableId,
            restaurantTableName: order.restaurantTableName,
            restaurantTableCode: order.restaurantTableCode,
          }}
          token={session.accessToken}
          scope={scope}
          readOnly
          formatAmount={formatAmount}
          formatDate={formatDate}
          onClose={() => setOrder(null)}
          onLocationLost={setNotice}
          context={
            order.event && (
              <div className="rp-event">
                <h3>Evento de cancelación seleccionado</h3>

                <dl>
                  <div>
                    <dt>Producto</dt>
                    <dd>{order.event.productName}</dd>
                  </div>

                  <div>
                    <dt>Tipo</dt>
                    <dd>{eventLabels[order.event.eventType]}</dd>
                  </div>

                  <div>
                    <dt>Cantidad cancelada</dt>
                    <dd>{number(order.event.cancelledQuantity)}</dd>
                  </div>

                  <div>
                    <dt>Cantidad restante</dt>
                    <dd>{order.event.remainingQuantity ?? "—"}</dd>
                  </div>

                  <div>
                    <dt>Motivo</dt>
                    <dd>{order.event.reason || "—"}</dd>
                  </div>

                  <div>
                    <dt>Responsable</dt>
                    <dd>{order.event.cancelledByName}</dd>
                  </div>

                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatDate(order.event.cancelledAt)}</dd>
                  </div>
                </dl>
              </div>
            )
          }
        />
      )}
    </div>
  );
}
