import { z } from "zod";
import { fixed } from "../../../utils/inventory-value";
import {
  recipeSchema,
  productionItemSchema,
  quickLineSchema,
  allocationSchema,
} from "./production.schemas";

export const managedRecipeSchema = recipeSchema.extend({
  updatedByName: z.string(),
});

export const managedRecipeSummarySchema = managedRecipeSchema
  .omit({ inputs: true, outputs: true })
  .extend({
    inputCount: z.number().int().nonnegative(),
    outputCount: z.number().int().nonnegative(),
  });

export const recipePayloadSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Escribe el código.")
      .max(50)
      .regex(
        /^[A-Za-z0-9._-]+$/,
        "Usa letras, números, punto, guion o guion bajo."
      ),
    name: z.string().trim().min(1, "Escribe el nombre.").max(150),
    notes: z.string().trim().max(500).nullable(),
    inputs: z.array(quickLineSchema).min(1).max(100),
    outputs: z
      .array(
        quickLineSchema.extend({
          costAllocationPercentage: allocationSchema,
        })
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();

    for (const group of ["inputs", "outputs"] as const) {
      value[group].forEach((line, index) => {
        if (ids.has(line.inventoryItemId)) {
          ctx.addIssue({
            code: "custom",
            path: [group, index, "inventoryItemId"],
            message:
              "Un artículo no puede repetirse ni ser insumo y resultado.",
          });
        }

        ids.add(line.inventoryItemId);
      });
    }

    const validPercentages = value.outputs.every(
      (line) =>
        allocationSchema.safeParse(line.costAllocationPercentage)
          .success
    );

    if (
      validPercentages &&
      value.outputs.reduce(
        (sum, line) => sum + fixed(line.costAllocationPercentage),
        0n
      ) !== fixed("100")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["outputs"],
        message: "La distribución debe sumar exactamente 100 %.",
      });
    }
  });

export type Recipe = z.infer<typeof managedRecipeSchema>;
export type RecipeSummary = z.infer<
  typeof managedRecipeSummarySchema
>;
export type RecipePayload = z.infer<typeof recipePayloadSchema>;
export type RecipeItem = z.infer<typeof productionItemSchema>;
export type RecipeAction = "detail" | "edit" | "status";
