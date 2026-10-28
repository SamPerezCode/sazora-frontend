import { z } from "zod";
import { id, numeric } from "../schemas/inventory-location.schema";
import { baseUnitSchema } from "../schemas/inventory.schema";
import { fixed } from "../utils/inventory-value";

export const statusSchema = z.enum(["DRAFT", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
const named = z.object({ id, code: z.string(), name: z.string() });
const date = z.iso.datetime({ offset: true });
const line = z.object({
  id, inventoryItemId: id, inventoryItemName: z.string(),
  inventoryItemSku: z.string().nullable(), baseUnit: baseUnitSchema,
  plannedQuantity: numeric, actualQuantity: numeric.nullable(),
});
export const orderSchema = z.object({
  id, businessId: id, recipe: named, location: named,
  status: statusSchema, batchQuantity: numeric, plannedFor: date.nullable(),
  notes: z.string().nullable(), inventoryMovementId: id.nullable(),
  version: z.number().int().positive(),
  createdByMembershipId: id, createdByName: z.string(),
  updatedByMembershipId: id, updatedByName: z.string(),
  startedByMembershipId: id.nullable(), startedByName: z.string().nullable(),
  completedByMembershipId: id.nullable(), completedByName: z.string().nullable(),
  cancelledByMembershipId: id.nullable(), cancelledByName: z.string().nullable(),
  createdAt: date, updatedAt: date, startedAt: date.nullable(),
  completedAt: date.nullable(), cancelledAt: date.nullable(),
  cancellationReason: z.string().nullable(),
  inputs: z.array(line),
  outputs: z.array(line.extend({ costAllocationPercentage: numeric })),
});
export const orderSummarySchema = orderSchema.omit({ inputs: true, outputs: true }).extend({
  inputCount: z.number().int(), outputCount: z.number().int(),
});
const recipeLine = line.omit({ plannedQuantity: true, actualQuantity: true }).extend({
  quantity: numeric, notes: z.string().nullable(),
});
export const recipeSchema = named.extend({
  businessId: id, isActive: z.boolean(), notes: z.string().nullable(),
  updatedAt: date,
  inputs: z.array(recipeLine),
  outputs: z.array(recipeLine.extend({ costAllocationPercentage: numeric })),
});
export const recipeSummarySchema = recipeSchema.omit({ inputs: true, outputs: true });
const performanceLine = line.omit({ id: true }).extend({
  differenceQuantity: numeric.nullable(), variationPercentage: numeric.nullable(),
  actualUnitCost: numeric.nullable(), actualCost: numeric.nullable(),
  declaredWasteQuantity: numeric, declaredWasteCost: numeric,
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
  productionOrderId: id, businessId: id, locationId: id,
  status: statusSchema, inventoryMovementId: id.nullable(),
  inputs: z.array(performanceLine.extend({
    expectedCostAtActualRate: numeric.nullable(),
    costDifference: numeric.nullable(), costVariationPercentage: numeric.nullable(),
  })),
  outputs: z.array(performanceLine.extend({
    costAllocationPercentage: numeric, yieldPercentage: numeric.nullable(),
  })),
  summary: costSummarySchema,
});
export const wasteSchema = z.object({
  id, businessId: id, productionOrderId: id, inventoryMovementId: id,
  reason: z.string(), recordedByMembershipId: id, recordedByName: z.string(),
  createdAt: date,
  lines: z.array(recipeLine.omit({ quantity: true }).extend({
    quantity: numeric, unitCost: numeric.nullable(), totalCost: numeric.nullable(),
  })),
});
export const historyRowSchema = costSummarySchema.extend({
  productionOrderId: id, status: statusSchema, location: named,
  performanceAvailable: z.boolean(),
});
export const historySchema = z.object({
  orders: z.array(historyRowSchema),
  pagination: z.object({
    page: z.number().int(), pageSize: z.number().int(),
    total: z.number().int(), totalPages: z.number().int(),
  }),
});
export const reportSummarySchema = z.object({
  summary: costSummarySchema.extend({
    orderCount: z.number().int(), draftCount: z.number().int(),
    plannedCount: z.number().int(), inProgressCount: z.number().int(),
    completedCount: z.number().int(), cancelledCount: z.number().int(),
  }),
});
export const positiveQuantity = z.string().trim()
  .regex(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/, "Usa punto decimal y máximo 3 decimales.")
  .pipe(z.string().refine(value => fixed(value) > 0n, "La cantidad debe ser mayor que cero."));
const version = z.number().int().positive();
const quantityLine = z.object({ inventoryItemId: id, quantity: positiveQuantity }).strict();
export const editOrderSchema = z.object({
  version, recipeId: id, locationId: id, batchQuantity: positiveQuantity,
  plannedFor: date.nullable(), notes: z.string().trim().max(500).nullable(),
}).strict();
export const completeOrderSchema = z.object({
  version, inputs: z.array(quantityLine).min(1).max(100),
  outputs: z.array(quantityLine).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  const ids = [...value.inputs, ...value.outputs].map(line => line.inventoryItemId);
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: "custom", message: "No repitas artículos en la orden." });
});
export const wasteInputSchema = z.object({
  version, reason: z.string().trim().min(3, "Explica el motivo (mínimo 3 caracteres).").max(500),
  lines: z.array(quantityLine.extend({ notes: z.string().trim().max(500).nullable() })).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.lines.map(line => line.inventoryItemId)).size !== value.lines.length)
    ctx.addIssue({ code: "custom", path: ["lines"], message: "No repitas artículos." });
});
export type Order = z.infer<typeof orderSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type Performance = z.infer<typeof performanceSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Status = Order["status"];
export type Action = "detail" | "edit" | "plan" | "start" | "cancel" | "complete" | "waste" | "performance" | "movement";
export type Mutation =
  | { action: "edit"; payload: z.infer<typeof editOrderSchema> }
  | { action: "complete"; payload: z.infer<typeof completeOrderSchema> }
  | { action: "waste"; payload: z.infer<typeof wasteInputSchema> }
  | { action: "plan" | "start"; payload: { version: number } }
  | { action: "cancel"; payload: { version: number; cancellationReason: string } };
