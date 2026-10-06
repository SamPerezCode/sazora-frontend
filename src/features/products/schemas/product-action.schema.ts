import { z } from "zod";
import {
  fulfillmentModeSchema,
  productDetailSchema,
  productIdSchema,
} from "./product.schema";

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
        .finite()
        .positive("La cantidad debe ser mayor que cero."),
    })
  )
  .min(1, "Agrega al menos un componente.")
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

export const comboResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    product: productDetailSchema.extend({
      isCombo: z.literal(true),
      components: z.array(
        z.object({
          productId: productIdSchema,
          productName: z.string(),
          quantity: z.number().finite().positive(),
        })
      ),
    }),
  }),
});

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
