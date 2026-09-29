import { request } from "../../lib/http/client";
import {
  areaIdSchema,
  areaListResponseSchema,
  areaResponseSchema,
} from "./preparation-area.schema";
import type {
  AreaAction,
  PreparationArea,
} from "./preparation-area.schema";

export async function getPreparationAreas(
  accessToken: string,
  signal: AbortSignal
): Promise<PreparationArea[]> {
  const response = await request(
    "/preparation-areas",
    areaListResponseSchema,
    {
      accessToken,
      signal,
    }
  );

  return response.data.preparationAreas;
}

export async function savePreparationArea(
  action: AreaAction,
  accessToken: string,
  signal: AbortSignal
): Promise<PreparationArea> {
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
