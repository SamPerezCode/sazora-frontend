import { z } from "zod";

import { dashboardSchema } from "../dashboard/schemas/dashboard.schema";
import {
  serviceTypeSchema,
  orderStatusSchema,
} from "../sales/schemas/sales.schema";
import { kitchenWorkflowModeSchema } from "../kitchen-flow/kitchen-flow.schema";

const id = z.string().regex(/^[1-9]\d*$/);
const count = z.number().int().nonnegative();
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const timestamp = z.iso.datetime({ offset: true });

const location = z.object({
  id,
  name: z.string(),
  code: z.string(),
});

const locationFields = {
  locationId: id,
  locationName: z.string(),
  locationCode: z.string(),
};

export const scopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("BUSINESS"),
    location: z.null(),
  }),
  z.object({
    type: z.literal("LOCATION"),
    location,
  }),
]);

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: count,
  totalPages: count,
});

const base = {
  generatedAt: timestamp,
  business: dashboardSchema.shape.business,
  scope: scopeSchema,
};

const period = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  timezone: z.string(),
});

const tableFields = {
  serviceType: serviceTypeSchema,
  restaurantTableId: id.nullable(),
  restaurantTableName: z.string().nullable(),
  restaurantTableCode: z.string().nullable(),
};

const salesMetrics = {
  salesTotal: decimal,
  orderCount: count,
  unitsSold: count,
};

export const overviewSchema = dashboardSchema.extend({
  scope: scopeSchema,

  dataScopes: z.object({
    orders: z.enum(["BUSINESS", "LOCATION"]),
    deliveries: z.enum(["BUSINESS", "LOCATION"]),
    criticalInventory: z.literal("BUSINESS"),
  }),

  ordersInProgress: z.array(
    dashboardSchema.shape.ordersInProgress.element.extend(
      locationFields
    )
  ),
});

export const salesReportSchema = z.object({
  ...base,
  period,

  summary: z.object({
    ...salesMetrics,
    averageTicket: decimal,
  }),

  byServiceType: z.array(
    z.object({
      serviceType: serviceTypeSchema,
      ...salesMetrics,
    })
  ),

  byLocation: z.array(
    z.object({
      ...locationFields,
      ...salesMetrics,
      servedCustomers: count,
      averageTicket: decimal,
      salesPercentage: decimal,
    })
  ),

  topProducts: z.array(
    dashboardSchema.shape.topProducts.element.extend({
      orderCount: count,
    })
  ),

  history: z.object({
    sales: z.array(
      z.object({
        orderId: id,
        ...locationFields,
        ...tableFields,

        openedByMembershipId: id,
        openedByName: z.string(),

        customerCount: count.nullable(),
        itemCount: count,
        unitsSold: count,
        salesTotal: decimal,

        createdAt: timestamp,
        confirmedAt: timestamp.nullable(),
        deliveredAt: timestamp.nullable(),
        closedAt: timestamp,
      })
    ),

    pagination: paginationSchema,
  }),

  financialSource: z.literal("CLOSED_ORDERS"),
});

export const eventTypeSchema = z.enum([
  "FULL_ITEM",
  "PARTIAL_QUANTITY",
]);

const cancellationMetrics = {
  cancelledOrderCount: count,
  affectedOrderCount: count,
  cancellationEventCount: count,
  cancelledUnitCount: count,
  affectedAmount: decimal,
};

export const cancellationEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: eventTypeSchema,

  orderId: id,
  orderItemId: id,
  orderStatus: orderStatusSchema,
  orderIsCancelled: z.boolean(),

  ...locationFields,
  ...tableFields,

  productId: id,
  productName: z.string(),

  previousQuantity: count,
  remainingQuantity: count.nullable(),
  cancelledQuantity: count,

  unitPrice: decimal,
  affectedAmount: decimal,
  reason: z.string(),

  cancelledByMembershipId: id,
  cancelledByName: z.string(),
  cancelledAt: timestamp,
});

export const cancellationReportSchema = z.object({
  ...base,
  period,

  summary: z.object({
    ...cancellationMetrics,
    fullyCancelledProductCount: count,
    partialCancellationCount: count,
  }),

  byLocation: z.array(
    z.object({
      ...locationFields,
      ...cancellationMetrics,
    })
  ),

  history: z.object({
    cancellations: z.array(cancellationEventSchema),
    pagination: paginationSchema,
  }),

  financialMeaning: z.literal("POTENTIAL_GROSS_AMOUNT_NOT_REFUND"),
  dataSource: z.literal("ORDER_ITEM_CHANGE_LEDGER"),
});

export const timingSchema = z.object({
  sampleSize: count,
  averageMinutes: z.number().nonnegative().nullable(),
});

const kitchenMetrics = z.object({
  orderCount: count,
  ticketCount: count,
  itemCount: count,

  pendingItemCount: count,
  inPreparationItemCount: count,
  readyItemCount: count,
  deliveredItemCount: count,
  cancelledItemCount: count,

  prepareToOrderItemCount: count,
  readyToServeItemCount: count,

  screenTracking: z.object({
    itemCount: count,
    queueTime: timingSchema,
    preparationTime: timingSchema,
    handoffTime: timingSchema,
    totalCycleTime: timingSchema,
  }),

  printOnlyTracking: z.object({
    itemCount: count,
    confirmationToDeliveryTime: timingSchema,
  }),
});

const modeMetrics = z.object({
  workflowMode: kitchenWorkflowModeSchema,
  metrics: kitchenMetrics,
});

export const kitchenReportSchema = z.object({
  ...base,
  period,

  summary: z.object({
    overall: kitchenMetrics,
    byWorkflowMode: z.array(modeMetrics),
  }),

  byLocation: z.array(
    z.object({
      ...locationFields,
      modes: z.array(modeMetrics),
    })
  ),

  byPreparationArea: z.array(
    z.object({
      preparationAreaId: id,
      preparationAreaName: z.string(),
      modes: z.array(modeMetrics),
    })
  ),

  periodBasis: z.literal("KITCHEN_ITEM_CREATED_AT"),

  dataLimitations: z.array(
    z.enum([
      "PRINT_ONLY_NO_PREPARATION_TIMESTAMPS",
      "READY_TO_SERVE_NO_PREPARATION_DURATION",
    ])
  ),
});

const range = z.object({
  from: z.iso.date("Selecciona una fecha válida."),
  to: z.iso.date("Selecciona una fecha válida."),
});

export const filterSchema = range
  .extend({
    serviceType: z.union([serviceTypeSchema, z.literal("")]),
    openedByMembershipId: z.union([id, z.literal("")]),
    cancelledByMembershipId: z.union([id, z.literal("")]),
    eventType: z.union([eventTypeSchema, z.literal("")]),
    preparationAreaId: z.union([id, z.literal("")]),
    workflowMode: z.union([kitchenWorkflowModeSchema, z.literal("")]),
  })
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Hasta debe ser igual o posterior a Desde.",
      });
    } else if (
      (Date.parse(value.to) - Date.parse(value.from)) / 86400000 + 1 >
      366
    ) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "El rango no puede superar 366 días.",
      });
    }
  });

export type ReportScope = z.infer<typeof scopeSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type KitchenTimingMetric = z.infer<typeof timingSchema>;

export type DashboardResponse = z.infer<typeof overviewSchema>;
export type SalesReportResponse = z.infer<typeof salesReportSchema>;
export type CancellationReportResponse = z.infer<
  typeof cancellationReportSchema
>;
export type KitchenOperationReportResponse = z.infer<
  typeof kitchenReportSchema
>;

export type CancellationEvent = z.infer<
  typeof cancellationEventSchema
>;
export type ReportFilters = z.infer<typeof filterSchema>;

export type SalesFilters = Pick<
  ReportFilters,
  "from" | "to" | "serviceType" | "openedByMembershipId"
>;

export type CancellationFilters = Pick<
  ReportFilters,
  | "from"
  | "to"
  | "serviceType"
  | "cancelledByMembershipId"
  | "eventType"
>;

export type KitchenFilters = Pick<
  ReportFilters,
  "from" | "to" | "serviceType" | "preparationAreaId" | "workflowMode"
>;

export type ReportTab =
  | "summary"
  | "sales"
  | "cancellations"
  | "kitchen";
