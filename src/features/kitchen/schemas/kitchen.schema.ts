import { z } from "zod";

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
  locationId: kitchenId,
  locationCode: z.string(),
  locationName: z.string(),
  kitchenWorkflowMode: z.enum(["PRINT_ONLY", "PRINT_AND_SCREEN"]),
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
    locationId: kitchenId,
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

// Los eventos invalidan HTTP; sus campos opcionales alimentan los avisos.
export const kitchenEventSchema = z.object({
  businessId: kitchenId,
  locationId: kitchenId,
  orderId: kitchenId,
  status: z.string().optional(),
  orderStatus: z.string().optional(),
  kitchenTicketId: kitchenId.optional(),
  kitchenTicketItemId: kitchenId.optional(),
  cancellationReason: z.string().nullable().optional(),
  cancelledQuantity: z.number().int().positive().optional(),
  remainingQuantity: z.number().int().nonnegative().optional(),
  orderItems: z
    .array(
      z.object({
        id: kitchenId,
        preparationAreaId: kitchenId,
      })
    )
    .optional(),
});

export const kitchenEventNames = [
  "order:created",
  "order:confirmed",
  "order:items-added",
  "order:item-updated",
  "order:item-removed",
  "order:item-cancelled",
  "order:item-quantity-cancelled",
  "order:updated",
  "order:status-updated",
  "kitchen-ticket:item-status-updated",
] as const;

export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;
export type KitchenItem = z.infer<typeof kitchenItemSchema>;
export type KitchenStatus = KitchenTicket["status"];

export type KitchenMutation = {
  ticketId: string;
  itemId?: string;
  status: "IN_PREPARATION" | "READY" | "DELIVERED";
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
