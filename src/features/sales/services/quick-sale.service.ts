import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";

import { request } from "../../../lib/http/client";
import { invalidateRelated } from "../../../lib/operations-sync";

import {
  ordersResponseSchema,
  type Order,
} from "../schemas/sales.schema";

import {
  assertOrderScope,
  confirmSalesOrder,
  deliverPrintOnlyOrder,
  getOrder,
  type SalesScope,
} from "./sales.service";

import { readPreorderPayment } from "./preorder-payments.service";

import {
  cachedPrepaidSale,
  readPrepaidSale,
  submitPrepaidCheckout,
} from "./checkout.service";

export function isQuickSale(order: {
  serviceType: string;
  sourceChannel?: string;
}) {
  return (
    order.serviceType === "TAKEAWAY" &&
    order.sourceChannel === "IN_PERSON"
  );
}

export async function getQuickSales(
  token: string,
  scope: SalesScope,
  page: number,
  signal: AbortSignal
) {
  const query = new URLSearchParams({
    locationId: scope.location.id,
    serviceType: "TAKEAWAY",
    sourceChannel: "IN_PERSON",
    page: String(page),
    pageSize: "12",
  });

  const response = await request(
    "/orders?" + query,
    ordersResponseSchema,
    {
      accessToken: token,
      signal,
      cache: "no-store",
    }
  );

  const orders = await Promise.all(
    response.data.orders.map(async (row) => {
      assertOrderScope(row, scope);

      if (!isQuickSale(row)) {
        throw new Error("El listado contiene otra modalidad.");
      }

      // El listado actual no incluye total.
      // Se consulta únicamente el detalle de esta página.
      const detail = await getOrder(token, row.id, scope, signal);

      return {
        ...row,
        ...detail,
        fulfillmentSummary: row.fulfillmentSummary,
      };
    })
  );

  return {
    ...response.data,
    orders,
  };
}

export async function recoverQuickSale(
  session: AuthSession,
  scope: SalesScope,
  orderId: string,
  signal: AbortSignal
) {
  const order = await getOrder(
    session.accessToken,
    orderId,
    scope,
    signal
  );

  if (!isQuickSale(order)) {
    throw new Error("Esta orden no es de Caja rápida.");
  }

  const batch =
    hasPermission(session, "orders.payments.read") &&
    order.paymentStatus !== "PENDING"
      ? await readPreorderPayment(session, orderId, signal)
      : null;

  let sale = cachedPrepaidSale(session, orderId);

  if (order.status === "CLOSED" && batch?.saleId) {
    sale = await readPrepaidSale(
      session,
      scope.location.id,
      orderId,
      batch.saleId,
      signal
    );
  }

  return {
    order,
    batch,
    sale,
  };
}

export async function advanceQuickSale(
  session: AuthSession,
  scope: SalesScope,
  orderId: string,
  goal: "prepare" | "finish",
  physicalDelivery: boolean,
  confirmed: (
    result: Awaited<ReturnType<typeof confirmSalesOrder>>
  ) => void,
  signal: AbortSignal
) {
  if (import.meta.env.DEV) {
    console.debug("[Caja rápida] Consultando orden y pago");
  }

  let { order, sale } = await recoverQuickSale(
    session,
    scope,
    orderId,
    signal
  );

  if (import.meta.env.DEV) {
    console.debug("[Caja rápida] Consulta validada", {
      status: order.status,
      paymentStatus: order.paymentStatus,
      hasFulfillmentSummary: !!order.fulfillmentSummary,
      canManage: hasPermission(session, "orders.manage"),
      goal,
    });
  }

  if (order.status === "CLOSED") {
    return { order, sale };
  }

  if (order.paymentStatus !== "VERIFIED") {
    throw new Error("La operación exige un pago verificado.");
  }

  if (order.status === "CANCELLED") {
    throw new Error("La orden está cancelada.");
  }

  if (!order.fulfillmentSummary) {
    throw new Error(
      "La API no devolvió la clasificación de preparación."
    );
  }

  if (goal === "finish" && !hasPermission(session, "orders.close")) {
    throw new Error("No tienes permiso para finalizar la venta.");
  }

  if (
    order.status !== "DELIVERED" &&
    !hasPermission(session, "orders.manage")
  ) {
    throw new Error(
      "No tienes permiso para confirmar o entregar órdenes."
    );
  }

  const needsPreparation =
    order.fulfillmentSummary.requiresPreparation;

  if (
    goal === "finish" &&
    order.status === "OPEN" &&
    needsPreparation
  ) {
    throw new Error(
      "Confirma primero la orden y espera su preparación."
    );
  }

  if (order.status === "OPEN") {
    if (import.meta.env.DEV) {
      console.debug("[Caja rápida] Enviando confirmación");
    }

    const result = await confirmSalesOrder(
      session.accessToken,
      orderId,
      scope
    );

    confirmed(result);
    order = result.order;
  }

  if (goal === "prepare") {
    return { order, sale };
  }

  if (order.status === "CONFIRMED") {
    if (order.kitchenWorkflowMode !== "PRINT_ONLY") {
      throw new Error(
        "Completa la entrega desde la pantalla de cocina."
      );
    }

    if (
      order.fulfillmentSummary?.requiresPreparation &&
      !physicalDelivery
    ) {
      throw new Error(
        "Confirma que cocina entregó físicamente todos los productos."
      );
    }

    order = await deliverPrintOnlyOrder(
      session.accessToken,
      orderId,
      scope
    );
  }

  if (order.status === "DELIVERED") {
    // Otro puesto puede haber finalizado o devuelto la orden.
    order = await getOrder(
      session.accessToken,
      orderId,
      scope,
      signal
    );

    if (order.status === "CLOSED") {
      return recoverQuickSale(session, scope, orderId, signal);
    }

    if (
      order.status !== "DELIVERED" ||
      order.paymentStatus !== "VERIFIED"
    ) {
      throw new Error(
        "La orden cambió. Revisa su estado antes de continuar."
      );
    }

    try {
      sale = await submitPrepaidCheckout(
        session,
        scope.location.id,
        orderId,
        signal
      );
    } finally {
      invalidateRelated(session.accessToken, {
        orderId,
      });
    }

    order = await getOrder(
      session.accessToken,
      orderId,
      scope,
      signal
    );
  }

  return { order, sale };
}

export function quickSaleLabel(order: Pick<Order, "status">) {
  return {
    OPEN: "Abierta",
    CONFIRMED: "Confirmada",
    DELIVERED: "Entregada, pendiente de finalizar venta",
    CLOSED: "Venta finalizada",
    CANCELLED: "Cancelada",
  }[order.status];
}
