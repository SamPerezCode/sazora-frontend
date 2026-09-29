import type {
  DashboardOrder,
  InventoryItem,
  WeeklySale,
} from "../types/dashboard.types";

export function money(value: string, currency: string): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function quantity(value: number | string): string {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

export function businessDate(date: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function variation(value: string | null): string {
  if (value === null) {
    return "Sin base de comparación con ayer";
  }

  const percentage = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(Number(value));

  return `${percentage}% vs. ayer`;
}

// Suma decimal exacta para evitar errores acumulados en los importes.
export function sumAmounts(values: readonly string[]): string {
  const scale = Math.max(
    0,
    ...values.map((value) => value.split(".")[1]?.length ?? 0)
  );

  const sum = values.reduce((total, value) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    const units = BigInt(whole + fraction.padEnd(scale, "0"));

    return total + (negative ? -units : units);
  }, 0n);

  if (scale === 0) return sum.toString();

  const digits = (sum < 0n ? -sum : sum)
    .toString()
    .padStart(scale + 1, "0");

  return `${sum < 0n ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export const WEEKDAYS: Record<WeeklySale["weekday"], string> = {
  MONDAY: "Lun",
  TUESDAY: "Mar",
  WEDNESDAY: "Mié",
  THURSDAY: "Jue",
  FRIDAY: "Vie",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

export const ORDER_STATUS: Record<DashboardOrder["status"], string> =
  {
    OPEN: "Abierta",
    CONFIRMED: "Confirmada",
    DELIVERED: "Entregada",
    CLOSED: "Cerrada",
    CANCELLED: "Cancelada",
  };

export const SERVICE_TYPE: Record<
  DashboardOrder["serviceType"],
  string
> = {
  TABLE: "Salón",
  TAKEAWAY: "Para llevar",
  DELIVERY: "Domicilio",
};

export const UNITS: Record<InventoryItem["baseUnit"], string> = {
  UNIT: "und",
  GRAM: "g",
  KILOGRAM: "kg",
  MILLILITER: "ml",
  LITER: "l",
  PORTION: "porciones",
  PACKAGE: "paquetes",
};
