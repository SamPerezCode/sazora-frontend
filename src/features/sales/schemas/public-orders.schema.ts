import type { PublicTracking } from "../../public-menu/schemas/public-menu.schema";
import { orderSchema } from "./sales.schema";
import { z } from "zod";

export const id = z.string().regex(/^[1-9]\d*$/);

export const amount = z.string().regex(/^\d+(?:\.\d{1,2})?$/);

export const date = z.iso.datetime({ offset: true });

export const requestStates = [
  "NEW",
  "CONTACTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
] as const;

export const deliveryStates = [
  "PENDING_ASSIGNMENT",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export const base = z.object({
  id,
  publicCode: z.string(),
  locationId: id,
  locationName: z.string(),
  serviceType: z.enum(["DELIVERY", "TAKEAWAY"]),
  status: z.enum(requestStates),
  customerName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  notes: z.string().nullable(),
  subtotal: amount,
  orderId: id.nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: date,
});

export const item = z.object({
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: amount,
  lineTotal: amount,
  notes: z.string().nullable(),
});

export const detail = base.extend({
  items: z.array(item),
});

export const listItem = base.extend({
  itemCount: z.number().int().nonnegative(),
});

export const deliverySchema = z.object({
  id,
  publicOrderRequestId: id,
  publicCode: z.string(),
  orderId: id,
  orderStatus: z.enum([
    "OPEN",
    "CONFIRMED",
    "DELIVERED",
    "CLOSED",
    "CANCELLED",
  ]),
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  deliveryMode: z.enum(["INTERNAL", "EXTERNAL"]).nullable(),
  assignedDriverMembershipId: id.nullable(),
  assignedDriverName: z.string().nullable(),
  externalProviderName: z.string().nullable(),
  status: z.enum(deliveryStates),
  createdAt: date,
});

export const requestResponse = z.object({
  status: z.literal("success"),
  data: z.object({ request: detail }),
});

export const orderResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    request: detail,
    order: orderSchema,
  }),
});

export const deliveryResponse = z.object({
  status: z.literal("success"),
  data: z.object({ delivery: deliverySchema }),
});

export type RequestRow = z.infer<typeof listItem>;

export type RequestDetail = z.infer<typeof detail>;

export type Delivery = z.infer<typeof deliverySchema> & {
  tracking: PublicTracking | null;
};

export type RequestAction =
  | "contact"
  | "reject"
  | "accept"
  | "confirm-order";

export type DeliveryAction = "pick-up" | "start" | "deliver";

export type Assignment =
  | {
      deliveryMode: "INTERNAL";
      driverMembershipId: string;
    }
  | {
      deliveryMode: "EXTERNAL";
      externalProviderName: string;
    };
