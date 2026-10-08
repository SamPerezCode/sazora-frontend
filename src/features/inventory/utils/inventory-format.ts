export const itemTypeLabels = {
  RAW_MATERIAL: "Materia prima",
  SEMI_FINISHED: "Semielaborado",
  FINISHED_GOOD: "Producto terminado",
  RESALE_GOOD: "Producto de reventa",
};

export const unitLabels = {
  UNIT: "Unidad",
  GRAM: "Gramo",
  KILOGRAM: "Kilogramo",
  MILLILITER: "Mililitro",
  LITER: "Litro",
  PORTION: "Porción",
  PACKAGE: "Paquete",
};

export const stockLabels = {
  OUT_OF_STOCK: "Agotado",
  LOW_STOCK: "Bajo mínimo",
  AVAILABLE: "Disponible",
};

// Presentación decimal sin convertir existencias a Number.
export function formatQuantity(value: string): string {
  const negative = value.startsWith("-");

  const [rawInteger, rawFraction = ""] = (
    negative ? value.slice(1) : value
  ).split(".");

  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  const fraction = rawFraction.replace(/0+$/, "");

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const sign =
    negative && /[1-9]/.test(integer + fraction) ? "-" : "";

  return sign + grouped + (fraction ? "," + fraction : "");
}

export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function validTimeZone(value?: string): string | null {
  if (!value) return null;

  try {
    new Intl.DateTimeFormat("es-CO", {
      timeZone: value,
    }).format();

    return value;
  } catch {
    return null;
  }
}

export function dayKey(
  value: string | number,
  timeZone: string
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
