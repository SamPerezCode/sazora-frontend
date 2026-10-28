import { ApiError } from "../../../lib/http/client";
import { z } from "zod";
import { money, add, multiply, divide, subtract } from "../utils/inventory-value";
import { dayKey, formatQuantity } from "../utils/inventory-format";
import type { Order } from "./production.contracts";
import type { OrderResources } from "./production.api";

export const cash = (value: string | null, currency: string) => value === null ? "Sin valoración" : money(value, currency);
export const percentage = (value: string | null) => value === null ? "—" : formatQuantity(value) + " %";
export const timestamp = (value: string | null, zone: string) => value === null ? "Pendiente" :
  new Intl.DateTimeFormat("es-CO", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export function errorText(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map(issue => issue.path.join(".") + ": " + issue.message).join("\n");
  if (error instanceof ApiError) return error.message + (error.errors.length ? "\n" + error.errors.map(e => e.field + ": " + e.message).join("\n") : "");
  return error instanceof Error ? error.message : "No fue posible completar la operación.";
}
// Convierte una fecha del negocio a medianoche en su zona, nunca en la del navegador.
export function plannedISO(day: string, zone: string, original: string | null) {
  if (!day) return null;
  if (original && dayKey(original, zone) === day) return original;
  z.iso.date().parse(day);
  const target = Date.parse(day + "T00:00:00Z");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let guess = target;
  const localTime = (value: number) => {
    const p = formatter.formatToParts(value);
    const part = (type: string) => p.find(item => item.type === type)!.value;
    return Date.parse(part("year") + "-" + part("month") + "-" + part("day") +
      "T" + part("hour") + ":" + part("minute") + ":" + part("second") + "Z");
  };
  for (let i = 0; i < 4; i++) guess += target - localTime(guess);
  if (localTime(guess) !== target) throw new Error("No se pudo representar esa fecha en la zona del negocio.");
  return new Date(guess).toISOString();
}
export function estimate(order: Order, balances: OrderResources["balances"], actual: Record<string, string>) {
  const inputs = order.inputs.map(line => {
    const balance = balances?.find(b => b.inventoryItemId === line.inventoryItemId);
    const rate = balance?.valuationStatus === "VALUED" ? balance.averageUnitCost : null;
    return {
      id: line.inventoryItemId,
      expected: rate == null ? null : multiply(line.plannedQuantity, rate),
      actual: rate == null ? null : multiply(actual[line.inventoryItemId], rate),
    };
  });
  const sum = (values: (string | null)[]) => values.some(v => v === null) ? null :
    values.reduce<string>((total, value) => add(total, value!), "0");
  const expected = sum(inputs.map(line => line.expected));
  const total = sum(inputs.map(line => line.actual));
  let allocated = "0";
  const outputs = order.outputs.map((line, index) => {
    const value = total === null ? null : index === order.outputs.length - 1
      ? subtract(total, allocated) : divide(multiply(total, line.costAllocationPercentage), "100");
    if (value !== null) allocated = add(allocated, value);
    return { id: line.inventoryItemId, value,
      unitCost: value === null ? null : divide(value, actual[line.inventoryItemId]) };
  });
  return { inputs, outputs, expected, total,
    difference: total === null || expected === null ? null : subtract(total, expected) };
}
