import { z } from "zod";

export const areaIdSchema = z.string().regex(/^[1-9]\d*$/);

export const areaLocationSchema = z.object({
  id: areaIdSchema,
  code: z.string(),
  name: z.string(),
  locationType: z.enum(["POINT_OF_SALE", "PRODUCTION_WAREHOUSE"]),
  isActive: z.boolean(),
});

export const preparationAreaSchema = z.object({
  id: areaIdSchema,
  businessId: areaIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number().int().min(0).max(65535),
  isActive: z.boolean(),
  locations: z.array(areaLocationSchema),
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
    .regex(/^\d+$/, "Escribe un entero entre 0 y 65535.")
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535)),
});

export const areaLocationIdsSchema = z
  .array(areaIdSchema)
  .min(1, "Selecciona al menos una ubicación activa.")
  .max(100, "Puedes seleccionar hasta 100 ubicaciones.")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "No repitas ubicaciones."
  );

export type AreaLocation = z.infer<typeof areaLocationSchema>;
export type PreparationArea = z.infer<typeof preparationAreaSchema>;
export type AreaDraft = z.input<typeof areaFormSchema>;
export type AreaInput = z.output<typeof areaFormSchema>;

export type AreaCreateInput = AreaInput & {
  locationIds: string[];
};

export type AreaPatch = Partial<AreaCreateInput>;

export type AreaAction =
  | { kind: "create"; input: AreaCreateInput }
  | { kind: "update"; id: string; input: AreaPatch }
  | { kind: "status"; id: string; isActive: boolean };

export const areaLocationGroups = [
  {
    type: "POINT_OF_SALE",
    label: "Puntos de venta",
    singular: "Punto de venta",
  },
  {
    type: "PRODUCTION_WAREHOUSE",
    label: "Plantas de producción",
    singular: "Planta de producción",
  },
] as const;

export function locationLabel(value: string): string {
  const text = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CO");

  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

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
): AreaPatch {
  const patch: AreaPatch = {};

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

export function sameLocationIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
