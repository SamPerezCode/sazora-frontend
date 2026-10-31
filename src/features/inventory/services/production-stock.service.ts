import { z } from "zod";
import type { AuthSession } from "../../auth/types/auth.types";
import { ApiError, request } from "../../../lib/http/client";
import { balancesSchema } from "../schemas/inventory-location.schema";
import { assignedPlant } from "../components/production/utils/production.access";

export async function loadProductionStock(
  session: AuthSession,
  signal: AbortSignal,
  requestedLocation = ""
) {
  if (
    !session.authorization.roles.includes("PRODUCTION") ||
    session.authorization.roles.includes("ADMIN")
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso a esta consulta."
    );
  }

  const path =
    "/inventory-items/location-balances" +
    (requestedLocation
      ? "?locationId=" + encodeURIComponent(requestedLocation)
      : "");

  const response = await request(
    path,
    z.object({
      status: z.literal("success"),
      data: balancesSchema,
    }),
    {
      accessToken: session.accessToken,
      signal,
      cache: "no-store",
    }
  );

  const plant = assignedPlant(session);

  if (!plant) {
    throw new ApiError(
      403,
      "PRODUCTION_LOCATION_ACCESS_DENIED",
      "No tienes una planta de producción válida asignada."
    );
  }

  const { scope, balances } = response.data;

  if (
    (requestedLocation && requestedLocation !== plant.id) ||
    scope.type !== "LOCATION" ||
    scope.location.id !== plant.id ||
    balances.some(
      (row) =>
        row.location.id !== plant.id ||
        row.location.locationType !== "PRODUCTION_WAREHOUSE" ||
        !row.location.isActive
    )
  ) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "La respuesta no corresponde a tu planta asignada."
    );
  }

  return {
    location: scope.location,
    balances: balances.filter((row) => row.isItemActive),
  };
}
