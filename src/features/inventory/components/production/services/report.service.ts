import { z } from "zod";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { ApiError } from "../../../../../lib/http/client";
import { plantScope } from "../utils/production.access";
import { reportParameters } from "../utils/report.utils";
import {
  summaryReportSchema,
  historyReportSchema,
  groupedReportSchema,
  type ReportFilters,
  type ReportGroupBy,
} from "../schemas/report.schemas";
import { api } from "./production.api";

function verify<
  T extends {
    period: {
      from: string;
      to: string;
      timezone: string;
    };
    dateField: string;
  },
>(report: T, filters: ReportFilters) {
  if (
    report.period.from !== filters.from ||
    report.period.to !== filters.to ||
    report.dateField !== filters.dateField
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El informe no corresponde al período solicitado."
    );
  }

  new Intl.DateTimeFormat("es-CO", {
    timeZone: report.period.timezone,
  });

  return report;
}

export async function loadReportSummary(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string,
  filters: ReportFilters
) {
  const params = reportParameters(
    filters,
    plantScope(session, locationId)
  );

  const { report } = await api(
    session,
    signal,
    "/production-reports/summary?" + params,
    z.object({
      report: summaryReportSchema,
    })
  );

  return verify(report, filters);
}

export async function loadReportGroups(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string,
  filters: ReportFilters,
  groupBy: ReportGroupBy
) {
  const location = plantScope(session, locationId);
  const params = reportParameters(filters, location);

  params.set("groupBy", groupBy);

  const { report } = await api(
    session,
    signal,
    "/production-reports/groups?" + params,
    z.object({
      report: groupedReportSchema,
    })
  );

  verify(report, filters);

  if (report.groupBy !== groupBy) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La agrupación recibida no corresponde a la consulta."
    );
  }

  if (groupBy === "LOCATION") {
    for (const row of report.groups) {
      plantScope(session, row.key);

      if (location && row.key !== location) {
        throw new ApiError(
          502,
          "INVALID_RESPONSE",
          "La agrupación no corresponde a la planta."
        );
      }
    }
  }

  return report;
}

export async function loadReportHistory(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string,
  filters: ReportFilters,
  page: number,
  pageSize: number
) {
  const location = plantScope(session, locationId);
  const params = reportParameters(filters, location);

  params.set("pageSize", String(pageSize));

  async function read(current: number) {
    params.set("page", String(current));

    const { report } = await api(
      session,
      signal,
      "/production-reports/orders?" + params,
      z.object({
        report: historyReportSchema,
      })
    );

    verify(report, filters);

    if (
      report.pagination.page !== current ||
      report.pagination.pageSize !== pageSize
    ) {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "La página recibida no corresponde a la consulta."
      );
    }

    for (const row of report.orders) {
      plantScope(session, row.location.id);

      if (location && row.location.id !== location) {
        throw new ApiError(
          502,
          "INVALID_RESPONSE",
          "La orden no corresponde a la planta."
        );
      }
    }

    return report;
  }

  const report = await read(page);
  const last = Math.max(1, report.pagination.totalPages);

  return page > last ? read(last) : report;
}

export async function loadReportOptions(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string,
  filters: ReportFilters
) {
  const base = {
    ...filters,
    search: "",
    status: "" as const,
    membershipId: "",
    outputInventoryItemId: "",
  };

  const [employees, outputs] = await Promise.all([
    loadReportGroups(session, signal, locationId, base, "EMPLOYEE"),
    loadReportGroups(session, signal, locationId, base, "OUTPUT"),
  ]);

  const options = (rows: { key: string; label: string }[]) =>
    [
      ...new Map(
        rows.map((row) => [
          row.key,
          {
            value: row.key,
            label: row.label,
          },
        ])
      ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label, "es"));

  return {
    employees: options(employees.groups),
    outputs: options(outputs.groups),
  };
}
