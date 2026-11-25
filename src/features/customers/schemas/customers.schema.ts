import { z } from "zod";

import {
  orderSummarySchema,
  orderLocationSchema,
  sourceChannelSchema,
  serviceTypeSchema,
  paymentStatusSchema,
} from "../../sales/schemas/sales.schema";

import {
  saleId,
  saleRowSchema,
} from "../../sales/schemas/financial-sales.schema";

import { paginationSchema } from "../../reports/schemas/reports.schema";

const date = z.iso.datetime({ offset: true });
const money = z.string().regex(/^-?\d+(?:\.\d{1,6})?$/);
const count = z.number().int().nonnegative();

export const customerSchema = z.object({
  id: saleId,
  businessId: saleId,
  legalName: z.string(),
  billingEmail: z.string().nullable(),
  billingPhone: z.string().nullable(),
  normalizedPhone: z.string().nullable(),

  acquisitionSourceChannel: sourceChannelSchema.nullable(),
  lastSourceChannel: sourceChannelSchema.nullable(),

  marketingConsent: z.boolean(),
  marketingConsentAt: date.nullable(),

  firstSeenAt: date,
  lastSeenAt: date,
  isActive: z.boolean(),
  createdAt: date,
  updatedAt: date,

  orderCount: count,
  saleCount: count,

  grossSalesTotal: money,
  refundedTotal: money,
  effectiveSalesTotal: money,

  firstPurchaseAt: date.nullable(),
  lastPurchaseAt: date.nullable(),
});

export const customerListSchema = z.object({
  customers: z.array(customerSchema),
  pagination: paginationSchema,
});

export const customerOrderSchema = orderSummarySchema.extend({
  businessId: saleId,
  commercialCustomerId: saleId,
  location: orderLocationSchema,
  sourceChannel: sourceChannelSchema,
  paymentStatus: paymentStatusSchema,
});

export const customerOrdersSchema = z.object({
  orders: z.array(customerOrderSchema),
  pagination: paginationSchema,
});

export const customerSalesSchema = z.object({
  sales: z.array(
    saleRowSchema.extend({
      commercialCustomerId: saleId,
      serviceType: serviceTypeSchema,
      sourceChannel: sourceChannelSchema,
    })
  ),
  pagination: paginationSchema,
});

export type Customer = z.infer<typeof customerSchema>;

export type CustomerFilter = {
  search: string;
  isActive: "" | "true" | "false";
  acquisitionSourceChannel:
    | ""
    | NonNullable<Customer["acquisitionSourceChannel"]>;
  page: number;
  pageSize: number;
};

export type CustomerChange =
  | { kind: "marketing-consent"; value: boolean }
  | { kind: "status"; value: boolean };

export const channelLabels = {
  IN_PERSON: "Presencial",
  WHATSAPP: "WhatsApp",
  PHONE: "Teléfono",
  PUBLIC_MENU: "Menú público",
};

export function channel(value: Customer["lastSourceChannel"]) {
  return value ? channelLabels[value] : "Sin información";
}
