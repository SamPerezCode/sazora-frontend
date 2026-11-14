import { money } from "../../../lib/money";

export function cashCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(value);

  if (!match) throw new Error("Importe inválido.");

  const fraction = (match[3] ?? "").replace(/0+$/, "");

  if (fraction.length > 2) {
    throw new Error(
      "El importe no puede representarse en centavos sin redondear."
    );
  }

  const result =
    BigInt(match[2]) * 100n + BigInt(fraction.padEnd(2, "0"));

  return match[1] ? -result : result;
}

export function cashMoney(
  value: string | bigint | null,
  currency: string
): string {
  if (value === null) return "—";

  if (typeof value === "bigint") {
    return (
      (value < 0n ? "−" : "") +
      money(value < 0n ? -value : value, currency)
    );
  }

  const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(value);

  if (!match) throw new Error("Importe inválido.");

  const fraction = (match[3] ?? "").replace(/0+$/, "");

  const symbol =
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  return (
    (match[1] ? "−" : "") +
    symbol +
    " " +
    new Intl.NumberFormat("es-CO").format(BigInt(match[2])) +
    (fraction ? "," + fraction : "")
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
