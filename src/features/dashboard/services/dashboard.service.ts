import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { canAccessDashboard } from "../../auth/utils/permissions";
import { dashboardResponseSchema } from "../schemas/dashboard.schema";
import type { DashboardData } from "../types/dashboard.types";

export async function getDashboard(
  session: AuthSession,
  signal: AbortSignal,
  locationId = ""
): Promise<DashboardData> {
  if (!canAccessDashboard(session)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para consultar el Resumen general."
    );
  }

  const path =
    "/dashboard" +
    (locationId
      ? "?locationId=" + encodeURIComponent(locationId)
      : "");

  const response = await request(path, dashboardResponseSchema, {
    accessToken: session.accessToken,
    signal,
    cache: "no-store",
  });

  if (response.data.business.id !== session.business.id) {
    throw new ApiError(
      502,
      "BUSINESS_MISMATCH",
      "El panel no corresponde al negocio activo."
    );
  }

  return response.data;
}
