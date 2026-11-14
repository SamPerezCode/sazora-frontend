import { z } from "zod";

export const saleId = z.string().regex(/^[1-9]\d*$/);

const amount = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
const date = z.iso.datetime({ offset: true });

const employee = z.object({
  membershipId: saleId,
  fullName: z.string(),
});

const location = z.object({
  id: saleId,
  name: z.string(),
  code: z.string(),
});

export const saleStatuses = [
  "COMPLETED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "VOIDED",
] as const;

export const saleLabels: Record<
  (typeof saleStatuses)[number],
  string
> = {
  COMPLETED: "Completada",
  PARTIALLY_REFUNDED: "Parcialmente devuelta",
  REFUNDED: "Devuelta",
  VOIDED: "Anulada",
};

const saleBase = z.object({
  id: saleId,
  businessId: saleId,
  locationId: saleId,
  orderId: saleId,
  cashSessionId: saleId,
  location,
  soldBy: employee,
  status: z.enum(saleStatuses),
  currencyCode: z.string(),
  netSubtotal: amount,
  taxTotal: amount,
  discountTotal: amount,
  tipTotal: amount,
  total: amount,
  soldAt: date,
  voidReason: z.string().nullable(),
  voidedAt: date.nullable(),
});

export const saleRowSchema = saleBase.extend({
  customerName: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  unitsSold: z.number().nonnegative(),
  refundedTotalAmount: amount,
  voidedAmount: amount,
  effectiveTotalAmount: amount,
});

export const saleDetailSchema = saleBase.extend({
  items: z.array(
    z.object({
      id: saleId,
      productName: z.string(),
      quantity: z.number().positive(),
      unitPrice: amount,
      taxName: z.string().nullable(),
      lineNetTotal: amount,
      lineTaxTotal: amount,
      lineTotal: amount,
    })
  ),
  payments: z.array(
    z.object({
      id: saleId,
      paymentMethodName: z.string(),
      amount,
      tenderedAmount: amount,
      changeAmount: amount,
      reference: z.string().nullable(),
      paidAt: date,
      processedBy: employee,
    })
  ),
});

export const salesResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    sales: z.array(saleRowSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
});

export type SaleRow = z.infer<typeof saleRowSchema>;

export type SalesFilters = {
  locationId: string;
  cashSessionId: string;
  status: "" | (typeof saleStatuses)[number];
  from: string;
  to: string;
};
