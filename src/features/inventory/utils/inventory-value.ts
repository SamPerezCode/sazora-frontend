import type { z } from "zod";
import type { baseUnitSchema } from "../schemas/inventory.schema";
import type { Balance } from "../schemas/inventory-location.schema";
import { formatQuantity } from "./inventory-format";

export type Unit = z.infer<typeof baseUnitSchema>;

const symbols: Record<Unit, [string, string]> = {
  UNIT: ["unidad", "unidades"],
  GRAM: ["g", "g"],
  KILOGRAM: ["kg", "kg"],
  MILLILITER: ["ml", "ml"],
  LITER: ["L", "L"],
  PORTION: ["porción", "porciones"],
  PACKAGE: ["paquete", "paquetes"],
};

const SCALE = 1_000_000n;

export function fixed(value: string): bigint {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("Decimal inválido.");
  }

  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (
    negative ? value.slice(1) : value
  ).split(".");

  const result =
    BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));

  return negative ? -result : result;
}

export function decimal(value: bigint): string {
  const absolute = value < 0n ? -value : value;

  return (
    (value < 0n ? "-" : "") +
    absolute / SCALE +
    "." +
    String(absolute % SCALE).padStart(6, "0")
  );
}

function round(n: bigint, d: bigint): bigint {
  const sign = n < 0n !== d < 0n ? -1n : 1n;
  const a = n < 0n ? -n : n;
  const b = d < 0n ? -d : d;

  if (!b) {
    throw new Error("No se puede dividir entre cero.");
  }

  return sign * ((a + b / 2n) / b);
}

export const add = (...values: string[]) =>
  decimal(values.reduce((a, b) => a + fixed(b), 0n));

export const multiply = (a: string, b: string) =>
  decimal(round(fixed(a) * fixed(b), SCALE));

export const divide = (a: string, b: string) =>
  decimal(round(fixed(a) * SCALE, fixed(b)));

export const subtract = (a: string, b: string) =>
  decimal(fixed(a) - fixed(b));

export const quantity3 = (value: string) =>
  decimal(round(fixed(value), 1000n) * 1000n).slice(0, -3);

export const baseQuantity = (a: string, b: string) =>
  decimal(round(fixed(a) * fixed(b), 1_000_000_000n) * 1000n).slice(
    0,
    -3
  );

export const unit = (base: Unit, value = "1") =>
  symbols[base][fixed(value) === SCALE ? 0 : 1];

export const quantity = (value: string, base: Unit) =>
  formatQuantity(value) + " " + unit(base, value);

export function money(
  value: string | null,
  currency = "COP"
): string {
  if (value === null) return "—";

  const n = fixed(value);
  const cents = round(n < 0n ? -n : n, 10_000n);

  const parts = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(cents / 100n);

  return (
    (n < 0n ? "-" : "") +
    parts
      .map((part) =>
        part.type === "fraction"
          ? String(cents % 100n).padStart(2, "0")
          : part.value
      )
      .join("")
  );
}

export const cost = (
  value: string | null,
  base: Unit,
  currency: string
) =>
  value === null ? "—" : money(value, currency) + "/" + unit(base);

export const unvalued = (balance: Balance) =>
  balance.valuationStatus === "UNVALUED" &&
  fixed(balance.currentStock) !== 0n;

export const canValue = (balance: Balance) =>
  balance.migratedFromLegacy &&
  unvalued(balance) &&
  fixed(balance.currentStock) > 0n;

const physicalLabels: Record<Balance["stockStatus"], string> = {
  AVAILABLE: "Disponible",
  LOW_STOCK: "Bajo mínimo",
  OUT_OF_STOCK: "Agotado",
};

export function physical(
  balance: Pick<Balance, "currentStock" | "stockStatus">
): string {
  if (fixed(balance.currentStock) < 0n) {
    return "Saldo negativo";
  }

  return physicalLabels[balance.stockStatus];
}

export function aggregate(rows: Balance[]) {
  const currentStock = add(...rows.map((b) => b.currentStock));
  const minimumStock = add(...rows.map((b) => b.minimumStock));
  const inventoryValue = add(
    ...rows.map((b) => b.inventoryValue ?? "0")
  );

  const hasUnvalued = rows.some(unvalued);

  const complete = rows.every(
    (b) => fixed(b.currentStock) === 0n || b.inventoryValue !== null
  );

  const averageUnitCost =
    !hasUnvalued && complete && fixed(currentStock) > 0n
      ? divide(inventoryValue, currentStock)
      : null;

  const stockStatus =
    fixed(currentStock) <= 0n
      ? "OUT_OF_STOCK"
      : fixed(currentStock) < fixed(minimumStock)
        ? "LOW_STOCK"
        : "AVAILABLE";

  return {
    currentStock,
    minimumStock,
    inventoryValue,
    averageUnitCost,
    hasUnvalued,
    complete,
    stockStatus: stockStatus as Balance["stockStatus"],
    problems: rows.filter(
      (b) =>
        b.stockStatus !== "AVAILABLE" ||
        fixed(b.currentStock) < 0n ||
        unvalued(b)
    ).length,
  };
}
