import { useCallback, useEffect, useState } from "react";
import { useAppShell } from "../app/layout/shell-context";
import type { AuthSession } from "../features/auth/types/auth.types";

export function useAdminResource<T>(
  load: (session: AuthSession, signal: AbortSignal) => Promise<T>,
  name: string
) {
  const { session } = useAppShell();
  const [attempt, setAttempt] = useState(0);

  const key = JSON.stringify([
    name,
    session.business.id,
    session.membership.id,
    session.accessToken,
    attempt,
  ]);

  const [snapshot, setSnapshot] = useState<{
    key: string;
    data?: T;
    error?: string;
  } | null>(null);

  const allowed = session.authorization.roles.includes("ADMIN");

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();

    void load(session, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSnapshot({ key, data });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            key,
            error:
              error instanceof Error
                ? error.message
                : "No pudimos consultar los datos.",
          });
        }
      });

    return () => controller.abort();
  }, [session, allowed, key, load]);

  return {
    data:
      allowed && snapshot?.key === key ? snapshot.data : undefined,

    error: !allowed
      ? "No tienes acceso a Configuración."
      : snapshot?.key === key
        ? snapshot.error
        : undefined,

    pending: allowed && snapshot?.key !== key,

    refresh: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
