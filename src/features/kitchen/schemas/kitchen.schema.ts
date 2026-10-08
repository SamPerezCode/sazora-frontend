import { z } from "zod";

import { quantityCancelledEventSchema } from "../../../lib/orders/quantity-cancellation";

export const kitchenId = z.string().regex(/^[1-9]\d*$/);

const date = z.iso.datetime({ offset: true });

export const itemStatusSchema = z.enum([
  "PENDING",
  "IN_PREPARATION",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

export const ticketStatusSchema = z.enum([
  "PENDING",
  "IN_PREPARATION",
  "READY",
]);

export const kitchenItemSchema = z.object({
  id: kitchenId,
  orderItemId: kitchenId,
  productName: z.string(),
  fulfillmentMode: z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]),
  quantity: z.number().positive(),
  notes: z.string().nullable(),
  preparationStatus: itemStatusSchema,
  startedAt: date.nullable(),
  readyAt: date.nullable(),
  deliveredAt: date.nullable(),
  cancelledAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
});

export const kitchenTicketSchema = z.object({
  id: kitchenId,
  businessId: kitchenId,
  orderId: kitchenId,
  preparationAreaId: kitchenId,
  preparationAreaName: z.string(),
  serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]),
  restaurantTableCode: z.string().nullable(),
  restaurantTableName: z.string().nullable(),
  orderNotes: z.string().nullable(),
  currentVersion: z.number().int().nonnegative(),
  status: ticketStatusSchema,
  items: z.array(kitchenItemSchema),
  createdAt: date,
  updatedAt: date,
});

export const ticketsResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    kitchenTickets: z.array(kitchenTicketSchema),
  }),
});

export const itemMutationResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    orderId: kitchenId,
    item: kitchenItemSchema,
    orderDelivered: z.boolean(),
  }),
});

export const ticketMutationResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    orderId: kitchenId,
    items: z.array(kitchenItemSchema),
    orderDelivered: z.boolean(),
  }),
});

const orderStatus = z.enum([
  "OPEN",
  "CONFIRMED",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
]);

export const kitchenEvents = {
  "order:item-quantity-cancelled": quantityCancelledEventSchema,
  "order:confirmed": z.object({
    businessId: kitchenId,
    orderId: kitchenId,
    confirmedAt: date,
    status: z.literal("CONFIRMED"),

    kitchenTickets: z.array(
      z.object({
        id: kitchenId,
        preparationAreaId: kitchenId,
        currentVersion: z.number(),
        orderItemIds: z.array(kitchenId),
      })
    ),
  }),

  "order:items-added": z.object({
    businessId: kitchenId,
    orderId: kitchenId,
    orderStatus,
    orderItems: z.array(
      z.object({
        id: kitchenId,
        preparationAreaId: kitchenId,
        createdAt: date,
      })
    ),
  }),

  "kitchen-ticket:item-status-updated": z.object({
    businessId: kitchenId,
    orderId: kitchenId,
    kitchenTicketId: kitchenId,
    kitchenTicketItemId: kitchenId,
    preparationStatus: itemStatusSchema,
    updatedAt: date,
  }),

  "order:item-cancelled": z.object({
    businessId: kitchenId,
    orderId: kitchenId,
    orderItemId: kitchenId,
    kitchenTicketId: kitchenId,
    kitchenTicketItemId: kitchenId,
    kitchenTicketVersion: z.number().int().nonnegative(),
    preparationStatus: z.literal("CANCELLED"),
    cancellationReason: z.string().nullable(),
    cancelledAt: date,
  }),

  "order:status-updated": z.object({
    businessId: kitchenId,
    orderId: kitchenId,
    status: orderStatus,
    previousStatus: orderStatus,
    changedAt: date,
  }),
};

export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;
export type KitchenItem = z.infer<typeof kitchenItemSchema>;
export type KitchenStatus = KitchenTicket["status"];

export type KitchenMutation = {
  ticketId: string;
  itemId?: string;
  status: "IN_PREPARATION" | "READY";
};

export type KitchenNotice = {
  id: string;

  kind:
    | "addition"
    | "item-cancelled"
    | "order-cancelled"
    | "quantity-cancelled";

  orderId: string;
  ticketId?: string;
  areaId?: string;
  label: string;
  reason?: string | null;
  productName?: string;
  quantity?: number;
  remainingQuantity?: number;
};
