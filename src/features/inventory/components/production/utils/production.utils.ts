import { z } from "zod";
import { ApiError } from "../../../../../lib/http/client";
import {
  money,
  cost as formatCost,
  unit,
  multiply,
  add,
  subtract,
  divide,
} from "../../../utils/inventory-value";
import { formatQuantity, dayKey } from "../../../utils/inventory-format";
import type {
  Status,
  Action,
  Order,
  OrderResources,
  QuickLine,
} from "../types/production.types";

export const statusLabels: Record<Status, string> = {
  DRAFT: "Borrador",
  PLANNED: "Planificada",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const actionLabels: Record<Action, string> = {
  detail: "Ver detalle",
  edit: "Editar",
  plan: "Planificar",
  start: "Iniciar",
  cancel: "Cancelar orden",
  complete: "Completar producción",
  waste: "Registrar desperdicio",
  performance: "Ver rendimiento",
  movement: "Ver movimiento valorizado",
};

export function cash(value: string | null, currency: string) {
  if (value === null) return "Sin valoración";
  return currency ? money(value, currency) : formatQuantity(value);
}

export function cost(
  value: string | null,
  base: Parameters<typeof formatCost>[1],
  currency: string
) {
  if (currency) return formatCost(value, base, currency);

  return value === null
    ? "Sin valoración"
    : formatQuantity(value) + "/" + unit(base);
}

export function percentage(value: string | null) {
  return value === null ? "—" : formatQuantity(value) + " %";
}

export function timestamp(value: string | null, zone: string) {
  if (value === null) return "Pendiente";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function errorText(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => issue.path.join(".") + ": " + issue.message)
      .join("\n");
  }

  if (error instanceof ApiError) {
    return (
      error.message +
      (error.errors.length
        ? "\n" +
          error.errors
            .map((item) => item.field + ": " + item.message)
            .join("\n")
        : "")
    );
  }

  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación.";
}

export function plannedISO(
  day: string,
  zone: string,
  original: string | null
) {
  if (!day) return null;
  if (original && dayKey(original, zone) === day) return original;

  z.iso.date().parse(day);

  const target = Date.parse(day + "T00:00:00Z");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const localTime = (value: number) => {
    const parts = formatter.formatToParts(value);
    const part = (type: string) =>
      parts.find((item) => item.type === type)!.value;

    return Date.parse(
      part("year") +
        "-" +
        part("month") +
        "-" +
        part("day") +
        "T" +
        part("hour") +
        ":" +
        part("minute") +
        ":" +
        part("second") +
        "Z"
    );
  };

  let guess = target;

  for (let index = 0; index < 4; index++) {
    guess += target - localTime(guess);
  }

  if (localTime(guess) !== target) {
    throw new Error(
      "No se pudo representar esa fecha en la zona del negocio."
    );
  }

  return new Date(guess).toISOString();
}

export function estimate(
  order: Order,
  balances: OrderResources["balances"],
  actual: Record<string, string>
) {
  const inputs = order.inputs.map((line) => {
    const balance = balances?.find(
      (row) => row.inventoryItemId === line.inventoryItemId
    );
    const rate =
      balance?.valuationStatus === "VALUED"
        ? balance.averageUnitCost
        : null;

    return {
      id: line.inventoryItemId,
      expected:
        rate == null ? null : multiply(line.plannedQuantity, rate),
      actual:
        rate == null
          ? null
          : multiply(actual[line.inventoryItemId], rate),
    };
  });

  const sum = (values: (string | null)[]) =>
    values.some((value) => value === null)
      ? null
      : values.reduce<string>(
          (total, value) => add(total, value!),
          "0"
        );

  const expected = sum(inputs.map((line) => line.expected));
  const total = sum(inputs.map((line) => line.actual));
  let allocated = "0";

  const outputs = order.outputs.map((line, index) => {
    const value =
      total === null
        ? null
        : index === order.outputs.length - 1
          ? subtract(total, allocated)
          : divide(
              multiply(total, line.costAllocationPercentage),
              "100"
            );

    if (value !== null) allocated = add(allocated, value);

    return {
      id: line.inventoryItemId,
      value,
      unitCost:
        value === null
          ? null
          : divide(value, actual[line.inventoryItemId]),
    };
  });

  return {
    inputs,
    outputs,
    expected,
    total,
    difference:
      total === null || expected === null
        ? null
        : subtract(total, expected),
  };
}

export function emptyQuickLine(percentage = ""): QuickLine {
  return {
    key: crypto.randomUUID(),
    inventoryItemId: "",
    quantity: "",
    notes: "",
    costAllocationPercentage: percentage,
  };
}
