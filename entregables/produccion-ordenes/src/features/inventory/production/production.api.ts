import { z } from "zod";
import type { AuthSession } from "../../auth/types/auth.types";
import { ApiError, request } from "../../../lib/http/client";
import { getLocations } from "../../business/services/organization.service";
import { loadBalances } from "../services/inventory-location.service";
import { movementDetail } from "../schemas/inventory-audit.schema";
import { id } from "../schemas/inventory-location.schema";
import { fixed } from "../utils/inventory-value";
import {
  orderSchema, orderSummarySchema, recipeSchema, recipeSummarySchema,
  performanceSchema, wasteSchema, reportSummarySchema, historySchema,
  editOrderSchema, completeOrderSchema, wasteInputSchema,
} from "./production.contracts";
import type { Order, Mutation } from "./production.contracts";
import { allowedActions, assertProduction, assignedPlant, isAdmin, plantScope, usablePlant } from "./production.access";

async function api<T>(session: AuthSession, signal: AbortSignal, path: string,
  schema: z.ZodType<T>, method: "GET" | "PUT" | "POST" | "PATCH" = "GET", body?: unknown) {
  assertProduction(session);
  const response = await request(path, z.object({ status: z.literal("success"), data: schema }), {
    accessToken: session.accessToken, signal, method, body, cache: "no-store",
  });
  return response.data;
}
function checkOrder<T extends { id: string; businessId: string; location: { id: string } }>(
  session: AuthSession, order: T, expectedId?: string
): T {
  if (order.businessId !== session.business.id || (expectedId && order.id !== expectedId))
    throw new ApiError(502, "INVALID_RESPONSE", "La orden recibida no corresponde a la consulta.");
  plantScope(session, order.location.id);
  return order;
}
export async function loadPlants(session: AuthSession, signal: AbortSignal) {
  assertProduction(session);
  if (!isAdmin(session)) return [assignedPlant(session)!];
  return (await getLocations(session, signal)).filter(usablePlant);
}
export async function listOrders(session: AuthSession, signal: AbortSignal, locationId: string) {
  const location = plantScope(session, locationId);
  const params = new URLSearchParams();
  if (location) params.set("locationId", id.parse(location));
  const result = await api(session, signal, "/production-orders" + (params.size ? "?" + params : ""),
    z.object({ productionOrders: z.array(orderSummarySchema) }));
  return result.productionOrders.map(order => checkOrder(session, order));
}
export async function getOrder(session: AuthSession, signal: AbortSignal, orderId: string) {
  const result = await api(session, signal, "/production-orders/" + id.parse(orderId),
    z.object({ productionOrder: orderSchema }));
  return checkOrder(session, result.productionOrder, orderId);
}
export async function getPerformance(session: AuthSession, signal: AbortSignal, order: Order) {
  const result = await api(session, signal, "/production-orders/" + order.id + "/performance",
    z.object({ performance: performanceSchema }));
  const value = result.performance;
  if (value.productionOrderId !== order.id || value.businessId !== session.business.id ||
      value.locationId !== order.location.id)
    throw new ApiError(502, "INVALID_RESPONSE", "El rendimiento no corresponde a la orden.");
  return value;
}
export async function orderResources(session: AuthSession, signal: AbortSignal, orderId: string) {
  const order = await getOrder(session, signal, orderId);
  const [performance, waste, balances] = await Promise.all([
    getPerformance(session, signal, order),
    api(session, signal, "/production-orders/" + order.id + "/waste",
      z.object({ wasteRecords: z.array(wasteSchema) })),
    isAdmin(session) ? loadBalances(session, signal, order.location.id) : Promise.resolve(null),
  ]);
  for (const record of waste.wasteRecords) {
    if (record.businessId !== session.business.id || record.productionOrderId !== order.id)
      throw new ApiError(502, "INVALID_RESPONSE", "El desperdicio no corresponde a la orden.");
  }
  return { order, performance, waste: waste.wasteRecords, balances };
}
export type OrderResources = Awaited<ReturnType<typeof orderResources>>;
export async function orderPage(session: AuthSession, signal: AbortSignal, ids: string[]) {
  const result: { order: Order; value: string | null }[] = [];
  for (let offset = 0; offset < ids.length; offset += 4) {
    signal.throwIfAborted();
    result.push(...await Promise.all(ids.slice(offset, offset + 4).map(async orderId => {
      const order = await getOrder(session, signal, orderId);
      const performance = order.status === "COMPLETED" ? await getPerformance(session, signal, order) : null;
      return { order, value: performance?.summary.producedInventoryValue ?? null };
    })));
  }
  return result;
}
export async function listRecipes(session: AuthSession, signal: AbortSignal) {
  const { recipes } = await api(session, signal, "/production-recipes",
    z.object({ recipes: z.array(recipeSummarySchema) }));
  if (recipes.some(recipe => recipe.businessId !== session.business.id))
    throw new ApiError(502, "INVALID_RESPONSE", "Las recetas no corresponden al negocio.");
  return recipes;
}
export async function getRecipe(session: AuthSession, signal: AbortSignal, recipeId: string) {
  const { recipe } = await api(session, signal, "/production-recipes/" + id.parse(recipeId),
    z.object({ recipe: recipeSchema }));
  if (recipe.businessId !== session.business.id || recipe.id !== recipeId)
    throw new ApiError(502, "INVALID_RESPONSE", "La receta no corresponde a la consulta.");
  return recipe;
}
export async function getOrderMovement(session: AuthSession, signal: AbortSignal, order: Order) {
  if (!order.inventoryMovementId) throw new Error("La orden todavía no tiene movimiento.");
  const { production } = await api(session, signal, "/production/" + id.parse(order.inventoryMovementId),
    z.object({ production: movementDetail }));
  if (production.id !== order.inventoryMovementId || production.businessId !== session.business.id ||
      production.location?.id !== order.location.id || production.movementType !== "PRODUCTION")
    throw new ApiError(502, "INVALID_RESPONSE", "El movimiento no corresponde a la orden.");
  return production;
}
export async function saveOrder(session: AuthSession, signal: AbortSignal, order: Order, mutation: Mutation) {
  if (!allowedActions(session, order).includes(mutation.action))
    throw new ApiError(403, "FORBIDDEN", "La acción no está permitida para esta orden.");
  if (mutation.payload.version !== order.version) throw new Error("Actualiza la versión de la orden.");
  const path = "/production-orders/" + id.parse(order.id);
  let result: { productionOrder: Order };
  const response = z.object({ productionOrder: orderSchema });
  switch (mutation.action) {
    case "edit":
      result = await api(session, signal, path, response, "PUT", editOrderSchema.parse(mutation.payload));
      break;
    case "plan":
    case "cancel":
      result = await api(session, signal, path + "/status", response, "PATCH", {
        version: order.version, status: mutation.action === "plan" ? "PLANNED" : "CANCELLED",
        cancellationReason: mutation.action === "cancel"
          ? z.string().trim().min(3).max(500).parse(mutation.payload.cancellationReason) : null,
      });
      break;
    case "start":
      result = await api(session, signal, path + "/start", response, "POST", { version: order.version });
      break;
    case "complete": {
      const body = completeOrderSchema.parse(mutation.payload);
      for (const group of ["inputs", "outputs"] as const) {
        const expected = new Set(order[group].map(line => line.inventoryItemId));
        if (body[group].length !== expected.size || body[group].some(line => !expected.has(line.inventoryItemId)))
          throw new Error("Los artículos deben coincidir exactamente con la orden.");
      }
      result = await api(session, signal, path + "/complete", response, "POST", body);
      break;
    }
    case "waste": {
      const body = wasteInputSchema.parse(mutation.payload);
      const expected = new Set([...order.inputs, ...order.outputs].map(line => line.inventoryItemId));
      if (body.lines.some(line => !expected.has(line.inventoryItemId)))
        throw new Error("Solo puedes registrar artículos de esta orden.");
      result = await api(session, signal, path + "/waste",
        response.extend({ wasteRecord: wasteSchema }), "POST", body);
      break;
    }
  }
  return checkOrder(session, result.productionOrder, order.id);
}
export async function loadPeriod(session: AuthSession, signal: AbortSignal, locationId: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to, dateField: "COMPLETED" });
  const location = plantScope(session, locationId);
  if (location) params.set("locationId", location);
  const summary = await api(session, signal, "/production-reports/summary?" + params,
    z.object({ report: reportSummarySchema }));
  params.set("pageSize", "100");
  const seen = new Set<string>();
  let count = 0, expected = -1, unavailable = false;
  for (let page = 1; ; page++) {
    signal.throwIfAborted();
    params.set("page", String(page));
    const { report } = await api(session, signal, "/production-reports/orders?" + params,
      z.object({ report: historySchema }));
    if (expected !== -1 && report.pagination.total !== expected)
      throw new Error("El período cambió durante la consulta. Actualiza.");
    expected = report.pagination.total;
    for (const row of report.orders) {
      plantScope(session, row.location.id);
      if (seen.has(row.productionOrderId)) throw new Error("El período cambió. Actualiza.");
      seen.add(row.productionOrderId);
      if (row.status === "COMPLETED") {
        if (row.inputCostDifference === null) unavailable = true;
        else if (fixed(row.inputCostDifference) !== 0n) count++;
      }
    }
    if (page >= report.pagination.totalPages) break;
    if (!report.orders.length) throw new Error("La consulta del período está incompleta.");
  }
  if (seen.size !== expected) throw new Error("La consulta del período está incompleta.");
  return { summary: summary.report.summary, variations: unavailable ? null : count };
}
