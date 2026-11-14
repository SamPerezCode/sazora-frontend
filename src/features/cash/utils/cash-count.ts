import { cashCents } from "./cash-format";
import type { Reconciliation } from "../schemas/cash.schema";

export type CashCountDraft = {
  counted: string;
  notes: string;
};

export function cashSum(...values: string[]): string {
  const total = values.reduce((sum, value) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");

    const amount =
      BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));

    return sum + (negative ? -amount : amount);
  }, 0n);

  const absolute = total < 0n ? -total : total;

  return (
    (total < 0n ? "-" : "") +
    absolute / 1000000n +
    "." +
    (absolute % 1000000n).toString().padStart(6, "0")
  );
}

export function countPreview(counted: string, expected: string) {
  try {
    const balance = cashCents(expected);

    if (balance < 0n) {
      return {
        difference: null,
        error:
          "El efectivo esperado es negativo. Revisa la conciliación antes de cerrar.",
      };
    }

    return {
      difference: cashCents(counted) - balance,
      error: "",
    };
  } catch {
    return {
      difference: null,
      error:
        "El saldo recibido no puede expresarse en centavos. Revisa la conciliación antes de cerrar.",
    };
  }
}

export function differenceKind(value: string | bigint | null) {
  if (value === null) return "unknown";

  const negative =
    typeof value === "bigint"
      ? value < 0n
      : value.startsWith("-") && /[1-9]/.test(value);

  const zero =
    typeof value === "bigint" ? value === 0n : !/[1-9]/.test(value);

  return zero ? "exact" : negative ? "short" : "over";
}

export function closeSnapshot(data: Reconciliation) {
  return JSON.stringify({
    session: data.cashSession,
    movements: data.movements,
    commercial: data.commercial,
    payments: [...data.paymentMethods].sort((a, b) =>
      a.paymentMethodCode.localeCompare(b.paymentMethodCode)
    ),
  });
}

export function centsDecimal(value: bigint): string {
  const absolute = value < 0n ? -value : value;

  return (
    (value < 0n ? "-" : "") +
    absolute / 100n +
    "." +
    (absolute % 100n).toString().padStart(2, "0")
  );
}
