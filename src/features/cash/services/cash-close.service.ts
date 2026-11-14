import { z } from "zod";

import { request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";

import {
  cashId,
  reconciliationSchema,
  closeSessionInput,
  type CashSession,
} from "../schemas/cash.schema";

import { closeSession } from "./cash.service";

export function canCloseCash(row: CashSession, session: AuthSession) {
  const access = session.authorization.locationAccess;

  return (
    row.status === "OPEN" &&
    row.businessId === session.business.id &&
    hasPermission(session, "cash.sessions.close") &&
    (access.hasGlobalAccess ||
      access.locations.some(
        (location) => location.id === row.cashRegister.locationId
      ))
  );
}

function verify(row: CashSession, id: string, session: AuthSession) {
  const access = session.authorization.locationAccess;

  if (
    row.id !== id ||
    row.businessId !== session.business.id ||
    (!access.hasGlobalAccess &&
      !access.locations.some(
        (location) => location.id === row.cashRegister.locationId
      ))
  ) {
    throw new Error(
      "El turno no corresponde a tu negocio o ubicación."
    );
  }
}

export async function readCloseReconciliation(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  if (!hasPermission(session, "cash.sessions.read")) {
    throw new Error("No tienes permiso para consultar el turno.");
  }

  const result = await request(
    "/cash-sessions/" + cashId.parse(id) + "/reconciliation",
    z.object({
      status: z.literal("success"),
      data: z.object({
        reconciliation: reconciliationSchema,
      }),
    }),
    {
      accessToken: session.accessToken,
      signal,
      cache: "no-store",
    }
  );

  const data = result.data.reconciliation;

  verify(data.cashSession, id, session);

  return data;
}

export async function submitCashClose(
  row: CashSession,
  body: z.input<typeof closeSessionInput>,
  session: AuthSession,
  signal: AbortSignal
) {
  if (!canCloseCash(row, session)) {
    throw new Error("No puedes cerrar este turno.");
  }

  const result = await closeSession(row.id, body, session, signal);

  verify(result, row.id, session);

  if (
    result.cashRegisterId !== row.cashRegisterId ||
    result.expectedCashAmount === null ||
    result.countedCashAmount === null ||
    result.differenceAmount === null ||
    result.closedAt === null
  ) {
    throw new Error(
      "No se pudo verificar el arqueo definitivo. Consulta el estado del turno."
    );
  }

  return result;
}
