import { z } from "zod";
import { orderSchema } from "./sales.schema";
import { saleDetailSchema, saleId } from "./financial-sales.schema";

export const paymentAmount = z
  .string()
  .trim()
  .regex(
    /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/,
    "Ingresa un valor positivo, sin separadores de miles y con máximo dos decimales."
  );

const text = (max: number) => z.string().trim().max(max).nullable();

export const checkoutInput = z
  .object({
    orderId: saleId,
    cashSessionId: saleId,
    payments: z
      .array(
        z
          .object({
            paymentMethodId: saleId,
            amount: paymentAmount,
            tenderedAmount: paymentAmount.optional(),
            reference: text(120),
            notes: text(500),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

export const checkoutOrder = orderSchema.extend({
  total: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});

export const checkoutSale = saleDetailSchema.extend({
  changeTotal: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});

export type CheckoutInput = z.infer<typeof checkoutInput>;
export type CheckoutSale = z.infer<typeof checkoutSale>;
export type CheckoutOrder = z.infer<typeof checkoutOrder>;

export type PaymentDraft = {
  key: string;
  paymentMethodId: string;
  amount: string;
  tenderedAmount: string;
  reference: string;
  notes: string;
};
