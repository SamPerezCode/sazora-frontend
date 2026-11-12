import { z } from "zod";

export const paymentTypes = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta / datáfono" },
  { value: "BANK_TRANSFER", label: "Transferencia bancaria" },
  { value: "DIGITAL_WALLET", label: "Billetera digital" },
  { value: "VOUCHER", label: "Bono" },
  { value: "STORE_CREDIT", label: "Crédito interno" },
  { value: "OTHER", label: "Otro" },
] as const;

export const paymentTypeSchema = z.enum([
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "DIGITAL_WALLET",
  "VOUCHER",
  "STORE_CREDIT",
  "OTHER",
]);

const idSchema = z.string().regex(/^[1-9]\d*$/);

export const paymentMethodSchema = z.object({
  id: idSchema,
  businessId: idSchema,
  code: z.string(),
  name: z.string(),
  paymentType: paymentTypeSchema,
  requiresReference: z.boolean(),
  affectsCash: z.boolean(),
  allowsChange: z.boolean(),
  displayOrder: z.number().int().min(0).max(65535),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paymentMethodFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "El código es obligatorio")
      .max(50, "Máximo 50 caracteres")
      .transform((value) => value.toUpperCase())
      .pipe(
        z
          .string()
          .regex(
            /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/,
            "Usa letras, números y guiones bajos"
          )
      ),
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(120, "Máximo 120 caracteres"),
    paymentType: paymentTypeSchema,
    requiresReference: z.boolean(),
    allowsChange: z.boolean(),
    displayOrder: z
      .string()
      .trim()
      .regex(/^\d+$/, "Ingresa un orden entero entre 0 y 65535")
      .transform(Number)
      .pipe(z.number().int().min(0).max(65535, "El máximo es 65535")),
  })
  .superRefine((value, context) => {
    if (value.allowsChange && value.paymentType !== "CASH") {
      context.addIssue({
        code: "custom",
        path: ["allowsChange"],
        message: "Solo los pagos en efectivo pueden devolver cambio.",
      });
    }
  });

export const paymentMethodsResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    paymentMethods: z.array(paymentMethodSchema),
  }),
});

export const paymentMethodResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    paymentMethod: paymentMethodSchema,
  }),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export type PaymentMethodDraft = z.input<
  typeof paymentMethodFormSchema
>;

export function paymentMethodDraft(
  method?: PaymentMethod
): PaymentMethodDraft {
  return {
    code: method?.code ?? "",
    name: method?.name ?? "",
    paymentType: method?.paymentType ?? "CASH",
    requiresReference: method?.requiresReference ?? false,
    allowsChange: method?.allowsChange ?? true,
    displayOrder: String(method?.displayOrder ?? 0),
  };
}
