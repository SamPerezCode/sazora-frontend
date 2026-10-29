import { z } from "zod";
import type { AuthSession } from "../../../auth/types/auth.types";
import { ApiError } from "../../../../lib/http/client";
import { id } from "../../schemas/inventory-location.schema";
import { movementDetail } from "../../schemas/inventory-audit.schema";
import {
  allowedActions,
  isAdmin,
  plantScope,
} from "./production.access";
import { api, checkOrder } from "./production.api";
import {
  orderSchema,
  editOrderSchema,
  completeOrderSchema,
  wasteInputSchema,
  wasteSchema,
  createOrderSchema,
  quickCreateSchema,
} from "./production.schemas";
import type { Order, Mutation } from "./production.types";

export async function saveOrder(
  session: AuthSession,
  signal: AbortSignal,
  order: Order,
  mutation: Mutation
) {
  if (!allowedActions(session, order).includes(mutation.action)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "La acción no está permitida para esta orden."
    );
  }

  if (mutation.payload.version !== order.version) {
    throw new Error("Actualiza la versión de la orden.");
  }

  const path = "/production-orders/" + id.parse(order.id);
  const response = z.object({ productionOrder: orderSchema });
  let result: { productionOrder: Order };

  switch (mutation.action) {
    case "edit":
      result = await api(
        session,
        signal,
        path,
        response,
        "PUT",
        editOrderSchema.parse(mutation.payload)
      );
      break;

    case "plan":
    case "cancel":
      result = await api(
        session,
        signal,
        path + "/status",
        response,
        "PATCH",
        {
          version: order.version,
          status:
            mutation.action === "plan" ? "PLANNED" : "CANCELLED",
          cancellationReason:
            mutation.action === "cancel"
              ? z
                  .string()
                  .trim()
                  .min(3)
                  .max(500)
                  .parse(mutation.payload.cancellationReason)
              : null,
        }
      );
      break;

    case "start":
      result = await api(
        session,
        signal,
        path + "/start",
        response,
        "POST",
        { version: order.version }
      );
      break;

    case "complete": {
      const body = completeOrderSchema.parse(mutation.payload);

      for (const group of ["inputs", "outputs"] as const) {
        const expected = new Set(
          order[group].map((line) => line.inventoryItemId)
        );

        if (
          body[group].length !== expected.size ||
          body[group].some(
            (line) => !expected.has(line.inventoryItemId)
          )
        ) {
          throw new Error(
            "Los artículos deben coincidir exactamente con la orden."
          );
        }
      }

      result = await api(
        session,
        signal,
        path + "/complete",
        response,
        "POST",
        body
      );
      break;
    }

    case "waste": {
      const body = wasteInputSchema.parse(mutation.payload);
      const expected = new Set(
        [...order.inputs, ...order.outputs].map(
          (line) => line.inventoryItemId
        )
      );

      if (
        body.lines.some((line) => !expected.has(line.inventoryItemId))
      ) {
        throw new Error(
          "Solo puedes registrar artículos de esta orden."
        );
      }

      result = await api(
        session,
        signal,
        path + "/waste",
        response.extend({ wasteRecord: wasteSchema }),
        "POST",
        body
      );
      break;
    }
  }

  return checkOrder(session, result.productionOrder, order.id);
}

export async function createDraftOrder(
  session: AuthSession,
  signal: AbortSignal,
  raw: unknown
) {
  if (!isAdmin(session)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Solo ADMIN puede crear órdenes."
    );
  }

  const body = createOrderSchema.parse(raw);
  const { productionOrder } = await api(
    session,
    signal,
    "/production-orders",
    z.object({ productionOrder: orderSchema }),
    "POST",
    body
  );

  const order = checkOrder(session, productionOrder);

  if (order.location.id !== body.locationId) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La orden no corresponde a la planta elegida."
    );
  }

  return order;
}

export async function registerQuickProduction(
  session: AuthSession,
  signal: AbortSignal,
  raw: unknown
) {
  const body = quickCreateSchema.parse(raw);
  plantScope(session, body.locationId);

  const { production } = await api(
    session,
    signal,
    "/production",
    z.object({ production: movementDetail }),
    "POST",
    body
  );

  if (
    production.businessId !== session.business.id ||
    production.location?.id !== body.locationId ||
    production.movementType !== "PRODUCTION"
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El movimiento recibido no corresponde a esta producción."
    );
  }

  return production;
}
