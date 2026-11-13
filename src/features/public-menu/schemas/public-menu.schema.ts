import { publicOrderNotes } from "../utils/public-order-notes";
import { z } from "zod";

export const idSchema = z.string().regex(/^[1-9]\d*$/);

export const amountSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/);

export const dateSchema = z.iso.datetime({ offset: true });

export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const requestStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
]);

export const serviceSchema = z.enum(["TAKEAWAY", "DELIVERY"]);

export const businessSchema = z.object({
  name: z.string(),
  slug: slugSchema,
  timezone: z.string(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  tagline: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  openingHoursText: z.string().nullable(),
  instagram: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string(),
  accentColor: z.string(),
  publicMenuDescription: z.string().nullable(),
  publicOrderingEnabled: z.boolean(),
});

export const locationSchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
});

export const productSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currentPrice: amountSchema,
  isOrderable: z.boolean(),
  availableLocationIds: z.array(idSchema),
});

export const menuSchema = z.object({
  business: businessSchema,
  locations: z.array(locationSchema),
  categories: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      description: z.string().nullable(),
      imageUrl: z.string().nullable(),
      displayOrder: z.number().int(),
      products: z.array(productSchema),
    })
  ),
});

export const menuResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ menu: menuSchema }),
});

export const checkoutSchema = z
  .object({
    serviceType: serviceSchema,
    customerName: z
      .string()
      .trim()
      .min(1, "Escribe tu nombre.")
      .max(150, "Máximo 150 caracteres."),
    customerPhone: z
      .string()
      .trim()
      .min(7, "Escribe un teléfono válido.")
      .max(30, "Máximo 30 caracteres.")
      .regex(/^\+?[0-9\s()-]+$/, "Escribe un teléfono válido."),
    customerEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Máximo 254 caracteres.")
      .refine(
        (value) =>
          !value || z.string().email().safeParse(value).success,
        "Escribe un correo válido."
      ),
    deliveryAddress: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres."),
    deliveryInstructions: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres.")
      .optional(),
    notes: z.string().trim().max(500, "Máximo 500 caracteres."),
  })
  .superRefine((value, context) => {
    if (
      publicOrderNotes(
        value.serviceType,
        value.notes,
        value.deliveryInstructions
      ).length > 500
    ) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message:
          "Las notas y las indicaciones de entrega juntas admiten máximo 500 caracteres.",
      });
    }

    if (value.serviceType === "DELIVERY" && !value.deliveryAddress) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Escribe la dirección del domicilio.",
      });
    }
  });

export const itemsSchema = z
  .array(
    z.object({
      productId: idSchema,
      quantity: z.number().int().min(1).max(100),
      notes: z.string().trim().max(500).nullable(),
    })
  )
  .min(1)
  .max(50)
  .refine(
    (items) =>
      new Set(items.map((item) => item.productId)).size ===
      items.length,
    "No repitas productos; modifica su cantidad."
  );

export const submittedResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    request: z.object({
      publicCode: z.string().uuid(),
      status: requestStatusSchema,
      serviceType: serviceSchema,
      location: z.object({
        id: idSchema,
        name: z.string(),
      }),
      subtotal: amountSchema,
      createdAt: dateSchema,
    }),
  }),
});

export const trackingSchema = z.object({
  businessName: z.string(),
  locationId: idSchema,
  locationName: z.string(),
  publicCode: z.string().uuid(),
  serviceType: serviceSchema,
  requestStatus: requestStatusSchema,
  orderStatus: z
    .enum(["OPEN", "CONFIRMED", "DELIVERED", "CLOSED", "CANCELLED"])
    .nullable(),
  preparationStatus: z
    .enum(["PENDING", "IN_PREPARATION", "READY", "DELIVERED"])
    .nullable(),
  fulfillmentStatus: z
    .enum([
      "PENDING_ASSIGNMENT",
      "ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ])
    .nullable(),
  subtotal: amountSchema,
  rejectionReason: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  items: z.array(
    z.object({
      productName: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: amountSchema,
      lineTotal: amountSchema,
      notes: z.string().nullable(),
    })
  ),
});

export const trackingResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ tracking: trackingSchema }),
});

export const publicWhatsAppStateSchema = z.object({
  business: businessSchema,
  customer: checkoutSchema,
  publicCode: z.string().uuid(),
  openWhatsApp: z.boolean(),
});

export type PublicBusiness = z.infer<typeof businessSchema>;

export type PublicMenu = z.infer<typeof menuSchema>;

export type PublicLocation = z.infer<typeof locationSchema>;

export type PublicProduct = z.infer<typeof productSchema>;

export type PublicTracking = z.infer<typeof trackingSchema>;

export type CheckoutDraft = z.input<typeof checkoutSchema>;

export interface CartLine {
  product: PublicProduct;
  quantity: number;
  notes: string;
}

export interface CartRow extends CartLine {
  available: boolean;
}
