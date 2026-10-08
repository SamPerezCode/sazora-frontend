import { z } from "zod";

export const itemTypeSchema = z.enum([
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "FINISHED_GOOD",
  "RESALE_GOOD",
]);

export const baseUnitSchema = z.enum([
  "UNIT",
  "GRAM",
  "KILOGRAM",
  "MILLILITER",
  "LITER",
  "PORTION",
  "PACKAGE",
]);

export const stockStatusSchema = z.enum([
  "OUT_OF_STOCK",
  "LOW_STOCK",
  "AVAILABLE",
]);

const decimal = z.string().regex(/^-?\d+(?:\.\d{1,3})?$/);
const date = z.iso.datetime({ offset: true });

export const inventoryItemSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  sku: z.string().nullable(),
  name: z.string(),
  itemType: itemTypeSchema,
  baseUnit: baseUnitSchema,
  currentStock: decimal,
  minimumStock: decimal,
  stockStatus: stockStatusSchema,
  isActive: z.boolean(),
  createdAt: date,
  updatedAt: date,
});

export const inventoryListSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    items: z.array(inventoryItemSchema),
  }),
});

// Solo los campos necesarios para el contador.
// No consulta los detalles de cada movimiento.
export const movementCounterSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    movements: z.array(
      z.object({
        id: z.string().min(1),
        businessId: z.string().min(1),
        createdAt: date,
      })
    ),
  }),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export type MovementCounter = z.infer<
  typeof movementCounterSchema
>["data"]["movements"][number];
