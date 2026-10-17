import { z } from "zod";

import { ApiError, request } from "../../lib/http/client";
import type { AuthSession } from "../auth/types/auth.types";

import {
  overviewSchema,
  salesReportSchema,
  cancellationReportSchema,
  kitchenReportSchema,
} from "./reports.schema";

import type {
  ReportScope,
  SalesFilters,
  CancellationFilters,
  KitchenFilters,
} from "./reports.schema";

type Params = Record<string, string | number | undefined>;

export function reportQuery(params: Params): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  return query.size ? `?${query}` : "";
}

async function read<
  T extends {
    business: { id: string };
    scope: ReportScope;
  },
>(
  path: string,
  schema: z.ZodType<T>,
  session: AuthSession,
  locationId: string,
  params: Params,
  signal: AbortSignal
): Promise<T> {
  if (
    !session.accessToken ||
    !session.authorization.roles.includes("ADMIN")
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permisos para consultar estos informes."
    );
  }

  const response = await request(
    path + reportQuery({ ...params, locationId }),
    z.object({
      status: z.literal("success"),
      data: schema,
    }),
    {
      accessToken: session.accessToken,
      signal,
      cache: "no-store",
    }
  );

  const data = response.data;

  if (
    data.business.id !== session.business.id ||
    (locationId
      ? data.scope.type !== "LOCATION" ||
        data.scope.location.id !== locationId
      : data.scope.type !== "BUSINESS")
  ) {
    throw new ApiError(
      502,
      "SCOPE_MISMATCH",
      "La respuesta no corresponde al alcance seleccionado."
    );
  }

  return data;
}

export const getOverview = (
  session: AuthSession,
  locationId: string,
  signal: AbortSignal
) =>
  read("/dashboard", overviewSchema, session, locationId, {}, signal);

export const getSalesReport = (
  session: AuthSession,
  locationId: string,
  filters: SalesFilters,
  page: number,
  signal: AbortSignal
) =>
  read(
    "/sales-reports/history",
    salesReportSchema,
    session,
    locationId,
    {
      from: filters.from,
      to: filters.to,
      serviceType: filters.serviceType,
      openedByMembershipId: filters.openedByMembershipId,
      page,
      pageSize: 20,
      topLimit: 5,
    },
    signal
  );

export const getCancellationReport = (
  session: AuthSession,
  locationId: string,
  filters: CancellationFilters,
  page: number,
  signal: AbortSignal
) =>
  read(
    "/sales-reports/cancellations",
    cancellationReportSchema,
    session,
    locationId,
    {
      from: filters.from,
      to: filters.to,
      serviceType: filters.serviceType,
      cancelledByMembershipId: filters.cancelledByMembershipId,
      eventType: filters.eventType,
      page,
      pageSize: 20,
    },
    signal
  );

export const getKitchenReport = (
  session: AuthSession,
  locationId: string,
  filters: KitchenFilters,
  signal: AbortSignal
) =>
  read(
    "/sales-reports/kitchen-operations",
    kitchenReportSchema,
    session,
    locationId,
    {
      from: filters.from,
      to: filters.to,
      serviceType: filters.serviceType,
      preparationAreaId: filters.preparationAreaId,
      workflowMode: filters.workflowMode,
    },
    signal
  );

export function reportError(error: ApiError): string {
  if (error.status === 403) {
    return "No tienes permisos para consultar estos informes.";
  }

  switch (error.code) {
    case "LOCATION_NOT_FOUND":
      return "La ubicación seleccionada ya no está disponible.";

    case "LOCATION_INACTIVE":
      return "La ubicación seleccionada está inactiva.";

    case "LOCATION_NOT_POINT_OF_SALE":
      return "Los informes operativos solo aplican a puntos de venta.";

    case "PREPARATION_AREA_NOT_FOUND":
      return "El área ya no pertenece a la ubicación seleccionada.";

    default:
      return error.message;
  }
}
