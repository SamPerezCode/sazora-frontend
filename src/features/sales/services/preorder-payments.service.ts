import { z } from "zod";

import { request } from "../../../lib/http/client";

import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import { cashSessionSchema } from "../../cash/schemas/cash.schema";
import { getPaymentMethods } from "../../payment-methods/services/payment-method.service";

import {
  paymentStatusSchema,
  savedResponseSchema,
} from "../schemas/sales.schema";

import { getOrder, type SalesScope } from "./sales.service";

const amount = z.string().regex(/^\d+(?:\.\d{1,2})?$/);

const id = z.string().regex(/^[1-9]\d*$/);

const paymentBatchSchema = z.object({
  id,
  businessId: id,
  orderId: id,
  cashSessionId: id,
  saleId: id.nullable(),
  refundedAt: z.iso.datetime({ offset: true }).nullable(),
  status: paymentStatusSchema,
  paidTotal: amount,
  changeTotal: amount,
  verifiedAt: z.iso.datetime({ offset: true }).nullable(),
  payments: z.array(
    z.object({
      id,
      paymentMethodId: id,
      paymentMethodName: z.string(),
      paymentType: z.string(),
      requiresReference: z.boolean(),
      affectsCash: z.boolean(),
      amount,
      tenderedAmount: amount.nullable(),
      changeAmount: amount,
      reference: z.string().nullable(),
      notes: z.string().nullable(),
    })
  ),
});

export type PreorderPaymentBatch = z.infer<typeof paymentBatchSchema>;

export async function readPreorderPayment(
  session: AuthSession,
  orderId: string,
  signal: AbortSignal
) {
  if (!hasPermission(session, "orders.payments.read")) {
    throw new Error(
      "No tienes permiso para consultar el detalle del pago."
    );
  }

  const response = await request(
    `/orders/${id.parse(orderId)}/payments`,
    z.object({
      status: z.literal("success"),
      data: z.object({
        paymentBatch: paymentBatchSchema.nullable(),
      }),
    }),
    {
      accessToken: session.accessToken,
      signal,
      cache: "no-store",
    }
  );

  const batch = response.data.paymentBatch;

  if (
    batch &&
    (batch.orderId !== orderId ||
      batch.businessId !== session.business.id)
  ) {
    throw new Error("El pago recibido no corresponde a esta orden.");
  }

  return batch;
}

export async function readPreorderPaymentOptions(
  session: AuthSession,
  scope: SalesScope,
  signal: AbortSignal,
  includeMethods = true
) {
  const query = new URLSearchParams({
    locationId: scope.location.id,
    status: "OPEN",
  });

  const [methods, response] = await Promise.all([
    includeMethods
      ? getPaymentMethods(session, signal)
      : Promise.resolve([]),
    hasPermission(session, "cash.sessions.read")
      ? request(
          "/cash-sessions?" + query,
          z.object({
            status: z.literal("success"),
            data: z.object({
              cashSessions: z.array(cashSessionSchema),
            }),
          }),
          {
            accessToken: session.accessToken,
            signal,
            cache: "no-store",
          }
        )
      : null,
  ]);

  const sessions = response?.data.cashSessions ?? [];

  if (
    sessions.some(
      (row) =>
        row.businessId !== session.business.id ||
        row.cashRegister.locationId !== scope.location.id
    )
  ) {
    throw new Error(
      "Los turnos recibidos no corresponden a esta ubicación."
    );
  }

  return {
    methods,
    sessions: sessions.filter((row) => row.status === "OPEN"),
  };
}

export async function writePreorderPayment(
  session: AuthSession,
  scope: SalesScope,
  orderId: string,
  mode: "pay" | "refund",
  body: unknown
) {
  const permission =
    mode === "pay"
      ? "orders.payments.manage"
      : "orders.payments.refund";

  if (!hasPermission(session, permission)) {
    throw new Error("No tienes permiso para esta operación.");
  }

  const current = await getOrder(session.accessToken, orderId, scope);

  if (current.serviceType === "TABLE") {
    throw new Error("Las mesas se cobran al cerrar la cuenta.");
  }

  if (
    mode === "pay" &&
    (current.status !== "OPEN" || current.paymentStatus !== "PENDING")
  ) {
    throw new Error(
      "La orden ya no está pendiente de pago. Actualiza su detalle."
    );
  }

  if (mode === "refund" && current.paymentStatus !== "VERIFIED") {
    throw new Error("El pago ya no está disponible para devolución.");
  }

  await request(
    `/orders/${orderId}/payments${
      mode === "refund" ? "/refund" : ""
    }`,
    savedResponseSchema,
    {
      method: "POST",
      accessToken: session.accessToken,
      body,
    }
  );
}
