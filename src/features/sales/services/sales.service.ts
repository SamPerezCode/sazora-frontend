import { z } from "zod";

import { ApiError, request } from "../../../lib/http/client";
import { productListSchema } from "../../products/schemas/product.schema";
import { tableListResponseSchema } from "../../restaurant-tables/schemas/restaurant-table.schema";
import type { RestaurantTable } from "../../restaurant-tables/schemas/restaurant-table.schema";
import { getOrderKitchenTickets } from "../../kitchen-flow/kitchen-flow.service";

import {
  cancelQuantityInputSchema,
  cancelQuantityResponseSchema,
} from "../../../lib/orders/quantity-cancellation";

import {
  cancelOrderResponseSchema,
  cancelOrderItemResponseSchema,
  createdResponseSchema,
  orderResponseSchema,
  ordersResponseSchema,
  savedResponseSchema,
  ticketsResponseSchema,
  confirmOrderResponseSchema,
  addedItemsResponseSchema,
} from "../schemas/sales.schema";

import type {
  CreateOrderInput,
  OrderSummary,
  Order,
} from "../schemas/sales.schema";

import { isOperationalOrder } from "../utils/sales-board";

export interface SalesLocation {
  id: string;
  name: string;
  code: string;
}

export interface SalesScope {
  businessId: string;
  location: SalesLocation;
}

export type SalesTable = Pick<
  RestaurantTable,
  "id" | "name" | "code" | "capacity" | "isActive"
> & {
  continuityOnly?: boolean;
};

export const locationErrorCodes = new Set([
  "LOCATION_ACCESS_DENIED",
  "DEFAULT_LOCATION_REQUIRED",
  "ORDER_LOCATION_REQUIRED",
  "ORDER_LOCATION_NOT_AVAILABLE",
  "LOCATION_NOT_POINT_OF_SALE",
  "LOCATION_NOT_FOUND",
]);

export function assertOrderScope<
  T extends {
    locationId: string;
    businessId?: string;
  },
>(order: T, scope: SalesScope): T {
  if (
    order.locationId !== scope.location.id ||
    (order.businessId && order.businessId !== scope.businessId)
  ) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "La orden no pertenece al punto de venta seleccionado."
    );
  }

  return order;
}

function readOptions(token: string, signal?: AbortSignal) {
  return {
    accessToken: token,
    signal,
    cache: "no-store" as const,
  };
}

export async function getOrdersPage(
  token: string,
  scope: SalesScope,
  status: Order["status"],
  page: number,
  signal: AbortSignal
) {
  const query = new URLSearchParams({
    locationId: scope.location.id,
    status,
    page: String(page),
    pageSize: "100",
  });

  const response = await request(
    `/orders?${query}`,
    ordersResponseSchema,
    readOptions(token, signal)
  );

  response.data.orders.forEach((order) => {
    assertOrderScope(order, scope);
  });

  return response.data;
}

export async function getOrdersForStatuses(
  token: string,
  scope: SalesScope,
  statuses: readonly Order["status"][],
  signal: AbortSignal
) {
  const groups = await Promise.all(
    statuses.map(async (status) => {
      const rows: OrderSummary[] = [];

      let page = 1;
      let totalPages: number;

      do {
        signal.throwIfAborted();

        const data = await getOrdersPage(
          token,
          scope,
          status,
          page,
          signal
        );

        rows.push(
          ...data.orders.filter((order) => order.status === status)
        );

        totalPages = data.pagination.totalPages;
        page++;
      } while (page <= totalPages);

      return rows;
    })
  );

  return [
    ...new Map(
      groups.flat().map((order) => [order.id, order])
    ).values(),
  ];
}

export async function getActiveOrders(
  token: string,
  signal: AbortSignal,
  scope: SalesScope
) {
  const orders = await getOrdersForStatuses(
    token,
    scope,
    ["OPEN", "CONFIRMED", "DELIVERED"],
    signal
  );

  return orders.filter(isOperationalOrder);
}

export function mergeOperationalTables(
  active: RestaurantTable[],
  orders: OrderSummary[]
): SalesTable[] {
  const tables = new Map<string, SalesTable>(
    active.map((table) => [table.id, table])
  );

  for (const order of orders) {
    if (
      order.serviceType !== "TABLE" ||
      !order.restaurantTableId ||
      tables.has(order.restaurantTableId)
    ) {
      continue;
    }

    tables.set(order.restaurantTableId, {
      id: order.restaurantTableId,
      name: order.restaurantTableName ?? "Mesa de la cuenta",
      code: order.restaurantTableCode ?? "",
      capacity: null,
      isActive: false,
      continuityOnly: true,
    });
  }

  return [...tables.values()];
}

export async function getSales(
  token: string,
  orderId: string | null,
  signal: AbortSignal,
  scope: SalesScope
) {
  const query = new URLSearchParams({
    locationId: scope.location.id,
    activeOnly: "true",
  });

  const [tables, products, orders, order] = await Promise.all([
    request(
      `/restaurant-tables?${query}`,
      tableListResponseSchema,
      readOptions(token, signal)
    ),
    request(
      "/products",
      productListSchema,
      readOptions(token, signal)
    ),
    getActiveOrders(token, signal, scope),
    orderId ? getOrder(token, orderId, scope, signal) : null,
  ]);

  tables.data.restaurantTables.forEach((table) => {
    assertOrderScope(table, scope);
  });

  let tickets: z.infer<
    typeof ticketsResponseSchema
  >["data"]["kitchenTickets"] = [];

  let ticketsError = "";

  if (order && order.status !== "OPEN" && isOperationalOrder(order)) {
    try {
      tickets = await getOrderKitchenTickets(
        token,
        scope,
        order.id,
        signal
      );
    } catch (cause) {
      if (
        signal.aborted ||
        (cause instanceof ApiError &&
          (cause.status === 401 ||
            locationErrorCodes.has(cause.code)))
      ) {
        throw cause;
      }

      ticketsError =
        "No pudimos consultar la preparación. Actualiza la cuenta para reintentar.";
    }
  }

  return {
    tables: mergeOperationalTables(
      tables.data.restaurantTables.filter((table) => table.isActive),
      orders
    ),
    products: products.data.products.filter(
      (product) => product.isAvailable
    ),
    orders,
    order,
    tickets,
    ticketsError,
    updatedAt: new Date().toISOString(),
    location: scope.location,
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

  if (
    !/^[1-9]\d*$/.test(input.locationId) ||
    !validService ||
    !validCount ||
    !validItems
  ) {
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

export async function getOrder(
  token: string,
  id: string,
  scope: SalesScope,
  signal?: AbortSignal
) {
  const response = await request(
    `/orders/${id}`,
    orderResponseSchema,
    readOptions(token, signal)
  );

  const order = assertOrderScope(response.data.order, scope);

  if (
    order.location.id !== scope.location.id ||
    order.location.locationType !== "POINT_OF_SALE" ||
    order.serviceType === "DELIVERY"
  ) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "Esta cuenta no está disponible en Mesas y pedidos."
    );
  }

  return order;
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

export async function cancelOrderItemQuantity(
  token: string,
  orderId: string,
  orderItemId: string,
  quantity: number,
  reason: string
) {
  const body = cancelQuantityInputSchema.parse({
    quantity,
    reason,
  });

  const response = await request(
    `/orders/${orderId}/items/${orderItemId}/cancel-quantity`,
    cancelQuantityResponseSchema,
    {
      method: "POST",
      accessToken: token,
      body,
    }
  );

  return response.data.adjustment;
}

export async function confirmSalesOrder(
  token: string,
  orderId: string,
  scope: SalesScope
) {
  const response = await request(
    `/orders/${orderId}/confirm`,
    confirmOrderResponseSchema,
    {
      method: "POST",
      accessToken: token,
    }
  );

  const order = assertOrderScope(response.data.order, scope);

  if (order.id !== orderId) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La confirmación no corresponde a esta orden."
    );
  }

  return {
    order,
    kitchenTickets: response.data.kitchenTickets,
  };
}

export async function addSalesOrderItems(
  token: string,
  orderId: string,
  items: CreateOrderInput["items"]
) {
  const response = await request(
    `/orders/${orderId}/items`,
    addedItemsResponseSchema,
    {
      method: "POST",
      accessToken: token,
      body: { items },
    }
  );

  return response.data.orderItems;
}

export async function deliverPrintOnlyOrder(
  token: string,
  orderId: string,
  scope: SalesScope
) {
  const response = await request(
    `/orders/${orderId}/deliver`,
    orderResponseSchema,
    {
      method: "POST",
      accessToken: token,
    }
  );

  const order = assertOrderScope(response.data.order, scope);

  if (order.id !== orderId || order.status !== "DELIVERED") {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Debemos verificar el estado de entrega de esta orden."
    );
  }

  return order;
}
