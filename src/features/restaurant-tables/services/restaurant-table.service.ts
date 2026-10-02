import { request } from "../../../lib/http/client";
import {
  tableIdSchema,
  tableListResponseSchema,
  tableResponseSchema,
} from "../schemas/restaurant-table.schema";
import type { TableAction } from "../schemas/restaurant-table.schema";

export async function getRestaurantTables(
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request(
    "/restaurant-tables",
    tableListResponseSchema,
    { accessToken, signal }
  );

  return response.data.restaurantTables;
}

export async function saveRestaurantTable(
  action: TableAction,
  accessToken: string,
  signal: AbortSignal
) {
  const id =
    action.kind === "create" ? "" : tableIdSchema.parse(action.id);

  const path =
    action.kind === "create"
      ? "/restaurant-tables"
      : "/restaurant-tables/" +
        id +
        (action.kind === "status" ? "/status" : "");

  const response = await request(path, tableResponseSchema, {
    method: action.kind === "create" ? "POST" : "PATCH",
    accessToken,
    signal,
    body:
      action.kind === "status"
        ? { isActive: action.isActive }
        : action.input,
  });

  return response.data.restaurantTable;
}
