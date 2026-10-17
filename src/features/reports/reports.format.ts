import type { ReportFilters } from "./reports.schema";

export const serviceLabels = {
  TABLE: "Mesa",
  TAKEAWAY: "Para recoger",
  DELIVERY: "Domicilio",
};

export const modeLabels = {
  PRINT_ONLY: "Solo comandas impresas",
  PRINT_AND_SCREEN: "Comandas impresas y pantalla",
};

export const eventLabels = {
  FULL_ITEM: "Producto completo",
  PARTIAL_QUANTITY: "Cantidad parcial",
};

export const statusLabels = {
  OPEN: "Abierta",
  CONFIRMED: "Confirmada",
  DELIVERED: "Entregada",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const number = (value: number | string) =>
  new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 3,
  }).format(Number(value));

export const minutes = (value: number | null) =>
  value === null
    ? "Sin datos suficientes"
    : new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 1,
      }).format(value) + " min";

// Conserva la precisión del importe decimal.
export function amount(value: string, currency: string) {
  const [whole, fraction = ""] = value.split(".");
  const digits = /[1-9]/.test(fraction) ? fraction.length : 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .formatToParts(BigInt(whole))
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}

export function dateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function today(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}

export type DateShortcut = "today" | "week" | "month" | "previous";

export function dateRange(timezone: string, shortcut: DateShortcut) {
  const end = today(timezone);
  const [year, month, day] = end.split("-").map(Number);

  const iso = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

  if (shortcut === "today") {
    return { from: end, to: end };
  }

  if (shortcut === "week") {
    return {
      from: iso(year, month, day - 6),
      to: end,
    };
  }

  if (shortcut === "previous") {
    return {
      from: iso(year, month - 1, 1),
      to: iso(year, month, 0),
    };
  }

  return {
    from: iso(year, month, 1),
    to: end,
  };
}

export function initialFilters(timezone: string): ReportFilters {
  return {
    ...dateRange(timezone, "month"),
    serviceType: "",
    openedByMembershipId: "",
    cancelledByMembershipId: "",
    eventType: "",
    preparationAreaId: "",
    workflowMode: "",
  };
}
