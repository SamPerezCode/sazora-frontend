import { z } from "zod";

const decimal = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/)
  .refine((value) => Number.isFinite(Number(value)));

const count = z.number().int().nonnegative();
const date = z.iso.date();

const weekday = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
});

export const dashboardSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),

  business: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    timezone,
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
  }),

  period: z.object({
    timezone,
    today: date,
    weekStart: date,
    weekEnd: date,
  }),

  summary: z.object({
    todaySales: decimal,
    yesterdaySales: decimal,
    salesVariationPercentage: decimal.nullable(),
    openOrders: count,
    activeDeliveries: count,
    servedCustomers: count,
    closedOrders: count,
    averageTicket: decimal,
    averageDeliveryMinutes: z.number().nonnegative().nullable(),
  }),

  weeklySales: z
    .array(
      z.object({
        date,
        dayOfWeek: z.number().int().min(1).max(7),
        weekday,
        total: decimal,
      })
    )
    .length(7),

  topProducts: z.array(
    z.object({
      productId: z.string().min(1),
      productName: z.string(),
      quantitySold: count,
      salesTotal: decimal,
    })
  ),

  ordersInProgress: z.array(
    z.object({
      id: z.string().min(1),
      serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]),
      status: z.enum([
        "OPEN",
        "CONFIRMED",
        "DELIVERED",
        "CLOSED",
        "CANCELLED",
      ]),
      restaurantTableCode: z.string().nullable(),
      restaurantTableName: z.string().nullable(),
      customerName: z.string().nullable(),
      deliveryAddress: z.string().nullable(),
      itemCount: count,
      subtotal: decimal,
      createdAt: z.iso.datetime({ offset: true }),
    })
  ),

  criticalInventory: z.array(
    z.object({
      inventoryItemId: z.string().min(1),
      name: z.string(),
      baseUnit: z.enum([
        "UNIT",
        "GRAM",
        "KILOGRAM",
        "MILLILITER",
        "LITER",
        "PORTION",
        "PACKAGE",
      ]),
      currentStock: decimal,
      minimumStock: decimal,
      stockPercentage: z.number().nullable(),
    })
  ),
});

export const dashboardResponseSchema = z.object({
  status: z.literal("success"),
  data: dashboardSchema,
});
