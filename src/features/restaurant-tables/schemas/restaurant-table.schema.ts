import { z } from "zod";
import { locationSchema } from "../../business/schemas/organization.schema";

export const tableIdSchema = z.string().regex(/^[1-9]\d*$/);

const tableLocationSchema = locationSchema
  .pick({
    id: true,
    code: true,
    name: true,
    locationType: true,
    isActive: true,
  })
  .extend({
    locationType: z.literal("POINT_OF_SALE"),
  });

export const restaurantTableSchema = z
  .object({
    id: tableIdSchema,
    businessId: tableIdSchema,
    locationId: tableIdSchema,
    location: tableLocationSchema,
    code: z.string(),
    name: z.string(),
    capacity: z.number().int().min(1).max(65535).nullable(),
    isActive: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((table) => table.locationId === table.location.id, {
    message: "La ubicación de la mesa no coincide.",
    path: ["locationId"],
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
  | {
      kind: "create";
      input: TableInput & { locationId: string };
    }
  | {
      kind: "update";
      id: string;
      input: Partial<TableInput>;
    }
  | {
      kind: "status";
      id: string;
      isActive: boolean;
    };

export function tableDraft(table?: RestaurantTable): TableDraft {
  return {
    code: table?.code ?? "",
    name: table?.name ?? "",
    capacity: table?.capacity == null ? "" : String(table.capacity),
  };
}

export function tableChanges(
  table: RestaurantTable,
  values: TableInput
): Partial<TableInput> {
  const patch: Partial<TableInput> = {};

  if (values.code !== table.code) {
    patch.code = values.code;
  }

  if (values.name !== table.name) {
    patch.name = values.name;
  }

  if (values.capacity !== table.capacity) {
    patch.capacity = values.capacity;
  }

  return patch;
}

export function tableLocationLabel(name: string): string {
  const text = name
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CO");

  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

export function tableCapacityLabel(capacity: number | null): string {
  return capacity === null
    ? "Sin definir"
    : capacity === 1
      ? "1 persona"
      : capacity + " personas";
}
