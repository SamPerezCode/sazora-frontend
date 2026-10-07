import { request } from "../../../lib/http/client";
import {
  kitchenId,
  ticketsResponse,
  itemMutationResponse,
  ticketMutationResponse,
} from "../schemas/kitchen.schema";
import type { KitchenMutation } from "../schemas/kitchen.schema";

export async function getKitchenTickets(
  token: string,
  area: string,
  signal: AbortSignal
) {
  const query = area
    ? "?preparationAreaId=" + kitchenId.parse(area)
    : "";

  const result = await request(
    "/kitchen-tickets" + query,
    ticketsResponse,
    {
      accessToken: token,
      signal,
    }
  );

  return result.data.kitchenTickets;
}

export async function updateKitchenStatus(
  action: KitchenMutation,
  token: string,
  signal: AbortSignal
) {
  const id = kitchenId.parse(action.ticketId);

  const options = {
    accessToken: token,
    signal,
    method: "PATCH" as const,
    body: { status: action.status },
  };

  if (action.itemId) {
    const itemId = kitchenId.parse(action.itemId);

    const result = await request(
      `/kitchen-tickets/${id}/items/${itemId}/status`,
      itemMutationResponse,
      options
    );

    return {
      orderId: result.data.orderId,
      items: [result.data.item],
    };
  }

  const result = await request(
    `/kitchen-tickets/${id}/status`,
    ticketMutationResponse,
    options
  );

  return {
    orderId: result.data.orderId,
    items: result.data.items,
  };
}
