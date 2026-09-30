import { z } from "zod";

export const categoryIdSchema = z.string().regex(/^[1-9]\d*$/);

export const categorySchema = z.object({
  id: categoryIdSchema,
  businessId: categoryIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  displayOrder: z.number().int().min(0).max(65535),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const categoryListSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    categories: z.array(categorySchema),
  }),
});

export const categoryResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    category: categorySchema,
  }),
});

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre.")
    .max(100, "Máximo 100 caracteres."),

  description: z
    .string()
    .trim()
    .max(255, "Máximo 255 caracteres.")
    .transform((value) => value || null),

  displayOrder: z
    .string()
    .trim()
    .regex(/^\d+$/, "Escribe un entero entre 0 y 65535.")
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535, "El máximo es 65535.")),
});

export type Category = z.infer<typeof categorySchema>;
export type CategoryDraft = z.input<typeof categoryFormSchema>;
export type CategoryInput = z.output<typeof categoryFormSchema>;

export type CategoryAction =
  | { kind: "create"; input: CategoryInput }
  | { kind: "update"; id: string; input: Partial<CategoryInput> }
  | { kind: "status"; id: string; isActive: boolean }
  | { kind: "image"; id: string; file: File }
  | { kind: "remove-image"; id: string };

export function categoryDraft(category?: Category): CategoryDraft {
  return {
    name: category?.name ?? "",
    description: category?.description ?? "",
    displayOrder: String(category?.displayOrder ?? 0),
  };
}

export function categoryChanges(
  category: Category,
  values: CategoryInput
): Partial<CategoryInput> {
  const patch: Partial<CategoryInput> = {};

  if (values.name !== category.name) {
    patch.name = values.name;
  }

  if (values.description !== category.description) {
    patch.description = values.description;
  }

  if (values.displayOrder !== category.displayOrder) {
    patch.displayOrder = values.displayOrder;
  }

  return patch;
}
