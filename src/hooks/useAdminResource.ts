import { useCallback, useEffect, useState } from "react";
import { useAppShell } from "../app/layout/shell-context";
import type { AuthSession } from "../features/auth/types/auth.types";
import { hasPermission } from "../features/auth/utils/permissions";
import { ApiError } from "../lib/http/client";

export function useAdminResource<T>(
  load: (session: AuthSession, signal: AbortSignal) => Promise<T>,
  name: string,
  permission?: string,
  keepPreviousData = false
) {
  const { session } = useAppShell();
  const [attempt, setAttempt] = useState(0);

  const scope = JSON.stringify([
    name,
    permission,
    session.user.id,
    session.business.id,
    session.membership.id,
    session.accessToken,
    session.authorization,
  ]);

  const key = JSON.stringify([scope, attempt]);

  const [snapshot, setSnapshot] = useState<{
    scope: string;
    key: string;
    data?: T;
    error?: string;
  } | null>(null);

  const allowed = permission
    ? hasPermission(session, permission)
    : session.authorization.roles.includes("ADMIN");

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();

    void load(session, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSnapshot({ scope, key, data });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        const accessDenied =
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403);

        setSnapshot((previous) => ({
          scope,
          key,
          data:
            keepPreviousData &&
            !accessDenied &&
            previous?.scope === scope
              ? previous.data
              : undefined,
          error:
            error instanceof Error
              ? error.message
              : "No pudimos consultar los datos.",
        }));
      });

    return () => controller.abort();
  }, [session, allowed, scope, key, load, keepPreviousData]);

  const sameScope = allowed && snapshot?.scope === scope;

  const data =
    sameScope && (keepPreviousData || snapshot.key === key)
      ? snapshot.data
      : undefined;

  const pending = allowed && snapshot?.key !== key;

  const refresh = useCallback(
    () => setAttempt((value) => value + 1),
    []
  );

  return {
    data,
    error: !allowed
      ? "No tienes acceso a Configuración."
      : sameScope && snapshot.key === key
        ? snapshot.error
        : undefined,
    pending,
    refreshing: pending && data !== undefined,
    refresh,
  };
}
