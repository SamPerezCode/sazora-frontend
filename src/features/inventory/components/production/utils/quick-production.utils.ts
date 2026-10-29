import { add, quantity } from "../../../utils/inventory-value";

import type {
  QuickProduction,
  QuickProductionLine,
} from "../schemas/quick-production.schemas";

export function quickDate(value: string, zone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function quickLineText(line: QuickProductionLine) {
  return (
    line.inventoryItemName +
    " · " +
    quantity(line.quantity, line.baseUnit)
  );
}

export function quickCost(
  production: QuickProduction
): string | null {
  const inputs = production.lines.filter(
    (line) => line.direction === "OUT"
  );

  if (
    !inputs.length ||
    inputs.some(
      (line) =>
        line.costStatus !== "VALUED" || line.totalCost === null
    )
  ) {
    return null;
  }

  return add(...inputs.map((line) => line.totalCost!));
}
