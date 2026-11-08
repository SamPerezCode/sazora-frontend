import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { canAccessDashboard } from "../../auth/utils/permissions";
import { getDashboard } from "../services/dashboard.service";
import type {
  DashboardData,
  DashboardResource,
} from "../types/dashboard.types";

interface Snapshot {
  scope: string;
  attempt: number;
  data: DashboardData | null;
  error: DashboardResource["error"];
}

export function useDashboard(
  session: AuthSession | null,
  active: boolean
): DashboardResource {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);

  const allowed = Boolean(
    active && session && canAccessDashboard(session)
  );

  const scope = session
    ? `${session.business.id}:${session.membership.id}:${session.accessToken}`
    : "";

  useEffect(() => {
    if (!allowed || !session) return;

    const controller = new AbortController();

    void getDashboard(session, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            data,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        const status = error instanceof ApiError ? error.status : 0;

        setSnapshot((previous) => ({
          scope,
          attempt,
          data:
            status === 401 || status === 403
              ? null
              : previous?.scope === scope
                ? previous.data
                : null,
          error: {
            status,
            message:
              error instanceof ApiError
                ? error.message
                : "No pudimos cargar el panel. Intenta nuevamente.",
          },
        }));
      });

    return () => controller.abort();
  }, [allowed, session, scope, attempt]);

  const current =
    allowed && snapshot?.scope === scope ? snapshot : null;

  const refresh = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return {
    data: current?.data ?? null,
    loading: allowed && (!current || current.attempt !== attempt),
    error: current?.attempt === attempt ? current.error : null,
    refresh,
  };
}
