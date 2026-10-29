import { z } from "zod";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { ApiError } from "../../../../../lib/http/client";
import { id } from "../../../schemas/inventory-location.schema";
import { movementDetail } from "../../../schemas/inventory-audit.schema";
import { loadPlants, productionBalances } from "./production.catalog";
import { isAdmin, plantScope } from "../utils/production.access";
import { api, checkOrder } from "./production.api";
import {
  orderSummarySchema,
  orderSchema,
  performanceSchema,
  wasteSchema,
} from "../schemas/production.schemas";
import type { Order } from "../types/production.types";

export async function loadContext(
  session: AuthSession,
  signal: AbortSignal
) {
  const plants = await loadPlants(session, signal);

  if (isAdmin(session)) return { plants, zone: null };

  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    from: today,
    to: today,
    dateField: "COMPLETED",
    locationId: plantScope(session),
  });

  const { report } = await api(
    session,
    signal,
    "/production-reports/summary?" + params,
    z.object({
      report: z.object({
        period: z.object({ timezone: z.string() }),
      }),
    })
  );

  new Intl.DateTimeFormat("es-CO", {
    timeZone: report.period.timezone,
  });

  return { plants, zone: report.period.timezone };
}

export async function listOrders(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) {
  const location = plantScope(session, locationId);
  const params = new URLSearchParams();

  if (location) params.set("locationId", id.parse(location));

  const result = await api(
    session,
    signal,
    "/production-orders" + (params.size ? "?" + params : ""),
    z.object({
      productionOrders: z.array(orderSummarySchema),
    })
  );

  return result.productionOrders.map((order) =>
    checkOrder(session, order)
  );
}

export async function getOrder(
  session: AuthSession,
  signal: AbortSignal,
  orderId: string
) {
  const result = await api(
    session,
    signal,
    "/production-orders/" + id.parse(orderId),
    z.object({ productionOrder: orderSchema })
  );

  return checkOrder(session, result.productionOrder, orderId);
}

export async function getPerformance(
  session: AuthSession,
  signal: AbortSignal,
  order: Order
) {
  const result = await api(
    session,
    signal,
    "/production-orders/" + order.id + "/performance",
    z.object({ performance: performanceSchema })
  );

  const value = result.performance;

  if (
    value.productionOrderId !== order.id ||
    value.businessId !== session.business.id ||
    value.locationId !== order.location.id
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El rendimiento no corresponde a la orden."
    );
  }

  return value;
}

export async function orderResources(
  session: AuthSession,
  signal: AbortSignal,
  orderId: string
) {
  const order = await getOrder(session, signal, orderId);

  const [performance, waste, balances] = await Promise.all([
    getPerformance(session, signal, order),
    api(
      session,
      signal,
      "/production-orders/" + order.id + "/waste",
      z.object({ wasteRecords: z.array(wasteSchema) })
    ),
    productionBalances(session, signal, order.location.id),
  ]);

  for (const record of waste.wasteRecords) {
    if (
      record.businessId !== session.business.id ||
      record.productionOrderId !== order.id
    ) {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "El desperdicio no corresponde a la orden."
      );
    }
  }

  return {
    order,
    performance,
    waste: waste.wasteRecords,
    balances,
  };
}

export async function orderPage(
  session: AuthSession,
  signal: AbortSignal,
  ids: string[]
) {
  const result: { order: Order; value: string | null }[] = [];

  for (let offset = 0; offset < ids.length; offset += 4) {
    signal.throwIfAborted();

    result.push(
      ...(await Promise.all(
        ids.slice(offset, offset + 4).map(async (orderId) => {
          const order = await getOrder(session, signal, orderId);
          const performance =
            order.status === "COMPLETED"
              ? await getPerformance(session, signal, order)
              : null;

          return {
            order,
            value:
              performance?.summary.producedInventoryValue ?? null,
          };
        })
      ))
    );
  }

  return result;
}

export async function getOrderMovement(
  session: AuthSession,
  signal: AbortSignal,
  order: Order
) {
  if (!order.inventoryMovementId) {
    throw new Error("La orden todavía no tiene movimiento.");
  }

  const { production } = await api(
    session,
    signal,
    "/production/" + id.parse(order.inventoryMovementId),
    z.object({ production: movementDetail })
  );

  if (
    production.id !== order.inventoryMovementId ||
    production.businessId !== session.business.id ||
    production.location?.id !== order.location.id ||
    production.movementType !== "PRODUCTION"
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El movimiento no corresponde a la orden."
    );
  }

  return production;
}
