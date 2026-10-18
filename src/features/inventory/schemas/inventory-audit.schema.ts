import { z } from "zod";
import { baseUnitSchema } from "./inventory.schema";
import {
  id,
  numeric,
  locationSchema,
  stockQuantity,
  positive,
} from "./inventory-location.schema";
import { fixed } from "../utils/inventory-value";

export const movementType = z.enum([
  "OPENING",
  "PURCHASE",
  "PRODUCTION",
  "SALE",
  "ADJUSTMENT",
  "WASTE",
  "RETURN",
  "REVERSAL",
]);

export const movementSummary = z.object({
  id,
  businessId: id,
  location: locationSchema.nullable(),
  movementType,
  externalReference: z.string().nullable(),
  notes: z.string().nullable(),
  createdByName: z.string(),
  createdAt: z.string(),
  lineCount: z.number().int(),
});

export const movementLine = z.object({
  id,
  inventoryItemId: id,
  inventoryItemName: z.string(),
  baseUnit: baseUnitSchema,
  direction: z.enum(["IN", "OUT"]),
  quantity: numeric,
  balanceBefore: numeric,
  balanceAfter: numeric,
  unitCost: numeric.nullable(),
  totalCost: numeric.nullable(),
  averageUnitCostBefore: numeric.nullable(),
  averageUnitCostAfter: numeric.nullable(),
  inventoryValueBefore: numeric.nullable(),
  inventoryValueAfter: numeric.nullable(),
  costStatus: z.enum(["VALUED", "UNVALUED_LEGACY"]),
});

export const movementDetail = movementSummary
  .omit({ lineCount: true })
  .extend({
    lines: z.array(movementLine),
  });

export const kardexEntry = movementLine.omit({ id: true }).extend({
  movementId: id,
  movementLineId: id,
  movementType,
  location: locationSchema.nullable(),
  externalReference: z.string().nullable(),
  createdByName: z.string(),
  createdAt: z.string(),
});

export const kardexReport = z.object({
  entries: z.array(kardexEntry),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const reconciliationReport = z.object({
  summary: z.object({
    inventoryItemCount: z.number(),
    inconsistentItemCount: z.number(),
    physicalMismatchCount: z.number(),
    negativeBalanceCount: z.number(),
    unvaluedBalanceCount: z.number(),
    movementWithoutLocationCount: z.number(),
    unvaluedMovementLineCount: z.number(),
    isPhysicallyConsistent: z.boolean(),
    hasLegacyAuditGaps: z.boolean(),
  }),
  items: z.array(
    z.object({
      inventoryItemId: id,
      sku: z.string().nullable(),
      name: z.string(),
      globalStock: numeric,
      locationStock: numeric,
      difference: numeric,
      negativeLocationCount: z.number(),
      unvaluedLocationCount: z.number(),
      issues: z.array(
        z.enum([
          "PHYSICAL_STOCK_MISMATCH",
          "NEGATIVE_LOCATION_STOCK",
          "UNVALUED_LOCATION_STOCK",
        ])
      ),
    })
  ),
});

const quantity = stockQuantity.pipe(
  z
    .string()
    .refine(
      (value) => fixed(value) > 0n,
      "La cantidad debe ser mayor que cero."
    )
);

const productionLine = z.object({
  inventoryItemId: id,
  quantity,
  notes: z.string().max(500).nullable(),
});

export const productionInput = z
  .object({
    locationId: id,
    notes: z.string().trim().max(500).nullable(),
    inputs: z.array(productionLine).min(1).max(100),
    outputs: z
      .array(
        productionLine.extend({
          costAllocationPercentage: positive.pipe(
            z
              .string()
              .refine(
                (value) => fixed(value) <= fixed("100"),
                "El porcentaje no puede superar 100."
              )
          ),
        })
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, context) => {
    const ids = [...value.inputs, ...value.outputs].map(
      (line) => line.inventoryItemId
    );

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message:
          "Un artículo no puede repetirse ni ser insumo y resultado.",
      });
    }

    const total = value.outputs.reduce(
      (sum, line) => sum + fixed(line.costAllocationPercentage),
      0n
    );

    if (total !== fixed("100")) {
      context.addIssue({
        code: "custom",
        message: "La distribución debe sumar exactamente 100 %.",
      });
    }
  });

export type ProductionInput = z.infer<typeof productionInput>;
export type Movement = z.infer<typeof movementDetail>;
