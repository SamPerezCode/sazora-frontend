import { z } from "zod";

import { ApiError, request } from "../../../lib/http/client";

import { isOperationalOrder } from "../utils/sales-board";

import { productListSchema } from "../../products/schemas/product.schema";
import { tableListResponseSchema } from "../../restaurant-tables/schemas/restaurant-table.schema";

import {
  cancelOrderResponseSchema,
  cancelOrderItemResponseSchema,
  createdResponseSchema,
  orderResponseSchema,
  ordersResponseSchema,
  savedResponseSchema,
  ticketsResponseSchema,
} from "../schemas/sales.schema";

import type {
  CreateOrderInput,
  OrderSummary,
} from "../schemas/sales.schema";

export async function getActiveOrders(
  token: string,
  signal: AbortSignal
) {
  const groups = await Promise.all(
    (["OPEN", "CONFIRMED", "DELIVERED"] as const).map(
      async (status) => {
        const result: OrderSummary[] = [];

        let page = 1;
        let totalPages: number;

        do {
          const response = await request(
            `/orders?status=${status}&page=${page}&pageSize=100`,
            ordersResponseSchema,
            {
              accessToken: token,
              signal,
            }
          );

          result.push(...response.data.orders);

          totalPages = response.data.pagination.totalPages;
          page++;
        } while (page <= totalPages);

        return result;
      }
    )
  );

  return [
    ...new Map(
      groups.flat().map((order) => [order.id, order])
    ).values(),
  ].filter(isOperationalOrder);
}

export async function getSales(
  token: string,
  orderId: string | null,
  signal: AbortSignal
) {
  const options = {
    accessToken: token,
    signal,
  };

  const [tables, products, orders, tickets, detail] =
    await Promise.all([
      request("/restaurant-tables", tableListResponseSchema, options),
      request("/products", productListSchema, options),
      getActiveOrders(token, signal),
      request("/kitchen-tickets", ticketsResponseSchema, options),
      orderId
        ? request(`/orders/${orderId}`, orderResponseSchema, options)
        : null,
    ]);

  return {
    tables: tables.data.restaurantTables,
    products: products.data.products.filter(
      (product) => product.isAvailable
    ),
    orders,
    tickets: tickets.data.kitchenTickets,
    order: detail?.data.order ?? null,
  };
}

export type SalesData = Awaited<ReturnType<typeof getSales>>;

export async function createOrder(
  token: string,
  input: CreateOrderInput
) {
  const validService =
    (input.serviceType === "TABLE" && !!input.restaurantTableId) ||
    (input.serviceType === "TAKEAWAY" &&
      input.restaurantTableId === null &&
      input.customerCount === null);

  const validCount =
    input.customerCount === null ||
    (Number.isSafeInteger(input.customerCount) &&
      input.customerCount > 0);

  const validItems =
    input.items.length > 0 &&
    input.items.length <= 50 &&
    input.items.every(
      (item) =>
        !!item.productId &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0
    );

  if (!validService || !validCount || !validItems) {
    throw new ApiError(
      400,
      "INVALID_SALES_INPUT",
      "Revisa los datos de la mesa o del pedido para recoger."
    );
  }

  const response = await request("/orders", createdResponseSchema, {
    method: "POST",
    body: input,
    accessToken: token,
  });

  return response.data.order.id;
}

export async function getOrder(token: string, id: string) {
  const response = await request(
    `/orders/${id}`,
    orderResponseSchema,
    {
      accessToken: token,
    }
  );

  return response.data.order;
}
export async function writeOrder(
  token: string,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<void> {
  if (method === "DELETE") {
    await request(path, z.null(), {
      method,
      body,
      accessToken: token,
    });
  } else {
    await request(path, savedResponseSchema, {
      method,
      body,
      accessToken: token,
    });
  }
}

export async function cancelOrder(
  token: string,
  orderId: string,
  reason: string
) {
  const response = await request(
    `/orders/${orderId}/cancel`,
    cancelOrderResponseSchema,
    {
      method: "POST",
      accessToken: token,
      body: {
        reason: reason.trim(),
      },
    }
  );

  return response.data;
}

export async function cancelOrderItem(
  token: string,
  orderId: string,
  orderItemId: string,
  reason: string
) {
  const response = await request(
    `/orders/${orderId}/items/${orderItemId}/cancel`,
    cancelOrderItemResponseSchema,
    {
      method: "POST",
      accessToken: token,
      body: {
        reason: reason.trim(),
      },
    }
  );

  return response.data.cancellation;
}
