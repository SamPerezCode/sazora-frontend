import { z } from "zod";
import { request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasEveryPermission } from "../../auth/utils/permissions";
import { cashSessionSchema } from "../../cash/schemas/cash.schema";
import { cashCents } from "../../cash/utils/cash-format";
import {
  saleId,
  saleDetailSchema,
} from "../schemas/financial-sales.schema";
import {
  voidSaleInput,
  type VoidSaleInput,
  type VoidableSale,
} from "../schemas/void-sale.schema";
import { getFinancialSale } from "./financial-sales.service";

function requireAccess(session: AuthSession, locationId: string) {
  const access = session.authorization.locationAccess;

  if (
    !hasEveryPermission(session, [
      "orders.read",
      "sales.void",
      "cash.sessions.read",
    ]) ||
    (!access.hasGlobalAccess &&
      !access.locations.some((row) => row.id === locationId))
  ) {
    throw new Error(
      "No tienes acceso para anular ventas en esta ubicación."
    );
  }
}

export function voidCashAmount(sale: VoidableSale) {
  return sale.payments
    .filter((payment) => payment.affectsCash)
    .reduce((sum, payment) => sum + cashCents(payment.amount), 0n);
}

export function voidFingerprint(sale: VoidableSale) {
  return JSON.stringify([
    sale.id,
    sale.status,
    sale.total,
    sale.currencyCode,
    sale.payments.map((payment) => [
      payment.id,
      payment.amount,
      payment.affectsCash,
    ]),
  ]);
}

export async function readVoidOptions(
  session: AuthSession,
  id: string,
  locationId: string,
  signal: AbortSignal
) {
  requireAccess(session, locationId);

  const query = new URLSearchParams({
    locationId: saleId.parse(locationId),
    status: "OPEN",
  });

  const [sale, response] = await Promise.all([
    getFinancialSale(session, id, signal),
    request(
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
    ),
  ]);

  if (sale.locationId !== locationId) {
    throw new Error("La venta pertenece a otra ubicación.");
  }

  const sessions = response.data.cashSessions.filter((row) => {
    if (
      row.businessId !== session.business.id ||
      row.cashRegister.locationId !== locationId
    ) {
      throw new Error(
        "La respuesta contiene turnos de otro negocio o ubicación."
      );
    }

    return row.status === "OPEN";
  });

  return { sale, sessions };
}

export async function voidFinancialSale(
  session: AuthSession,
  sale: VoidableSale,
  input: VoidSaleInput,
  signal: AbortSignal
) {
  requireAccess(session, sale.locationId);

  const response = await request(
    "/sales/" + saleId.parse(sale.id) + "/void",
    z.object({
      status: z.literal("success"),
      data: z.object({
        sale: saleDetailSchema,
      }),
    }),
    {
      accessToken: session.accessToken,
      signal,
      method: "POST",
      body: voidSaleInput.parse(input),
    }
  );

  const result = response.data.sale;

  if (
    result.id !== sale.id ||
    result.businessId !== session.business.id ||
    result.locationId !== sale.locationId ||
    result.status !== "VOIDED"
  ) {
    throw new Error("No fue posible verificar la venta anulada.");
  }

  return result;
}

export type VoidOptions = Awaited<ReturnType<typeof readVoidOptions>>;
