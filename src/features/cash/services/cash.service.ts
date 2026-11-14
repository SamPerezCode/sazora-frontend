import { z } from "zod";

import { request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import { getLocations } from "../../business/services/organization.service";

import {
  cashId,
  cashLocationSchema,
  cashRegisterSchema,
  cashSessionSchema,
  cashMovementSchema,
  reconciliationSchema,
  createRegisterInput,
  openSessionInput,
  closeSessionInput,
  manualMovementInput,
} from "../schemas/cash.schema";

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

function verify<T extends { businessId: string }>(
  value: T,
  session: AuthSession
): T {
  if (value.businessId !== session.business.id) {
    throw new Error("La respuesta no corresponde al negocio actual.");
  }

  return value;
}

export async function readCashBoard(
  session: AuthSession,
  signal: AbortSignal
) {
  const access = session.authorization.locationAccess;

  const locations = hasPermission(session, "locations.read")
    ? (
        await getLocations(session, signal, { activeOnly: false })
      ).map((location) => cashLocationSchema.parse(location))
    : access.locations
        .filter((location) => location.isSalesLocation !== undefined)
        .map((location) =>
          cashLocationSchema.parse({
            ...location,
            isActive: location.isActive !== false,
          })
        );

  // Sin acceso global, omitir locationId consulta solo la sede predeterminada.
  const scopes = access.hasGlobalAccess
    ? [undefined]
    : access.locations.map((location) => location.id);

  const groups = await Promise.all(
    scopes.map(async (locationId) => {
      const query = locationId
        ? "?locationId=" + cashId.parse(locationId)
        : "";

      const sessions = await request(
        "/cash-sessions" + query,
        envelope(
          z.object({
            cashSessions: z.array(cashSessionSchema),
          })
        ),
        options(session, signal)
      );

      const salesEnabled =
        locationId === undefined ||
        locations.some(
          (location) =>
            location.id === locationId && location.isSalesLocation
        );

      const registers = salesEnabled
        ? await request(
            "/cash-registers" +
              (query || "?") +
              (query ? "&" : "") +
              "activeOnly=false",
            envelope(
              z.object({
                cashRegisters: z.array(cashRegisterSchema),
              })
            ),
            options(session, signal)
          )
        : null;

      return {
        sessions: sessions.data.cashSessions.map((row) =>
          verify(row, session)
        ),
        registers:
          registers?.data.cashRegisters.map((row) =>
            verify(row, session)
          ) ?? [],
      };
    })
  );

  return {
    locations,
    registers: groups.flatMap((group) => group.registers),
    sessions: groups.flatMap((group) => group.sessions),
  };
}

export type CashBoard = Awaited<ReturnType<typeof readCashBoard>>;

export async function readCashSession(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const key = cashId.parse(id);

  const [reconciliation, movements] = await Promise.all([
    request(
      "/cash-sessions/" + key + "/reconciliation",
      envelope(
        z.object({
          reconciliation: reconciliationSchema,
        })
      ),
      options(session, signal)
    ),
    request(
      "/cash-movements?cashSessionId=" + key,
      envelope(
        z.object({
          cashMovements: z.array(cashMovementSchema),
        })
      ),
      options(session, signal)
    ),
  ]);

  const data = reconciliation.data.reconciliation;

  verify(data.cashSession, session);

  if (data.cashSession.id !== id) {
    throw new Error("Turno inesperado.");
  }

  for (const row of movements.data.cashMovements) {
    verify(row, session);

    if (row.cashSessionId !== id) {
      throw new Error("Movimiento de otro turno.");
    }
  }

  return {
    reconciliation: data,
    movements: movements.data.cashMovements,
  };
}

export async function createRegister(
  body: z.input<typeof createRegisterInput>,
  session: AuthSession,
  signal: AbortSignal
) {
  const result = await request(
    "/cash-registers",
    envelope(z.object({ cashRegister: cashRegisterSchema })),
    {
      ...options(session, signal),
      method: "POST",
      body: createRegisterInput.parse(body),
    }
  );

  return verify(result.data.cashRegister, session);
}

export async function openSession(
  body: z.input<typeof openSessionInput>,
  session: AuthSession,
  signal: AbortSignal
) {
  const result = await request(
    "/cash-sessions/open",
    envelope(z.object({ cashSession: cashSessionSchema })),
    {
      ...options(session, signal),
      method: "POST",
      body: openSessionInput.parse(body),
    }
  );

  return verify(result.data.cashSession, session);
}

export async function closeSession(
  id: string,
  body: z.input<typeof closeSessionInput>,
  session: AuthSession,
  signal: AbortSignal
) {
  const result = await request(
    "/cash-sessions/" + cashId.parse(id) + "/close",
    envelope(z.object({ cashSession: cashSessionSchema })),
    {
      ...options(session, signal),
      method: "POST",
      body: closeSessionInput.parse(body),
    }
  );

  const row = verify(result.data.cashSession, session);

  if (row.id !== id || row.status !== "CLOSED") {
    throw new Error("Verifica el cierre del turno.");
  }

  return row;
}

export async function createMovement(
  body: z.input<typeof manualMovementInput>,
  session: AuthSession,
  signal: AbortSignal
) {
  const result = await request(
    "/cash-movements",
    envelope(z.object({ cashMovement: cashMovementSchema })),
    {
      ...options(session, signal),
      method: "POST",
      body: manualMovementInput.parse(body),
    }
  );

  return verify(result.data.cashMovement, session);
}
