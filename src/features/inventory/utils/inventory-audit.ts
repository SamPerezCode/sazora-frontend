import {
  add,
  fixed,
  decimal,
  multiply,
  divide,
  subtract,
  unvalued,
} from "./inventory-value";
import type { ProductionInput } from "../schemas/inventory-audit.schema";
import type { InventoryWorkspace } from "../services/inventory-location.service";

export const movementLabels = {
  OPENING: "Existencia inicial",
  PURCHASE: "Compra",
  PRODUCTION: "Producción",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste",
  WASTE: "Desperdicio",
  RETURN: "Devolución",
  REVERSAL: "Reversión",
};

export function estimateProduction(
  input: ProductionInput,
  data: InventoryWorkspace
) {
  if (
    !data.locations.some(
      (location) => location.id === input.locationId
    )
  ) {
    throw new Error("Selecciona una ubicación activa.");
  }

  const lines = [...input.inputs, ...input.outputs];

  if (
    lines.some(
      (line) =>
        !data.items.some(
          (item) => item.id === line.inventoryItemId && item.isActive
        )
    )
  ) {
    throw new Error("Selecciona artículos activos.");
  }

  const balance = (itemId: string) =>
    data.balances.find(
      (entry) =>
        entry.inventoryItemId === itemId &&
        entry.location.id === input.locationId
    );

  const inputs = input.inputs.map((line) => {
    const current = balance(line.inventoryItemId);
    const name = data.items.find(
      (item) => item.id === line.inventoryItemId
    )!.name;

    if (
      !current ||
      fixed(current.currentStock) < fixed(line.quantity)
    ) {
      throw new Error("Existencia insuficiente: " + name);
    }

    if (
      unvalued(current) ||
      current.averageUnitCost === null ||
      current.inventoryValue === null
    ) {
      throw new Error("Valora primero el insumo: " + name);
    }

    return {
      ...line,
      value:
        fixed(line.quantity) === fixed(current.currentStock)
          ? current.inventoryValue
          : multiply(line.quantity, current.averageUnitCost),
    };
  });

  const total = add(...inputs.map((line) => line.value));
  let assigned = "0";

  const outputs = input.outputs.map((line, index) => {
    const current = balance(line.inventoryItemId);

    if (
      current &&
      (unvalued(current) || fixed(current.currentStock) < 0n)
    ) {
      throw new Error(
        "El resultado tiene un saldo negativo o sin valorar."
      );
    }

    const value =
      index === input.outputs.length - 1
        ? subtract(total, assigned)
        : decimal(
            (fixed(total) * fixed(line.costAllocationPercentage) +
              50_000_000n) /
              100_000_000n
          );

    assigned = add(assigned, value);

    return {
      ...line,
      value,
      unitCost: divide(value, line.quantity),
    };
  });

  return { inputs, outputs, total };
}
