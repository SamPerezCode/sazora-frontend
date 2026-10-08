import { request } from "../../../lib/http/client";
import {
  inventoryListSchema,
  movementCounterSchema,
} from "../schemas/inventory.schema";

export async function getInventoryItems(
  token: string,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-items",
    inventoryListSchema,
    {
      accessToken: token,
      signal,
    }
  );

  return response.data.items;
}

export async function getMovementCounter(
  token: string,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-movements",
    movementCounterSchema,
    {
      accessToken: token,
      signal,
    }
  );

  return response.data.movements;
}
