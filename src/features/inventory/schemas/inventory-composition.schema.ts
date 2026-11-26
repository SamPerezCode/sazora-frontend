import { z } from "zod";

export const compositionProductId = z
  .string()
  .regex(/^[1-9]\d*$/, "Selecciona un producto.");

const quantity = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/,
        "Usa hasta 15 enteros y 3 decimales, sin separadores de miles."
      )
      .refine(
        (value) => /[1-9]/.test(value),
        "La cantidad debe ser mayor que cero."
      )
  );

export const compositionSchema = z
  .object({
    items: z
      .array(
        z.object({
          inventoryItemId: z
            .string()
            .regex(/^[1-9]\d*$/, "Selecciona un artículo."),
          quantityPerProduct: quantity,
          autoDeduct: z.boolean(),
        })
      )
      .max(100, "Puedes configurar máximo 100 insumos."),
  })
  .superRefine(({ items }, context) => {
    const seen = new Set<string>();

    items.forEach((item, index) => {
      if (seen.has(item.inventoryItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "inventoryItemId"],
          message: "Este artículo ya está incluido.",
        });
      }

      seen.add(item.inventoryItemId);
    });
  });

export type CompositionInput = z.input<typeof compositionSchema>;
