import { useEffect, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";

export function useInventoryQuery<T>(
  key: string,
  load: (session: AuthSession, signal: AbortSignal) => Promise<T>,
  revision = 0
) {
  const { session } = useAppShell();

  const [attempt, setAttempt] = useState(0);

  const [snapshot, setSnapshot] = useState<{
    scope: string;
    requestKey: string;
    data: T | null;
    error: string | null;
    status: number | null;
  } | null>(null);

  const scope = JSON.stringify([
    key,
    session.business.id,
    session.membership.id,
    session.accessToken,
  ]);

  const requestKey = JSON.stringify([scope, revision, attempt]);

  const allowed = session.authorization.roles.includes("ADMIN");

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();

    void load(session, controller.signal)
      .then((data) => {
        controller.signal.throwIfAborted();

        setSnapshot({
          scope,
          requestKey,
          data,
          error: null,
          status: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        const status =
          error instanceof ApiError ? error.status : null;

        setSnapshot((previous) => ({
          scope,
          requestKey,
          status,
          data:
            status !== 401 &&
            status !== 403 &&
            previous?.scope === scope
              ? previous.data
              : null,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cargar la información.",
        }));
      });

    return () => controller.abort();
  }, [session, allowed, scope, requestKey, load]);

  const current =
    allowed && snapshot?.scope === scope ? snapshot : null;

  const pending = allowed && current?.requestKey !== requestKey;

  return {
    data: current?.data ?? null,

    pending,

    loading: pending && current?.data == null,

    error: !allowed
      ? "No tienes acceso al inventario."
      : pending
        ? null
        : (current?.error ?? null),

    status: allowed ? (current?.status ?? null) : 403,

    refresh: () => setAttempt((value) => value + 1),
  };
}
