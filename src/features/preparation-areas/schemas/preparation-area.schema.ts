import { z } from "zod";

export const areaIdSchema = z.string().regex(/^[1-9]\d*$/);

export const preparationAreaSchema = z.object({
  id: areaIdSchema,
  businessId: areaIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number().int().min(0).max(65535),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const areaListResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    preparationAreas: z.array(preparationAreaSchema),
  }),
});

export const areaResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    preparationArea: preparationAreaSchema,
  }),
});

export const areaFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre del área.")
    .max(100, "Máximo 100 caracteres."),

  description: z
    .string()
    .trim()
    .max(255, "Máximo 255 caracteres.")
    .transform((value) => value || null),

  displayOrder: z
    .string()
    .trim()
    .regex(/^\d+$/, "Escribe un número entero entre 0 y 65535.")
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535, "El máximo es 65535.")),
});

export type PreparationArea = z.infer<typeof preparationAreaSchema>;

export type AreaDraft = z.input<typeof areaFormSchema>;

export type AreaInput = z.output<typeof areaFormSchema>;

export type AreaAction =
  | {
      kind: "create";
      input: AreaInput;
    }
  | {
      kind: "update";
      id: string;
      input: Partial<AreaInput>;
    }
  | {
      kind: "status";
      id: string;
      isActive: boolean;
    };

export function areaDraft(area?: PreparationArea): AreaDraft {
  return {
    name: area?.name ?? "",
    description: area?.description ?? "",
    displayOrder: String(area?.displayOrder ?? 0),
  };
}

export function areaChanges(
  area: PreparationArea,
  values: AreaInput
): Partial<AreaInput> {
  const patch: Partial<AreaInput> = {};

  if (values.name !== area.name) {
    patch.name = values.name;
  }

  if (values.description !== area.description) {
    patch.description = values.description;
  }

  if (values.displayOrder !== area.displayOrder) {
    patch.displayOrder = values.displayOrder;
  }

  return patch;
}
