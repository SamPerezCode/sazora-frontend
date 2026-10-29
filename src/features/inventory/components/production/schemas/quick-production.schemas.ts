import { z } from "zod";

import {
  movementSummary,
  movementDetail,
  movementLine,
} from "../../../schemas/inventory-audit.schema";

export const productionMovementSummary = movementSummary.extend({
  movementType: z.literal("PRODUCTION"),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
});

export const quickProductionSchema = movementDetail.extend({
  movementType: z.literal("PRODUCTION"),
  sourceType: z.literal("PRODUCTION_BATCH"),
  sourceId: z.string().nullable(),
  lines: z.array(
    movementLine.extend({
      notes: z.string().nullable(),
    })
  ),
});

export type QuickProduction = z.infer<typeof quickProductionSchema>;

export type QuickProductionSummary = z.infer<
  typeof productionMovementSummary
>;

export type QuickProductionLine = QuickProduction["lines"][number];
