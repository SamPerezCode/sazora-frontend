import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../hooks/useInventoryQuery";
import { productionRoles } from "../utils/production.access";
import { initialReportFilters } from "../utils/report.utils";
import {
  reportFiltersSchema,
  type ReportFilters,
  type ReportView,
} from "../schemas/report.schemas";
import {
  loadReportSummary,
  loadReportHistory,
  loadReportGroups,
  loadReportOptions,
} from "../services/report.service";

export function useProductionReports(
  locationId: string,
  today: string,
  revision: number
) {
  const [filters, setFilters] = useState(() =>
    initialReportFilters(today)
  );

  const [view, setView] = useState<ReportView>("summary");

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const key = JSON.stringify(filters);
  const [settledKey, setSettledKey] = useState(key);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledKey(key), 300);

    return () => window.clearTimeout(timer);
  }, [key]);

  const settled = useMemo(
    () => reportFiltersSchema.safeParse(JSON.parse(settledKey)),
    [settledKey]
  );

  const validation = reportFiltersSchema.safeParse(filters);

  const validationError = validation.success
    ? ""
    : validation.error.issues[0].message;

  const settling = key !== settledKey;

  const active = !settling && validation.success && settled.success;

  const baseKey = JSON.stringify([
    filters.from,
    filters.to,
    filters.dateField,
  ]);

  const base = useMemo(() => {
    const [from, to, dateField] = JSON.parse(baseKey);

    return reportFiltersSchema.safeParse({
      ...initialReportFilters(to),
      from,
      to,
      dateField,
    });
  }, [baseKey]);

  const summaryLoader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      active && settled.success
        ? loadReportSummary(session, signal, locationId, settled.data)
        : Promise.resolve(null),
    [active, settled, locationId]
  );

  const historyLoader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      active && settled.success && view === "history"
        ? loadReportHistory(
            session,
            signal,
            locationId,
            settled.data,
            page,
            size
          )
        : Promise.resolve(null),
    [active, settled, locationId, view, page, size]
  );

  const groupsLoader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      active &&
      settled.success &&
      view !== "summary" &&
      view !== "history"
        ? loadReportGroups(
            session,
            signal,
            locationId,
            settled.data,
            view
          )
        : Promise.resolve(null),
    [active, settled, locationId, view]
  );

  const optionsLoader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      base.success
        ? loadReportOptions(session, signal, locationId, base.data)
        : Promise.resolve(null),
    [base, locationId]
  );

  const scope = locationId + ":" + settledKey + ":" + active;

  const summary = useInventoryQuery(
    "production-report-summary:" + scope,
    summaryLoader,
    revision,
    productionRoles
  );

  const history = useInventoryQuery(
    "production-report-history:" +
      scope +
      ":" +
      view +
      ":" +
      page +
      ":" +
      size,
    historyLoader,
    revision,
    productionRoles
  );

  const groups = useInventoryQuery(
    "production-report-groups:" + scope + ":" + view,
    groupsLoader,
    revision,
    productionRoles
  );

  const options = useInventoryQuery(
    "production-report-options:" + locationId + ":" + baseKey,
    optionsLoader,
    revision,
    productionRoles
  );

  function change<K extends keyof ReportFilters>(
    field: K,
    value: ReportFilters[K]
  ) {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
    }));

    setPage(1);
  }

  function reset() {
    setFilters(initialReportFilters(today));
    setPage(1);
  }

  return {
    filters,
    change,
    reset,
    view,
    setView,
    page,
    setPage,
    size,

    changeSize: (value: number) => {
      setSize(value);
      setPage(1);
    },

    validationError,
    settling,
    summary,
    history,
    groups,
    options,
  };
}
