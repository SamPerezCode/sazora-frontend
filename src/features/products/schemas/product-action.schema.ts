import { z } from "zod";
import {
  fulfillmentModeSchema,
  productDetailSchema,
  productIdSchema,
} from "./product.schema";

import type { inventorySetupSchema } from "../../inventory/services/inventory-setup";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const productEditSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre.").max(150),
  sku: optionalText(50),
  description: optionalText(500),
  currentPrice: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(
          /^\d+(?:\.\d{1,2})?$/,
          "Usa un importe con máximo dos decimales."
        )
    ),
  categoryId: productIdSchema,
  preparationAreaId: productIdSchema,
  fulfillmentMode: fulfillmentModeSchema,
});

export const componentsSchema = z
  .array(
    z.object({
      productId: productIdSchema,
      quantity: z
        .number()
        .int("Usa una cantidad entera.")
        .min(1, "La cantidad mínima es 1.")
        .max(10_000, "La cantidad máxima es 10.000."),
    })
  )
  .min(2, "Agrega al menos dos productos diferentes.")
  .max(100, "Máximo 100 productos diferentes.")
  .superRefine((items, context) => {
    if (
      new Set(items.map((item) => item.productId)).size !==
      items.length
    ) {
      context.addIssue({
        code: "custom",
        message: "No repitas componentes.",
      });
    }
  });

export const comboDetailSchema = z.object({
  product: productDetailSchema,

  components: z.array(
    z.object({
      id: productIdSchema,
      productId: productIdSchema,
      sku: z.string().nullable(),
      name: z.string(),
      description: z.string().nullable(),
      imageUrl: z.string().nullable(),

      currentPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/),

      quantity: z
        .string()
        .regex(/^\d+(?:\.\d+)?$/)
        .transform(Number)
        .pipe(z.number().finite().positive()),

      isActive: z.boolean(),
    })
  ),
});

export const comboResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    combo: comboDetailSchema,
  }),
});

export type ComboDetail = z.infer<typeof comboDetailSchema>;

export type ProductEditInput = z.output<typeof productEditSchema>;

export type ComboComponent = z.infer<typeof componentsSchema>[number];

export type CatalogDetail = z.infer<typeof productDetailSchema> & {
  components?: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
};

export type ProductActionKind =
  | "detail"
  | "edit"
  | "image"
  | "remove-image"
  | "status"
  | "inventory";

export type ProductMutation =
  | {
      kind: "inventory";
      id: string;
      input: z.output<typeof inventorySetupSchema>;
    }
  | {
      kind: "create";
      isCombo: boolean;
      input: ProductEditInput;
      components?: ComboComponent[];
      file?: File;
    }
  | {
      kind: "edit";
      id: string;
      isCombo: boolean;
      input: Partial<ProductEditInput>;
      components?: ComboComponent[];
    }
  | {
      kind: "status";
      id: string;
      isActive: boolean;
    }
  | {
      kind: "image";
      id: string;
      file: File;
    }
  | {
      kind: "remove-image";
      id: string;
    };
