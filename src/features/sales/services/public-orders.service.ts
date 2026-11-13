import { request } from "../../../lib/http/client";
import { id } from "../schemas/public-orders.schema";
import { listItem } from "../schemas/public-orders.schema";
import { orderResponse } from "../schemas/public-orders.schema";
import type { RequestAction } from "../schemas/public-orders.schema";
import { requestResponse } from "../schemas/public-orders.schema";
import { z } from "zod";

export const requestPath = (value: string) =>
  "/public-order-requests/" + id.parse(value);

export async function listRequests(
  accessToken: string,
  signal: AbortSignal
) {
  const result = await request(
    "/public-order-requests",
    z.object({
      status: z.literal("success"),
      data: z.object({ requests: z.array(listItem) }),
    }),
    { accessToken, signal, cache: "no-store" }
  );

  return result.data.requests;
}

export async function readRequest(
  value: string,
  accessToken: string,
  signal: AbortSignal
) {
  const result = await request(requestPath(value), requestResponse, {
    accessToken,
    signal,
    cache: "no-store",
  });

  if (result.data.request.id !== value) {
    throw new Error("La solicitud recibida no corresponde.");
  }

  if (result.data.request.orderId) {
    const related = await request(
      requestPath(value) + "/order",
      orderResponse,
      { accessToken, signal, cache: "no-store" }
    );

    if (
      related.data.request.id !== value ||
      related.data.request.orderId !== related.data.order.id
    ) {
      throw new Error(
        "El pedido recibido no corresponde a la solicitud."
      );
    }

    return related.data;
  }

  return { request: result.data.request, order: null };
}

export async function changeRequest(
  value: string,
  action: RequestAction,
  accessToken: string,
  signal: AbortSignal,
  reason?: string
) {
  const body =
    action === "reject"
      ? {
          reason: z.string().trim().min(1).max(500).parse(reason),
        }
      : undefined;

  if (action === "accept" || action === "confirm-order") {
    return request(requestPath(value) + "/" + action, orderResponse, {
      method: "POST",
      accessToken,
      signal,
      body,
    });
  }

  return request(requestPath(value) + "/" + action, requestResponse, {
    method: "POST",
    accessToken,
    signal,
    body,
  });
}
