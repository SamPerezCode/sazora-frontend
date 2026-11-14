import { money } from "../../../lib/money";

export function cashCents(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, decimal = ""] = value.replace(/^-/, "").split(".");

  const amount =
    BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));

  return negative ? -amount : amount;
}

export function cashMoney(
  value: string | bigint | null,
  currency: string
): string {
  if (value === null) return "—";

  const amount = typeof value === "bigint" ? value : cashCents(value);

  return (
    (amount < 0n ? "−" : "") +
    money(amount < 0n ? -amount : amount, currency)
  );
}

export function cashDate(
  value: string | null,
  timeZone: string
): string {
  return value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : "—";
}
