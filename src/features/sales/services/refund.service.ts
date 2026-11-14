import { z } from "zod";

import { request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  hasEveryPermission,
  hasPermission,
} from "../../auth/utils/permissions";
import { cashSessionSchema } from "../../cash/schemas/cash.schema";

import { saleId } from "../schemas/financial-sales.schema";
import {
  refundSchema,
  refundSaleSchema,
  refundInput,
  type RefundInput,
  type RefundSale,
} from "../schemas/refund.schema";
import { getFinancialSaleOverview } from "./financial-sales.service";

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({
    status: z.literal("success"),
    data,
  });

const options = (session: AuthSession, signal: AbortSignal) => ({
  accessToken: session.accessToken,
  signal,
  cache: "no-store" as const,
});

function verifySale(
  sale: RefundSale,
  session: AuthSession,
  id: string
) {
  const access = session.authorization.locationAccess;

  if (
    sale.id !== id ||
    sale.businessId !== session.business.id ||
    (!access.hasGlobalAccess &&
      !access.locations.some((row) => row.id === sale.locationId))
  ) {
    throw new Error("La venta no corresponde al acceso actual.");
  }

  return sale;
}

export async function listRefunds(
  session: AuthSession,
  id: string,
  signal: AbortSignal
) {
  if (!hasPermission(session, "sales.refunds.read")) {
    throw new Error("No tienes permiso para consultar devoluciones.");
  }

  const result = await request(
    "/sales/" + saleId.parse(id) + "/refunds",
    envelope(z.object({ refunds: z.array(refundSchema) })),
    options(session, signal)
  );

  for (const row of result.data.refunds) {
    if (row.businessId !== session.business.id || row.saleId !== id) {
      throw new Error("La devolución no corresponde a esta venta.");
    }
  }

  return result.data.refunds;
}

export async function getRefund(
  session: AuthSession,
  id: string,
  refundId: string,
  signal: AbortSignal
) {
  const result = await request(
    "/sales/" +
      saleId.parse(id) +
      "/refunds/" +
      saleId.parse(refundId),
    envelope(z.object({ refund: refundSchema })),
    options(session, signal)
  );

  const row = result.data.refund;

  if (
    row.id !== refundId ||
    row.saleId !== id ||
    row.businessId !== session.business.id
  ) {
    throw new Error(
      "La devolución recibida no corresponde a esta venta."
    );
  }

  return row;
}

export async function readRefundContext(
  session: AuthSession,
  id: string,
  signal: AbortSignal
) {
  if (
    !hasEveryPermission(session, [
      "orders.read",
      "sales.refunds.read",
      "sales.refunds.create",
      "cash.sessions.read",
    ])
  ) {
    throw new Error(
      "No tienes los permisos necesarios para registrar devoluciones."
    );
  }

  const response = await request(
    "/sales/" + saleId.parse(id),
    envelope(z.object({ sale: refundSaleSchema })),
    options(session, signal)
  );

  const sale = verifySale(response.data.sale, session, id);

  const query = new URLSearchParams({
    locationId: sale.locationId,
    status: "OPEN",
  });

  const [refunds, cash] = await Promise.all([
    listRefunds(session, id, signal),
    request(
      "/cash-sessions?" + query,
      envelope(
        z.object({
          cashSessions: z.array(cashSessionSchema),
        })
      ),
      options(session, signal)
    ),
  ]);

  const sessions = cash.data.cashSessions.filter((row) => {
    if (
      row.businessId !== session.business.id ||
      row.cashRegister.locationId !== sale.locationId
    ) {
      throw new Error(
        "El turno pertenece a otro negocio o ubicación."
      );
    }

    return row.status === "OPEN";
  });

  return { sale, refunds, sessions };
}

export async function createRefund(
  session: AuthSession,
  sale: RefundSale,
  input: RefundInput,
  signal: AbortSignal
) {
  const result = await request(
    "/sales/" + saleId.parse(sale.id) + "/refunds",
    envelope(
      z.object({
        refundId: saleId,
        sale: refundSaleSchema,
      })
    ),
    {
      ...options(session, signal),
      method: "POST",
      body: refundInput.parse(input),
    }
  );

  const updated = verifySale(result.data.sale, session, sale.id);

  if (
    updated.locationId !== sale.locationId ||
    !["PARTIALLY_REFUNDED", "REFUNDED"].includes(updated.status)
  ) {
    throw new Error(
      "No fue posible verificar el resultado de la devolución."
    );
  }

  return result.data.refundId;
}

export async function readSaleWithRefunds(
  session: AuthSession,
  id: string,
  signal: AbortSignal
) {
  const sale = await getFinancialSaleOverview(session, id, signal);

  const refunds = hasPermission(session, "sales.refunds.read")
    ? await listRefunds(session, id, signal)
    : null;

  return { ...sale, refunds };
}

export type RefundContext = Awaited<
  ReturnType<typeof readRefundContext>
>;
