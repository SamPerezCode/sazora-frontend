import { z } from "zod";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { fixed } from "../../../utils/inventory-value";
import { plantScope } from "../utils/production.access";
import { api } from "./production.api";
import {
  reportSummarySchema,
  historySchema,
} from "../schemas/production.schemas";

export async function loadPeriod(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string,
  from: string,
  to: string
) {
  const params = new URLSearchParams({
    from,
    to,
    dateField: "COMPLETED",
  });

  const location = plantScope(session, locationId);
  if (location) params.set("locationId", location);

  const summary = await api(
    session,
    signal,
    "/production-reports/summary?" + params,
    z.object({ report: reportSummarySchema })
  );

  params.set("pageSize", "100");

  const seen = new Set<string>();
  let count = 0;
  let expected = -1;
  let unavailable = false;

  for (let page = 1; ; page++) {
    signal.throwIfAborted();
    params.set("page", String(page));

    const { report } = await api(
      session,
      signal,
      "/production-reports/orders?" + params,
      z.object({ report: historySchema })
    );

    if (expected !== -1 && report.pagination.total !== expected) {
      throw new Error(
        "El período cambió durante la consulta. Actualiza."
      );
    }

    expected = report.pagination.total;

    for (const row of report.orders) {
      plantScope(session, row.location.id);

      if (seen.has(row.productionOrderId)) {
        throw new Error("El período cambió. Actualiza.");
      }

      seen.add(row.productionOrderId);

      if (row.status === "COMPLETED") {
        if (row.inputCostDifference === null) {
          unavailable = true;
        } else if (fixed(row.inputCostDifference) !== 0n) {
          count++;
        }
      }
    }

    if (page >= report.pagination.totalPages) break;

    if (!report.orders.length) {
      throw new Error("La consulta del período está incompleta.");
    }
  }

  if (seen.size !== expected) {
    throw new Error("La consulta del período está incompleta.");
  }

  return {
    summary: summary.report.summary,
    variations: unavailable ? null : count,
  };
}
