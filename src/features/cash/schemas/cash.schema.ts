import { z } from "zod";

export const cashId = z.string().regex(/^[1-9]\d*$/);

const money = z.string().regex(/^-?\d+(?:\.\d{1,2})?$/);
const date = z.iso.datetime({ offset: true });

const employee = z.object({
  membershipId: cashId,
  fullName: z.string(),
});

export const cashLocationSchema = z.object({
  id: cashId,
  code: z.string(),
  name: z.string(),
  isSalesLocation: z.boolean(),
  isActive: z.boolean(),
});

export const cashRegisterSchema = z.object({
  id: cashId,
  businessId: cashId,
  locationId: cashId,
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  location: cashLocationSchema,
});

export const cashSessionSchema = z.object({
  id: cashId,
  businessId: cashId,
  cashRegisterId: cashId,
  status: z.enum(["OPEN", "CLOSED"]),
  currencyCode: z.string(),
  openedBy: employee,
  closedBy: employee.nullable(),
  openingCashAmount: money,
  expectedCashAmount: money.nullable(),
  countedCashAmount: money.nullable(),
  differenceAmount: money.nullable(),
  openingNotes: z.string().nullable(),
  closingNotes: z.string().nullable(),
  openedAt: date,
  closedAt: date.nullable(),
  cashRegister: cashRegisterSchema,
});

export const movementLabels = {
  MANUAL_INCOME: "Ingreso manual",
  WITHDRAWAL: "Retiro",
  EXPENSE: "Gasto",
  CASH_SALE: "Venta en efectivo",
  CASH_REFUND: "Reembolso en efectivo",
  ADJUSTMENT_IN: "Ajuste de entrada",
  ADJUSTMENT_OUT: "Ajuste de salida",
} as const;

export const cashMovementSchema = z.object({
  id: cashId,
  businessId: cashId,
  cashSessionId: cashId,
  movementType: z.enum(
    Object.keys(movementLabels) as [
      keyof typeof movementLabels,
      ...(keyof typeof movementLabels)[],
    ]
  ),
  direction: z.enum(["IN", "OUT"]),
  amount: money,
  reason: z.string(),
  reference: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  occurredAt: date,
  recordedBy: employee,
});

export const reconciliationSchema = z.object({
  cashSession: cashSessionSchema,

  movements: z.object({
    openingCashAmount: money,
    manualIncomeAmount: money,
    cashSaleAmount: money,
    withdrawalAmount: money,
    expenseAmount: money,
    cashRefundAmount: money,
    adjustmentInAmount: money,
    adjustmentOutAmount: money,
    movementNetAmount: money,
    calculatedExpectedCashAmount: money,
  }),

  commercial: z.object({
    grossSaleCount: z.number().int().nonnegative(),
    voidedSaleCount: z.number().int().nonnegative(),
    refundCount: z.number().int().nonnegative(),
    grossSaleAmount: money,
    voidedSaleAmount: money,
    refundedAmount: money,
    netCommercialAmount: money,
  }),

  paymentMethods: z.array(
    z.object({
      paymentMethodCode: z.string(),
      paymentMethodName: z.string(),
      paymentType: z.string(),
      receivedAmount: money,
      voidedAmount: money,
      refundedAmount: money,
      netAmount: money,
    })
  ),
});

export const cashAmountInput = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/,
    "Usa un valor no negativo, sin separadores de miles y con máximo dos decimales."
  );

const notes = z
  .string()
  .trim()
  .max(500)
  .transform((value) => value || null);

export const createRegisterInput = z.object({
  locationId: cashId,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(30)
    .regex(
      /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
      "Usa letras, números y guiones."
    ),
  name: z.string().trim().min(1).max(120),
});

export const openSessionInput = z.object({
  cashRegisterId: cashId,
  openingCashAmount: cashAmountInput,
  openingNotes: notes,
});

export const closeSessionInput = z.object({
  countedCashAmount: cashAmountInput,
  closingNotes: notes,
});

export const manualMovementInput = z.object({
  cashSessionId: cashId,
  movementType: z.enum(["MANUAL_INCOME", "WITHDRAWAL", "EXPENSE"]),
  amount: cashAmountInput.refine(
    (value) => /[1-9]/.test(value),
    "Debe ser mayor que cero."
  ),
  reason: z
    .string()
    .trim()
    .min(1, "El motivo es obligatorio.")
    .max(500),
  reference: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null),
});

export type CashLocation = z.infer<typeof cashLocationSchema>;
export type CashRegister = z.infer<typeof cashRegisterSchema>;
export type CashSession = z.infer<typeof cashSessionSchema>;
export type CashMovement = z.infer<typeof cashMovementSchema>;
export type Reconciliation = z.infer<typeof reconciliationSchema>;
