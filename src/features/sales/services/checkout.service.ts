import { z } from "zod";
import { request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasEveryPermission } from "../../auth/utils/permissions";
import { cashSessionSchema } from "../../cash/schemas/cash.schema";
import { getPaymentMethods } from "../../payment-methods/services/payment-method.service";
import {
  salesResponse,
  saleId,
} from "../schemas/financial-sales.schema";
import {
  checkoutInput,
  checkoutOrder,
  checkoutSale,
  type CheckoutInput,
  type CheckoutOrder,
} from "../schemas/checkout.schema";

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({
    status: z.literal("success"),
    data,
  });

function options(session: AuthSession, signal: AbortSignal) {
  return {
    accessToken: session.accessToken,
    signal,
    cache: "no-store" as const,
  };
}

function verify<
  T extends {
    businessId: string;
    locationId: string;
  },
>(value: T, session: AuthSession, locationId: string): T {
  const access = session.authorization.locationAccess;

  if (
    value.businessId !== session.business.id ||
    value.locationId !== locationId ||
    (!access.hasGlobalAccess &&
      !access.locations.some((row) => row.id === locationId))
  ) {
    throw new Error(
      "La respuesta no corresponde al negocio y ubicación actuales."
    );
  }

  return value;
}

export function orderFingerprint(order: CheckoutOrder) {
  return JSON.stringify([
    order.id,
    order.total,
    order.status,
    order.items
      .filter((item) => item.status === "ACTIVE")
      .map((item) => [
        item.id,
        item.quantity,
        item.unitPrice,
        item.lineTotal,
        item.notes,
      ]),
  ]);
}

export async function readCheckout(
  session: AuthSession,
  orderId: string,
  locationId: string,
  signal: AbortSignal
) {
  if (
    !hasEveryPermission(session, [
      "orders.read",
      "orders.close",
      "cash.sessions.read",
    ])
  ) {
    throw new Error(
      "Necesitas permisos para consultar órdenes, cobrar y consultar turnos de caja."
    );
  }

  const query = new URLSearchParams({
    locationId: saleId.parse(locationId),
    status: "OPEN",
  });

  const [orderResponse, cashResponse, methods] = await Promise.all([
    request(
      "/orders/" + saleId.parse(orderId),
      envelope(z.object({ order: checkoutOrder })),
      options(session, signal)
    ),
    request(
      "/cash-sessions?" + query,
      envelope(
        z.object({
          cashSessions: z.array(cashSessionSchema),
        })
      ),
      options(session, signal)
    ),
    getPaymentMethods(session, signal),
  ]);

  const order = verify(orderResponse.data.order, session, locationId);

  if (order.id !== orderId) {
    throw new Error("La respuesta corresponde a otra orden.");
  }

  const sessions = cashResponse.data.cashSessions.filter((row) => {
    verify(
      {
        businessId: row.businessId,
        locationId: row.cashRegister.locationId,
      },
      session,
      locationId
    );

    return row.status === "OPEN";
  });

  return {
    order,
    sessions,
    methods: methods.filter((method) => method.isActive),
  };
}

export async function submitCheckout(
  session: AuthSession,
  locationId: string,
  input: CheckoutInput,
  signal: AbortSignal
) {
  const response = await request(
    "/sales",
    envelope(z.object({ sale: checkoutSale })),
    {
      ...options(session, signal),
      method: "POST",
      body: checkoutInput.parse(input),
    }
  );

  const sale = verify(response.data.sale, session, locationId);

  if (
    sale.orderId !== input.orderId ||
    sale.cashSessionId !== input.cashSessionId
  ) {
    throw new Error("No fue posible verificar la venta recibida.");
  }

  return sale;
}

export async function findCheckout(
  session: AuthSession,
  orderId: string,
  locationId: string,
  signal: AbortSignal
) {
  // La API no permite filtrar ventas por orderId.
  let page = 1;
  let totalPages: number;

  do {
    signal.throwIfAborted();

    const query = new URLSearchParams({
      locationId,
      page: String(page),
      pageSize: "100",
    });

    const response = await request(
      "/sales?" + query,
      salesResponse,
      options(session, signal)
    );

    response.data.sales.forEach((row) =>
      verify(row, session, locationId)
    );

    const match = response.data.sales.find(
      (row) => row.orderId === orderId
    );

    if (match) {
      const detail = await request(
        "/sales/" + match.id,
        envelope(z.object({ sale: checkoutSale })),
        options(session, signal)
      );

      const sale = verify(detail.data.sale, session, locationId);

      if (sale.orderId !== orderId || sale.id !== match.id) {
        throw new Error("No fue posible verificar la venta.");
      }

      return sale;
    }

    totalPages = response.data.pagination.totalPages;
    page++;
  } while (page <= totalPages);

  return null;
}

const prepaidSales = new WeakMap<
  AuthSession,
  Map<string, import("../schemas/checkout.schema").CheckoutSale>
>();

export function cachedPrepaidSale(
  session: AuthSession,
  orderId: string
) {
  return prepaidSales.get(session)?.get(orderId) ?? null;
}

function rememberPrepaidSale(
  session: AuthSession,
  sale: import("../schemas/checkout.schema").CheckoutSale
) {
  let cache = prepaidSales.get(session);

  if (!cache) {
    cache = new Map();
    prepaidSales.set(session, cache);
  }

  cache.set(sale.orderId, sale);

  return sale;
}

export async function submitPrepaidCheckout(
  session: AuthSession,
  locationId: string,
  orderId: string,
  signal: AbortSignal
) {
  if (!hasEveryPermission(session, ["orders.read", "orders.close"])) {
    throw new Error("No tienes permiso para finalizar la venta.");
  }

  const response = await request(
    "/sales",
    envelope(z.object({ sale: checkoutSale })),
    {
      ...options(session, signal),
      method: "POST",
      body: {
        orderId: saleId.parse(orderId),
        commercialCustomerId: null,
        payments: [],
      },
    }
  );

  const sale = verify(response.data.sale, session, locationId);

  if (sale.orderId !== orderId) {
    throw new Error("La venta recibida corresponde a otra orden.");
  }

  return rememberPrepaidSale(session, sale);
}

export async function readPrepaidSale(
  session: AuthSession,
  locationId: string,
  orderId: string,
  id: string,
  signal: AbortSignal
) {
  const response = await request(
    "/sales/" + saleId.parse(id),
    envelope(z.object({ sale: checkoutSale })),
    options(session, signal)
  );

  const sale = verify(response.data.sale, session, locationId);

  if (sale.id !== id || sale.orderId !== orderId) {
    throw new Error("La venta no corresponde al pago de esta orden.");
  }

  return rememberPrepaidSale(session, sale);
}

export type CheckoutData = Awaited<ReturnType<typeof readCheckout>>;
