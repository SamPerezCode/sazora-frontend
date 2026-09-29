import { ApiError, request } from "../../../lib/http/client";
import { dashboardResponseSchema } from "../schemas/dashboard.schema";
import type { DashboardData } from "../types/dashboard.types";

export async function getDashboard(
  accessToken: string,
  businessId: string,
  signal: AbortSignal
): Promise<DashboardData> {
  const response = await request(
    "/dashboard",
    dashboardResponseSchema,
    {
      accessToken,
      signal,
    }
  );

  if (response.data.business.id !== businessId) {
    throw new ApiError(
      502,
      "BUSINESS_MISMATCH",
      "El panel no corresponde al negocio activo."
    );
  }

  return response.data;
}
