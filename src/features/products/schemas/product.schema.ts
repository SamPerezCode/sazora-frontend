import { z } from "zod";

const idSchema = z.string().regex(/^[1-9]\d*$/);

export const productSchema = z.object({
  id: idSchema,
  businessId: idSchema,
  categoryId: idSchema,
  preparationAreaId: idSchema,

  fulfillmentMode: z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]),

  sku: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currentPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  isActive: z.boolean(),

  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),

  categoryName: z.string(),
  categoryIsActive: z.boolean(),
  preparationAreaName: z.string(),
  preparationAreaIsActive: z.boolean(),

  isAvailable: z.boolean(),
  isCombo: z.boolean(),
  hasInventory: z.boolean(),

  inventoryTrackingType: z.enum([
    "NONE",
    "RESALE",
    "PRODUCTION",
    "COMBO",
    "CUSTOM",
  ]),
});

export const productListSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    products: z.array(productSchema),
  }),
});

export type Product = z.infer<typeof productSchema>;
