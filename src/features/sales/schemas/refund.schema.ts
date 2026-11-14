import { z } from "zod";
import { saleId, saleStatuses } from "./financial-sales.schema";

export const refundAmount = z.string().regex(/^\d+(?:\.\d{1,6})?$/);

export const refundPaymentAmount = z
  .string()
  .trim()
  .regex(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/);

const actor = z.object({
  membershipId: saleId,
  fullName: z.string(),
});

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable();

export const refundSchema = z.object({
  id: saleId,
  businessId: saleId,
  saleId,
  cashSessionId: saleId,
  processedBy: actor,
  refundKind: z.enum(["PARTIAL", "FULL"]),
  reason: z.string(),
  refundedAt: z.iso.datetime({ offset: true }),
  netAmount: refundAmount,
  taxAmount: refundAmount,
  totalAmount: refundAmount,
  costAmount: refundAmount.nullable(),

  items: z.array(
    z.object({
      id: saleId,
      saleItemId: saleId,
      productName: z.string(),
      quantity: z.number().int().positive(),
      restoreInventory: z.boolean(),
      inventoryMovementId: saleId.nullable(),
      netAmount: refundAmount,
      taxAmount: refundAmount,
      totalAmount: refundAmount,
      costAmount: refundAmount.nullable(),
    })
  ),

  payments: z.array(
    z.object({
      id: saleId,
      salePaymentId: saleId,
      paymentMethodName: z.string(),
      affectsCash: z.boolean(),
      amount: refundAmount,
      reference: z.string().nullable(),
      notes: z.string().nullable(),
      cashMovementId: saleId.nullable(),
    })
  ),
});

export const refundSaleSchema = z.object({
  id: saleId,
  businessId: saleId,
  locationId: saleId,
  location: z.object({ name: z.string() }),
  status: z.enum(saleStatuses),
  currencyCode: z.string(),
  total: refundAmount,

  items: z.array(
    z.object({
      id: saleId,
      productName: z.string(),
      quantity: z.number().int().positive(),
      lineNetTotal: refundAmount,
      lineTaxTotal: refundAmount,
      costTotal: refundAmount.nullable(),
    })
  ),

  payments: z.array(
    z.object({
      id: saleId,
      paymentMethodName: z.string(),
      amount: refundAmount,
      requiresReference: z.boolean(),
      affectsCash: z.boolean(),
    })
  ),
});

export const refundInput = z
  .object({
    cashSessionId: saleId,
    reason: z.string().trim().min(5).max(500),

    items: z
      .array(
        z
          .object({
            saleItemId: saleId,
            quantity: z.number().int().positive().max(65535),
            restoreInventory: z.boolean(),
          })
          .strict()
      )
      .min(1)
      .max(100),

    payments: z
      .array(
        z
          .object({
            salePaymentId: saleId,
            amount: refundPaymentAmount,
            reference: nullableText(120),
            notes: nullableText(500),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((input, ctx) => {
    for (const field of ["items", "payments"] as const) {
      const ids = input[field].map((row) =>
        "saleItemId" in row ? row.saleItemId : row.salePaymentId
      );

      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "No se permiten registros repetidos.",
        });
      }
    }
  });

export type Refund = z.infer<typeof refundSchema>;
export type RefundSale = z.infer<typeof refundSaleSchema>;
export type RefundInput = z.infer<typeof refundInput>;

export type RefundItemDraft = {
  saleItemId: string;
  quantity: string;
  restoreInventory: boolean;
};

export type RefundPaymentDraft = {
  salePaymentId: string;
  amount: string;
  reference: string;
  notes: string;
};
