import { z } from "zod";

import { ApiError, request } from "../../../lib/http/client";

import {
  deliveryResponse,
  deliverySchema,
  id,
  type Assignment,
  type Delivery,
  type DeliveryAction,
} from "../schemas/public-orders.schema";

import {
  orderResponseSchema,
  type Order,
} from "../schemas/sales.schema";

import {
  getOrderKitchenHistory,
  type OrderKitchenHistory,
} from "./sales-history.service";

import { deliveryError, deliveryFailure } from "../utils/deliveries";

const listResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    deliveries: z.array(deliverySchema),
  }),
});

export async function listDeliveries(
  accessToken: string,
  signal: AbortSignal
): Promise<Delivery[]> {
  const result = await request("/deliveries", listResponse, {
    accessToken,
    signal,
    cache: "no-store",
  });

  return result.data.deliveries.map((row) => ({
    ...row,
    tracking: null,
  }));
}

export async function readDelivery(
  value: string,
  accessToken: string,
  signal: AbortSignal
): Promise<Delivery> {
  try {
    const result = await request(
      "/deliveries/" + id.parse(value),
      deliveryResponse,
      {
        accessToken,
        signal,
        cache: "no-store",
      }
    );

    if (result.data.delivery.id !== value) {
      throw new Error("El domicilio recibido no corresponde.");
    }

    return {
      ...result.data.delivery,
      tracking: null,
    };
  } catch (cause) {
    throw deliveryFailure(cause);
  }
}

export type DeliveryContext = {
  delivery: Delivery;
  order: Order | null;
  history: OrderKitchenHistory | null;
  orderError: string;
  historyError: string;
};

export async function readDeliveryContext(
  value: string,
  accessToken: string,
  businessId: string,
  canReadOrder: boolean,
  signal: AbortSignal
): Promise<DeliveryContext> {
  const delivery = await readDelivery(value, accessToken, signal);

  const context: DeliveryContext = {
    delivery,
    order: null,
    history: null,
    orderError: "",
    historyError: "",
  };

  if (!canReadOrder) return context;

  try {
    const response = await request(
      "/orders/" + id.parse(delivery.orderId),
      orderResponseSchema,
      {
        accessToken,
        signal,
        cache: "no-store",
      }
    );

    const order = response.data.order;

    if (
      order.id !== delivery.orderId ||
      order.businessId !== businessId ||
      order.location.id !== order.locationId ||
      order.serviceType !== "DELIVERY"
    ) {
      throw new Error(
        "La orden recibida no corresponde a este domicilio."
      );
    }

    context.order = order;
  } catch (cause) {
    signal.throwIfAborted();
    context.orderError = deliveryError(cause);
    return context;
  }

  if (context.order.status === "CONFIRMED") {
    try {
      context.history = await getOrderKitchenHistory(
        accessToken,
        {
          businessId,
          location: context.order.location,
        },
        context.order.id,
        signal
      );
    } catch (cause) {
      signal.throwIfAborted();
      context.historyError = deliveryError(cause);
    }
  }

  return context;
}

export function assignDelivery(
  value: string,
  body: Assignment,
  accessToken: string,
  signal: AbortSignal
) {
  const input =
    body.deliveryMode === "INTERNAL"
      ? {
          deliveryMode: body.deliveryMode,
          driverMembershipId: id.parse(body.driverMembershipId),
          externalProviderName: null,
        }
      : {
          deliveryMode: body.deliveryMode,
          driverMembershipId: null,
          externalProviderName: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .parse(body.externalProviderName),
        };

  return request(
    "/deliveries/public-order-requests/" +
      id.parse(value) +
      "/configure",
    deliveryResponse,
    {
      method: "POST",
      body: input,
      accessToken,
      signal,
    }
  );
}

export function advanceDelivery(
  value: string,
  action: DeliveryAction,
  accessToken: string,
  signal: AbortSignal
) {
  return request(
    "/deliveries/" + id.parse(value) + "/" + action,
    deliveryResponse,
    {
      method: "POST",
      accessToken,
      signal,
    }
  );
}

export function staleDelivery(): never {
  throw new ApiError(
    409,
    "INVALID_DELIVERY_TRANSITION",
    "El domicilio cambió. Actualiza antes de continuar."
  );
}
