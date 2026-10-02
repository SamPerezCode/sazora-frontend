import { z } from "zod";

export const tableIdSchema = z.string().regex(/^[1-9]\d*$/);

export const restaurantTableSchema = z.object({
  id: tableIdSchema,
  businessId: tableIdSchema,
  code: z.string(),
  name: z.string(),
  capacity: z.number().int().min(1).max(65535).nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const tableListResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    restaurantTables: z.array(restaurantTableSchema),
  }),
});

export const tableResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    restaurantTable: restaurantTableSchema,
  }),
});

export const tableFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Escribe el código.")
    .toUpperCase()
    .max(30, "Máximo 30 caracteres."),

  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre.")
    .max(80, "Máximo 80 caracteres."),

  capacity: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d+$/.test(value),
      "Escribe una capacidad entera."
    )
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(
      z
        .number()
        .int()
        .min(1, "El mínimo es 1.")
        .max(65535, "El máximo es 65535.")
        .nullable()
    ),
});

export type RestaurantTable = z.infer<typeof restaurantTableSchema>;
export type TableDraft = z.input<typeof tableFormSchema>;
export type TableInput = z.output<typeof tableFormSchema>;

export type TableAction =
  | { kind: "create"; input: TableInput }
  | { kind: "update"; id: string; input: Partial<TableInput> }
  | { kind: "status"; id: string; isActive: boolean };

export function tableChanges(
  table: RestaurantTable,
  values: TableInput
): Partial<TableInput> {
  const patch: Partial<TableInput> = {};

  if (values.code !== table.code) patch.code = values.code;
  if (values.name !== table.name) patch.name = values.name;
  if (values.capacity !== table.capacity) {
    patch.capacity = values.capacity;
  }

  return patch;
}
