import { z } from "zod";

export const productIdSchema = z.string().regex(/^[1-9]\d*$/);
export const fulfillmentModeSchema = z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]);
export const inventoryTrackingSchema = z.enum(["NONE", "RESALE", "PRODUCTION", "COMBO", "CUSTOM"]);

export const productDetailSchema = z.object({
  id: productIdSchema,
  businessId: productIdSchema,
  categoryId: productIdSchema,
  preparationAreaId: productIdSchema,
  fulfillmentMode: fulfillmentModeSchema,
  sku: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currentPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const productSchema = productDetailSchema.extend({
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  categoryName: z.string(),
  preparationAreaName: z.string(),
  categoryIsActive: z.boolean().optional(),
  preparationAreaIsActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isCombo: z.boolean(),
  hasInventory: z.boolean(),
  inventoryTrackingType: inventoryTrackingSchema,
});

export const productListSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    products: z.array(productSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }).optional(),
  }),
});

export const productDetailResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ product: productDetailSchema }),
});

export type Product = z.infer<typeof productSchema>;
export type ProductDetailData = z.infer<typeof productDetailSchema>;
