import { z } from "zod";

import { kitchenWorkflowModeSchema } from "../../kitchen-flow/kitchen-flow.schema";

const id = z.string().regex(/^[1-9]\d*$/);
const moneySchema = z
  .string()
  .regex(
    /^\d+(?:\.\d{1,2})?$/,
    "Se esperaba un importe como string con máximo 2 decimales."
  );

const preciseMoneySchema = z
  .string()
  .regex(
    /^\d+(?:\.\d{1,6})?$/,
    "Se esperaba un importe como string con máximo 6 decimales."
  );

const taxRateSchema = z
  .string()
  .regex(
    /^\d+(?:\.\d{1,4})?$/,
    "Se esperaba un porcentaje como string con máximo 4 decimales."
  );

export const orderStatusSchema = z.enum([
  "OPEN",
  "CONFIRMED",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
]);

export const serviceTypeSchema = z.enum([
  "TABLE",
  "TAKEAWAY",
  "DELIVERY",
]);

export const orderLocationSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  locationType: z.enum(["POINT_OF_SALE", "PRODUCTION_WAREHOUSE"]),
  isActive: z.boolean(),
});

export const paymentStatusSchema = z.enum([
  "PENDING",
  "VERIFIED",
  "CONSUMED",
  "REFUNDED",
  "VOIDED",
]);

export const sourceChannelSchema = z.enum([
  "IN_PERSON",
  "WHATSAPP",
  "PHONE",
  "PUBLIC_MENU",
]);

export const fulfillmentSummarySchema = z.object({
  activeItemCount: z.number().int().nonnegative(),
  activeUnitCount: z.number().int().nonnegative(),
  readyToServeUnitCount: z.number().int().nonnegative(),
  prepareToOrderUnitCount: z.number().int().nonnegative(),
  requiresPreparation: z.boolean(),
});

const orderBase = z.object({
  fulfillmentSummary: fulfillmentSummarySchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentVerifiedAt: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional(),
  sourceChannel: sourceChannelSchema.optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  total: moneySchema.optional(),
  id,
  locationId: id,
  businessId: id.optional(),
  createdAt: z.iso.datetime({ offset: true }),
  restaurantTableId: id.nullable(),
  openedByMembershipId: id,
  serviceType: serviceTypeSchema,
  status: orderStatusSchema,
  kitchenWorkflowMode: kitchenWorkflowModeSchema.nullable(),
  customerCount: z.number().int().nullable(),
  notes: z.string().nullable(),
  subtotal: moneySchema,
});

export const orderItemSchema = z.object({
  id,
  productId: id,
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
  lineTotal: moneySchema,

  unitNetPrice: preciseMoneySchema.optional(),
  unitTaxAmount: preciseMoneySchema.optional(),
  lineNetTotal: preciseMoneySchema.optional(),
  lineTaxTotal: preciseMoneySchema.optional(),
  taxRate: taxRateSchema.optional(),
  notes: z.string().nullable(),
  status: z.enum(["ACTIVE", "CANCELLED"]),
  cancellationReason: z.string().nullable(),
});

export const orderSchema = orderBase.extend({
  businessId: id,
  netSubtotal: preciseMoneySchema.optional(),
  taxTotal: preciseMoneySchema.optional(),
  location: orderLocationSchema,
  closedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  cancelledAt: z.iso.datetime({ offset: true }).nullable().optional(),
  items: z.array(orderItemSchema),
});

export const orderSummarySchema = orderBase.extend({
  restaurantTableName: z.string().nullable(),
  restaurantTableCode: z.string().nullable(),
  activeItemCount: z.number().int().nonnegative(),
});

export const orderResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    order: orderSchema,
  }),
});

export const ordersResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    orders: z.array(orderSummarySchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
});

export const salesKitchenTicketSchema = z.object({
  id,
  businessId: id,
  orderId: id,
  preparationAreaId: id,
  preparationAreaName: z.string(),
  currentVersion: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  items: z.array(
    z.object({
      id,
      orderItemId: id,
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
});

export const ticketsResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    kitchenTickets: z.array(salesKitchenTicketSchema),
  }),
});

export const confirmOrderResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    order: orderSchema,
    kitchenTickets: z.array(
      z.object({
        id,
        preparationAreaId: id,
        currentVersion: z.number().int().positive(),
        orderItemIds: z.array(id),
      })
    ),
  }),
});

export const addedItemsResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    orderItems: z.array(z.object({ id })),
  }),
});

export const createdResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    order: z.object({ id }),
  }),
});

export const savedResponseSchema = z.object({
  status: z.literal("success"),
});

export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type ServiceType = z.infer<typeof serviceTypeSchema>;

export type Ticket = z.infer<
  typeof ticketsResponseSchema
>["data"]["kitchenTickets"][number];

export type OrderInput = {
  sourceChannel?: z.infer<typeof sourceChannelSchema>;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceType: ServiceType;
  restaurantTableId: string | null;
  customerCount: number | null;
  notes: string | null;
};

export type Draft = Record<
  string,
  {
    quantity: number;
    notes: string;
    name: string;
    price: string;
  }
>;

export type LocalOrderDraft = OrderInput & {
  locationId: string;
  items: Draft;
};

export type CreateOrderInput = OrderInput & {
  locationId: string;
  items: {
    productId: string;
    quantity: number;
    notes: string | null;
  }[];
};

export const STATUS_LABELS: Record<Order["status"], string> = {
  OPEN: "Sin enviar",
  CONFIRMED: "En cocina",
  DELIVERED: "Por cerrar",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  TABLE: "Mesa",
  TAKEAWAY: "Para recoger",
  DELIVERY: "Domicilio",
};

export function preciseOrderMoney(value: string): string {
  const valid = preciseMoneySchema.parse(value);
  const [whole, fraction] = valid.split(".");

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `$ ${grouped}${fraction === undefined ? "" : "," + fraction}`;
}

export function cents(value: string): bigint {
  const [whole, decimal = ""] = value.split(".");

  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
}

export function money(value: bigint): string {
  const fraction = (value % 100n).toString().padStart(2, "0");

  return (
    "$ " +
    new Intl.NumberFormat("es-CO").format(value / 100n) +
    (fraction === "00" ? "" : "," + fraction)
  );
}

const preparationStatusSchema = z.enum([
  "PENDING",
  "IN_PREPARATION",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

export const cancelOrderResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    // Mínimo común al detalle y a los ejemplos del contrato.
    order: z.object({
      id,
      status: z.literal("CANCELLED"),
    }),
    cancellation: z.object({
      reason: z.string(),
      previousStatus: z.enum(["OPEN", "CONFIRMED"]),
      status: z.literal("CANCELLED"),
      cancelledByMembershipId: id,
      cancelledItemCount: z.number().int().nonnegative(),
      cancelledItems: z.array(
        z.object({
          orderItemId: id,
          kitchenTicketId: id,
          kitchenTicketItemId: id,
          kitchenTicketVersion: z.number().int().nonnegative(),
          previousPreparationStatus: preparationStatusSchema,
          preparationStatus: z.literal("CANCELLED"),
          inventoryReversalMovementId: id.nullable(),
          cancelledAt: z.iso.datetime({ offset: true }),
        })
      ),
    }),
  }),
});

export const cancelOrderItemResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    cancellation: z.object({
      orderItemId: id,
      status: z.literal("CANCELLED"),
      cancellationReason: z.string(),
      cancelledAt: z.iso.datetime({ offset: true }),
      kitchenTicketId: id,
      kitchenTicketItemId: id,
      preparationStatus: z.literal("CANCELLED"),
      kitchenTicketVersion: z.number().int().nonnegative(),
      orderStatus: z.enum(["CONFIRMED", "DELIVERED", "CANCELLED"]),
      inventoryReversalMovementId: id.nullable(),
    }),
  }),
});
