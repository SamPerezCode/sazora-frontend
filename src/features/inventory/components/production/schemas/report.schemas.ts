import { z } from "zod";
import { id } from "../../../schemas/inventory-location.schema";
import {
  costSummarySchema,
  reportSummarySchema,
  historySchema,
  statusSchema,
} from "./production.schemas";

export const dateFieldSchema = z.enum([
  "CREATED",
  "PLANNED",
  "STARTED",
  "COMPLETED",
]);

export const groupBySchema = z.enum([
  "LOCATION",
  "OUTPUT",
  "EMPLOYEE",
]);

export const statusFilterSchema = z.union([
  z.literal(""),
  statusSchema,
]);

const optionalId = z.union([z.literal(""), id]);

export const reportFiltersSchema = z
  .object({
    from: z.iso.date("Selecciona una fecha inicial válida."),
    to: z.iso.date("Selecciona una fecha final válida."),
    dateField: dateFieldSchema,
    search: z.string().trim().max(100),
    status: statusFilterSchema,
    membershipId: optionalId,
    outputInventoryItemId: optionalId,
  })
  .superRefine((value, ctx) => {
    if (value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "La fecha final no puede ser anterior a la inicial.",
      });
    } else if (
      (Date.parse(value.to) - Date.parse(value.from)) / 86400000 >
      366
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "El rango del informe no puede superar 366 días.",
      });
    }
  });

const metadata = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  period: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    timezone: z.string(),
  }),
  dateField: dateFieldSchema,
});

export const summaryReportSchema = metadata.extend(
  reportSummarySchema.shape
);

export const historyReportSchema = metadata.extend(
  historySchema.shape
);

export const reportGroupSchema = costSummarySchema.extend({
  key: id,
  label: z.string(),
  orderCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
});

export const groupedReportSchema = metadata.extend({
  groupBy: groupBySchema,
  groups: z.array(reportGroupSchema),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export type ReportGroup = z.infer<typeof reportGroupSchema>;

export type ReportSummary = z.infer<
  typeof reportSummarySchema
>["summary"];

export type ReportGroupBy = z.infer<typeof groupBySchema>;

export type ReportView = "summary" | "history" | ReportGroupBy;
