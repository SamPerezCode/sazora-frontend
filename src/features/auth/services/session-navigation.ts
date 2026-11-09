import { z } from "zod";
import type { AuthSession } from "../types/auth.types";
import {
  authorizedModulePath,
  resolveSessionAccess,
} from "../utils/resolve-session-access";

const KEY = "sazora.last-module.v1";

const recordSchema = z.object({
  context: z.string(),
  path: z.string().nullable(),
});

function navigationContext(session: AuthSession): string {
  return JSON.stringify([
    session.authorization.userId,
    session.business.id,
    session.membership.id,
    session.authorization.authVersion,
    session.authorizationMode,
    [...new Set(session.authorization.roles)].sort(),
  ]);
}

function readRecord() {
  try {
    const raw = sessionStorage.getItem(KEY);

    if (!raw) return null;

    const parsed = recordSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeRecord(
  session: AuthSession,
  path: string | null
): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        context: navigationContext(session),
        path,
      })
    );
  } catch {
    // La navegación funciona aunque el almacenamiento esté bloqueado.
  }
}

export function clearLastModule(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento disponible no hay una ruta que limpiar.
  }
}

export function syncNavigationContext(session: AuthSession): void {
  const record = readRecord();

  const sameContext = record?.context === navigationContext(session);

  const path = sameContext
    ? authorizedModulePath(
        session.authorization,
        record?.path ?? null
      )
    : null;

  writeRecord(session, path);
}

export function rememberModule(
  session: AuthSession,
  target: string
): void {
  const path = authorizedModulePath(session.authorization, target);

  if (path) {
    writeRecord(session, path);
  }
}

export function getSessionDestination(session: AuthSession): string {
  const record = readRecord();

  const lastModule =
    record?.context === navigationContext(session)
      ? record.path
      : null;

  return resolveSessionAccess(session.authorization, lastModule).home;
}
