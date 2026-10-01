import { z } from "zod";
import { productSchema } from "./product.schema";

const id = z.string().regex(/^[1-9]\d*$/, "Selecciona una opción.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((value) => value || null);

const decimal = (places: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(
          new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`),
          `Usa un número positivo o cero, con máximo ${places} decimales.`
        )
    );

export const productEditSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre.").max(150),
  sku: optionalText(50).transform(
    (value) => value?.toUpperCase() ?? null
  ),
  description: optionalText(500),
  currentPrice: decimal(2),
  categoryId: id,
  preparationAreaId: id,
  fulfillmentMode: z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]),
});

export const inventorySetupSchema = z.object({
  trackingType: z.enum(["RESALE", "PRODUCTION"]),
  sku: optionalText(50).transform(
    (value) => value?.toUpperCase() ?? null
  ),
  baseUnit: z.enum([
    "UNIT",
    "GRAM",
    "KILOGRAM",
    "MILLILITER",
    "LITER",
    "PORTION",
    "PACKAGE",
  ]),
  openingQuantity: decimal(3),
  minimumStock: decimal(3),
  quantityPerProduct: decimal(3).refine(
    (value) => /[1-9]/.test(value),
    "Debe ser mayor que cero."
  ),
});

export const comboDetailSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    combo: z.object({
      product: productSchema.pick({
        id: true,
        businessId: true,
      }),
      components: z.array(
        z.object({
          productId: id,
          name: z.string(),
          sku: z.string().nullable(),
          quantity: z.string(),
          isActive: z.boolean(),
        })
      ),
    }),
  }),
});

export type ProductActionKind =
  | "edit"
  | "image"
  | "status"
  | "inventory"
  | "combo";

export type ProductEditInput = z.output<typeof productEditSchema>;

export type InventoryInput = z.output<typeof inventorySetupSchema>;

export type ComboDetail = z.infer<
  typeof comboDetailSchema
>["data"]["combo"];

export type ProductMutation =
  | {
      kind: "create";
      input: ProductEditInput;
      file?: File;
    }
  | {
      kind: "edit";
      id: string;
      isCombo: boolean;
      input: Partial<ProductEditInput>;
    }
  | { kind: "status"; id: string; isActive: boolean }
  | { kind: "image"; id: string; file: File }
  | { kind: "remove-image"; id: string }
  | { kind: "inventory"; id: string; input: InventoryInput };
