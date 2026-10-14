import { request } from "../../../lib/http/client";
import {
  areaIdSchema,
  areaListResponseSchema,
  areaResponseSchema,
} from "../schemas/preparation-area.schema";
import type { AreaAction } from "../schemas/preparation-area.schema";

export async function getPreparationAreas(
  accessToken: string,
  signal: AbortSignal,
  filters: {
    locationId?: string;
    activeOnly?: boolean;
  } = {}
) {
  const params = new URLSearchParams();

  if (filters.locationId) {
    params.set("locationId", areaIdSchema.parse(filters.locationId));
  }

  if (filters.activeOnly !== undefined) {
    params.set("activeOnly", String(filters.activeOnly));
  }

  const query = params.size ? `?${params}` : "";

  const response = await request(
    `/preparation-areas${query}`,
    areaListResponseSchema,
    {
      accessToken,
      signal,
      cache: "no-store",
    }
  );

  return response.data.preparationAreas;
}

export async function getPreparationArea(
  id: string,
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request(
    `/preparation-areas/${areaIdSchema.parse(id)}`,
    areaResponseSchema,
    {
      accessToken,
      signal,
      cache: "no-store",
    }
  );

  return response.data.preparationArea;
}

export async function savePreparationArea(
  action: AreaAction,
  accessToken: string,
  signal: AbortSignal
) {
  const id =
    action.kind === "create" ? null : areaIdSchema.parse(action.id);

  const path =
    action.kind === "create"
      ? "/preparation-areas"
      : `/preparation-areas/${id}${
          action.kind === "status" ? "/status" : ""
        }`;

  const response = await request(path, areaResponseSchema, {
    method: action.kind === "create" ? "POST" : "PATCH",
    accessToken,
    signal,
    body:
      action.kind === "status"
        ? { isActive: action.isActive }
        : action.input,
  });

  return response.data.preparationArea;
}
