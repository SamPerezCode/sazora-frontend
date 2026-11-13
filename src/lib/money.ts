

export function cents(value: string): bigint {
  const [whole, decimals = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"));
}

export function money(
  value: string | bigint,
  currency?: string
): string {
  const amount = typeof value === "bigint" ? value : cents(value);
  const whole = amount / 100n;
  const decimals = String(amount % 100n).padStart(2, "0");

  const formatted =
    new Intl.NumberFormat("es-CO").format(whole) +
    (decimals === "00" ? "" : "," + decimals);

  if (!currency) return formatted;

  const symbol = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;

  return (symbol ?? currency) + " " + formatted;
}
