import { z } from "zod";

import { ApiError, request } from "../../../lib/http/client";

import { orderSchema } from "../schemas/sales.schema";

import { assertOrderScope } from "./sales.service";
import type { SalesScope } from "./sales.service";

import {
  kitchenPrintSchema,
  kitchenPrintSnapshotSchema,
  kitchenWorkflowModeSchema,
} from "../../kitchen-flow/kitchen-flow.schema";

const id = z.string().regex(/^[1-9]\d*$/);
const date = z.iso.datetime({ offset: true });

const historicalOrderSchema = orderSchema.extend({
  restaurantTableName: z.string().nullable().optional(),
  restaurantTableCode: z.string().nullable().optional(),
  confirmedAt: date.nullable().optional(),
  deliveredAt: date.nullable().optional(),
  updatedAt: date.optional(),
});

const historicalOrderResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    order: historicalOrderSchema,
  }),
});

const historicalPrintSchema = kitchenPrintSchema.extend({
  contentSnapshot: kitchenPrintSnapshotSchema
    .nullish()
    .transform((value) => value ?? null),
});

const historicalTicketSchema = z.object({
  id,
  preparationAreaId: id,
  preparationAreaName: z.string(),
  currentVersion: z.number().int().positive(),
  status: z.enum([
    "PENDING",
    "IN_PREPARATION",
    "PREPARING",
    "READY",
    "DELIVERED",
    "CANCELLED",
  ]),
  items: z.array(
    z.object({
      id,
      orderItemId: id,
      productName: z.string(),
      quantity: z.number().int().positive(),
      notes: z.string().nullable(),
      preparationStatus: z.enum([
        "PENDING",
        "IN_PREPARATION",
        "PREPARING",
        "READY",
        "DELIVERED",
        "CANCELLED",
      ]),
    })
  ),
  prints: z.array(historicalPrintSchema),
  createdAt: date,
  updatedAt: date,
});

const kitchenHistoryResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    kitchenHistory: z.object({
      orderId: id,
      kitchenWorkflowMode: kitchenWorkflowModeSchema.nullable(),
      tickets: z.array(historicalTicketSchema),
    }),
  }),
});

export type HistoricalOrder = z.infer<typeof historicalOrderSchema>;
export type HistoricalPrint = z.infer<typeof historicalPrintSchema>;
export type HistoricalTicket = z.infer<typeof historicalTicketSchema>;

export type OrderKitchenHistory = z.infer<
  typeof kitchenHistoryResponseSchema
>["data"]["kitchenHistory"];

function invalidResponse(): never {
  throw new ApiError(
    502,
    "INVALID_RESPONSE",
    "La información recibida no corresponde a esta orden."
  );
}

export async function getHistoricalOrder(
  token: string,
  scope: SalesScope,
  orderId: string,
  signal: AbortSignal
): Promise<HistoricalOrder> {
  const response = await request(
    `/orders/${id.parse(orderId)}`,
    historicalOrderResponseSchema,
    {
      accessToken: token,
      cache: "no-store",
      signal,
    }
  );

  const order = assertOrderScope(response.data.order, scope);

  if (
    order.id !== orderId ||
    order.location.id !== scope.location.id
  ) {
    invalidResponse();
  }

  return order;
}

export async function getOrderKitchenHistory(
  token: string,
  scope: SalesScope,
  orderId: string,
  signal: AbortSignal
): Promise<OrderKitchenHistory> {
  const response = await request(
    `/orders/${id.parse(orderId)}/kitchen-history`,
    kitchenHistoryResponseSchema,
    {
      accessToken: token,
      cache: "no-store",
      signal,
    }
  );

  const history = response.data.kitchenHistory;

  if (history.orderId !== orderId) invalidResponse();

  for (const ticket of history.tickets) {
    for (const print of ticket.prints) {
      if (
        print.businessId !== scope.businessId ||
        print.kitchenTicketId !== ticket.id
      ) {
        invalidResponse();
      }

      const snapshot = print.contentSnapshot;

      if (
        snapshot &&
        (snapshot.businessId !== scope.businessId ||
          snapshot.orderId !== orderId ||
          snapshot.kitchenTicketId !== ticket.id ||
          snapshot.preparationAreaId !== ticket.preparationAreaId ||
          snapshot.ticketVersion !== print.ticketVersion)
      ) {
        invalidResponse();
      }
    }
  }

  return history;
}

export function groupTicketVersions(ticket: HistoricalTicket) {
  // Solo versiones documentadas y la versión actual.
  // No inventamos versiones intermedias sin información.
  const versions = new Set([
    ticket.currentVersion,
    ...ticket.prints.map((print) => print.ticketVersion),
  ]);

  return [...versions]
    .sort((a, b) => b - a)
    .map((version) => {
      const records = ticket.prints
        .filter((print) => print.ticketVersion === version)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      return {
        version,
        original: records.find(
          (print) =>
            print.printType === "INITIAL" ||
            print.printType === "MODIFICATION"
        ),
        copies: records.filter(
          (print) => print.printType === "REPRINT"
        ),
      };
    });
}

export function kitchenHistorySummary(history: OrderKitchenHistory) {
  const areas = new Set<string>();
  const pendingAreas = new Set<string>();
  let versions = 0;

  for (const ticket of history.tickets) {
    areas.add(ticket.preparationAreaId);

    const groups = groupTicketVersions(ticket);
    versions += groups.length;

    const current = groups.find(
      (group) => group.version === ticket.currentVersion
    );

    if (!current?.original) {
      pendingAreas.add(ticket.preparationAreaId);
    }
  }

  return {
    areas: areas.size,
    versions,
    printedAreas: areas.size - pendingAreas.size,
    pendingAreas: pendingAreas.size,
  };
}

export function historyErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) {
      return "Tu sesión expiró. Vuelve a iniciar sesión.";
    }

    if (cause.code === "LOCATION_ACCESS_DENIED") {
      return "No tienes acceso a las órdenes de esta ubicación.";
    }

    if (cause.code === "ORDER_NOT_FOUND") {
      return "La orden ya no está disponible.";
    }
  }

  return cause instanceof Error
    ? cause.message
    : "No fue posible consultar la información.";
}
