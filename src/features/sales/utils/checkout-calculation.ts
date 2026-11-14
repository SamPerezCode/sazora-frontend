import type { PaymentMethod } from "../../payment-methods/schemas/payment-method.schema";
import { cashCents } from "../../cash/utils/cash-format";
import {
  paymentAmount,
  type PaymentDraft,
  type CheckoutInput,
} from "../schemas/checkout.schema";

export function newPayment(): PaymentDraft {
  return {
    key: crypto.randomUUID(),
    paymentMethodId: "",
    amount: "",
    tenderedAmount: "",
    reference: "",
    notes: "",
  };
}

export function decimal(value: bigint): string {
  return (
    (value / 100n).toString() +
    "." +
    (value % 100n).toString().padStart(2, "0")
  );
}

export function calculateCheckout(
  drafts: PaymentDraft[],
  methods: PaymentMethod[],
  total: string
) {
  let paid = 0n;
  let change = 0n;
  let error = "";

  const payments: CheckoutInput["payments"] = [];

  for (const draft of drafts) {
    const method = methods.find(
      (row) => row.id === draft.paymentMethodId && row.isActive
    );

    const parsed = paymentAmount.safeParse(draft.amount);

    if (parsed.success) {
      paid += cashCents(parsed.data);
    }

    if (!method || !parsed.success) {
      error ||=
        "Selecciona la forma de pago e ingresa un valor válido en cada pago.";
      continue;
    }

    const tendered =
      method.paymentType === "CASH"
        ? paymentAmount.safeParse(draft.tenderedAmount)
        : parsed;

    if (!tendered.success) {
      error ||= "Ingresa el efectivo entregado por el cliente.";
      continue;
    }

    const difference =
      cashCents(tendered.data) - cashCents(parsed.data);

    if (difference < 0n) {
      error ||=
        "El efectivo entregado es inferior al valor aplicado.";
    }

    if (!method.allowsChange && difference > 0n) {
      error ||=
        "La forma de pago seleccionada no permite devolver cambio.";
    }

    if (difference > 0n && method.allowsChange) {
      change += difference;
    }

    if (method.requiresReference && !draft.reference.trim()) {
      error ||= "Completa la referencia obligatoria.";
    }

    if (
      draft.reference.trim().length > 120 ||
      draft.notes.trim().length > 500
    ) {
      error ||= "Revisa la longitud de la referencia y las notas.";
    }

    payments.push({
      paymentMethodId: method.id,
      amount: decimal(cashCents(parsed.data)),
      ...(method.paymentType === "CASH"
        ? { tenderedAmount: decimal(cashCents(tendered.data)) }
        : {}),
      reference: draft.reference.trim() || null,
      notes: draft.notes.trim() || null,
    });
  }

  const remaining = cashCents(total) - paid;

  if (!drafts.length || drafts.length > 20) {
    error ||= "Registra entre 1 y 20 pagos.";
  }

  if (remaining > 0n) {
    error ||= "Todavía hay un saldo pendiente por pagar.";
  }

  if (remaining < 0n) {
    error ||= "Los valores aplicados superan el total de la cuenta.";
  }

  return {
    paid,
    change,
    remaining,
    error,
    payments,
    valid: !error,
  };
}
