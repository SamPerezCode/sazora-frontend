import { z } from "zod";
import { id, numeric } from "../../../schemas/inventory-location.schema";
import {
  baseUnitSchema,
  inventoryItemSchema,
} from "../../../schemas/inventory.schema";
import { fixed } from "../../../utils/inventory-value";

export const statusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const named = z.object({
  id,
  code: z.string(),
  name: z.string(),
});

export const date = z.iso.datetime({ offset: true });

export const orderLineSchema = z.object({
  id,
  inventoryItemId: id,
  inventoryItemName: z.string(),
  inventoryItemSku: z.string().nullable(),
  baseUnit: baseUnitSchema,
  plannedQuantity: numeric,
  actualQuantity: numeric.nullable(),
});

export const orderSchema = z.object({
  id,
  businessId: id,
  recipe: named,
  location: named,
  status: statusSchema,
  batchQuantity: numeric,
  plannedFor: date.nullable(),
  notes: z.string().nullable(),
  inventoryMovementId: id.nullable(),
  version: z.number().int().positive(),

  createdByMembershipId: id,
  createdByName: z.string(),
  updatedByMembershipId: id,
  updatedByName: z.string(),

  startedByMembershipId: id.nullable(),
  startedByName: z.string().nullable(),
  completedByMembershipId: id.nullable(),
  completedByName: z.string().nullable(),
  cancelledByMembershipId: id.nullable(),
  cancelledByName: z.string().nullable(),

  createdAt: date,
  updatedAt: date,
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  cancelledAt: date.nullable(),
  cancellationReason: z.string().nullable(),

  inputs: z.array(orderLineSchema),
  outputs: z.array(
    orderLineSchema.extend({
      costAllocationPercentage: numeric,
    })
  ),
});

export const orderSummarySchema = orderSchema
  .omit({ inputs: true, outputs: true })
  .extend({
    inputCount: z.number().int(),
    outputCount: z.number().int(),
  });

export const recipeLineSchema = orderLineSchema
  .omit({ plannedQuantity: true, actualQuantity: true })
  .extend({
    quantity: numeric,
    notes: z.string().nullable(),
  });

export const recipeSchema = named.extend({
  businessId: id,
  isActive: z.boolean(),
  notes: z.string().nullable(),
  updatedAt: date,
  inputs: z.array(recipeLineSchema),
  outputs: z.array(
    recipeLineSchema.extend({
      costAllocationPercentage: numeric,
    })
  ),
});

export const recipeSummarySchema = recipeSchema.omit({
  inputs: true,
  outputs: true,
});

export const performanceLineSchema = orderLineSchema
  .omit({ id: true })
  .extend({
    differenceQuantity: numeric.nullable(),
    variationPercentage: numeric.nullable(),
    actualUnitCost: numeric.nullable(),
    actualCost: numeric.nullable(),
    declaredWasteQuantity: numeric,
    declaredWasteCost: numeric,
  });

export const costSummarySchema = z.object({
  expectedInputCostAtActualRate: numeric.nullable(),
  actualInputCost: numeric.nullable(),
  inputCostDifference: numeric.nullable(),
  inputCostVariationPercentage: numeric.nullable(),
  declaredWasteCost: numeric,
  totalResourceCost: numeric.nullable(),
  producedInventoryValue: numeric.nullable(),
});

export const performanceSchema = z.object({
  productionOrderId: id,
  businessId: id,
  locationId: id,
  status: statusSchema,
  inventoryMovementId: id.nullable(),
  inputs: z.array(
    performanceLineSchema.extend({
      expectedCostAtActualRate: numeric.nullable(),
      costDifference: numeric.nullable(),
      costVariationPercentage: numeric.nullable(),
    })
  ),
  outputs: z.array(
    performanceLineSchema.extend({
      costAllocationPercentage: numeric,
      yieldPercentage: numeric.nullable(),
    })
  ),
  summary: costSummarySchema,
});

export const wasteSchema = z.object({
  id,
  businessId: id,
  productionOrderId: id,
  inventoryMovementId: id,
  reason: z.string(),
  recordedByMembershipId: id,
  recordedByName: z.string(),
  createdAt: date,
  lines: z.array(
    recipeLineSchema.extend({
      unitCost: numeric.nullable(),
      totalCost: numeric.nullable(),
    })
  ),
});

export const historySchema = z.object({
  orders: z.array(
    costSummarySchema.extend({
      productionOrderId: id,
      status: statusSchema,
      location: named,
      performanceAvailable: z.boolean(),
    })
  ),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const reportSummarySchema = z.object({
  summary: costSummarySchema.extend({
    orderCount: z.number().int(),
    draftCount: z.number().int(),
    plannedCount: z.number().int(),
    inProgressCount: z.number().int(),
    completedCount: z.number().int(),
    cancelledCount: z.number().int(),
  }),
});

export const positiveQuantity = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/,
    "Usa punto decimal y máximo 3 decimales."
  )
  .pipe(
    z
      .string()
      .refine(
        (value) => fixed(value) > 0n,
        "La cantidad debe ser mayor que cero."
      )
  );

export const versionSchema = z.number().int().positive();

export const quantityLineSchema = z
  .object({
    inventoryItemId: id,
    quantity: positiveQuantity,
  })
  .strict();

export const editOrderSchema = z
  .object({
    version: versionSchema,
    recipeId: id,
    locationId: id,
    batchQuantity: positiveQuantity,
    plannedFor: date.nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .strict();

export const completeOrderSchema = z
  .object({
    version: versionSchema,
    inputs: z.array(quantityLineSchema).min(1).max(100),
    outputs: z.array(quantityLineSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = [...value.inputs, ...value.outputs].map(
      (line) => line.inventoryItemId
    );

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "No repitas artículos en la orden.",
      });
    }
  });

export const wasteInputSchema = z
  .object({
    version: versionSchema,
    reason: z
      .string()
      .trim()
      .min(3, "Explica el motivo (mínimo 3 caracteres).")
      .max(500),
    lines: z
      .array(
        quantityLineSchema.extend({
          notes: z.string().trim().max(500).nullable(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.lines.map((line) => line.inventoryItemId);

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "No repitas artículos.",
      });
    }
  });

export const createOrderSchema = editOrderSchema.omit({
  version: true,
});

export const allocationSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/,
    "Usa máximo 6 decimales."
  )
  .pipe(
    z
      .string()
      .refine(
        (value) => fixed(value) > 0n && fixed(value) <= fixed("100"),
        "El porcentaje debe ser mayor que cero y máximo 100."
      )
  )
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return whole + "." + fraction.padEnd(6, "0");
  });

export const quickLineSchema = quantityLineSchema.extend({
  notes: z.string().trim().max(500).nullable(),
});

export const quickCreateSchema = z
  .object({
    locationId: id,
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
  .superRefine((value, context) => {
    const used = new Set<string>();

    for (const group of ["inputs", "outputs"] as const) {
      value[group].forEach((line, index) => {
        if (used.has(line.inventoryItemId)) {
          context.addIssue({
            code: "custom",
            path: [group, index, "inventoryItemId"],
            message:
              "El artículo no puede repetirse ni ser insumo y resultado.",
          });
        }

        used.add(line.inventoryItemId);
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
      context.addIssue({
        code: "custom",
        path: ["outputs"],
        message: "La distribución debe sumar exactamente 100 %.",
      });
    }
  });

export const productionItemSchema = inventoryItemSchema.pick({
  id: true,
  businessId: true,
  name: true,
  sku: true,
  baseUnit: true,
  isActive: true,
});
