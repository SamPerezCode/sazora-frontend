import {
  reportFiltersSchema,
  type ReportFilters,
} from "../schemas/report.schemas";

export const reportDateLabels = {
  CREATED: "Creación",
  PLANNED: "Fecha prevista",
  STARTED: "Inicio",
  COMPLETED: "Finalización",
};

export function initialReportFilters(today: string): ReportFilters {
  return {
    from: today.slice(0, 7) + "-01",
    to: today,
    dateField: "CREATED",
    search: "",
    status: "",
    membershipId: "",
    outputInventoryItemId: "",
  };
}

export function reportParameters(
  raw: ReportFilters,
  locationId: string
) {
  const filters = reportFiltersSchema.parse(raw);

  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    dateField: filters.dateField,
  });

  if (locationId) {
    params.set("locationId", locationId);
  }

  for (const field of [
    "status",
    "membershipId",
    "outputInventoryItemId",
  ] as const) {
    if (filters[field]) {
      params.set(field, filters[field]);
    }
  }

  if (filters.search) {
    const orderNumber = /^OP-(\d+)$/i.exec(filters.search);

    params.set(
      "search",
      orderNumber ? BigInt(orderNumber[1]).toString() : filters.search
    );
  }

  return params;
}
