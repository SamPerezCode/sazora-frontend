import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  getInventoryItems,
  getMovementCounter,
} from "../services/inventory.service";

interface Snapshot<T> {
  scope: string;
  attempt: number;
  data: T[] | null;
  error: string | null;
  errorStatus: number | null;
  updatedAt: number | null;
}

function useResource<T extends { businessId: string }>(
  session: AuthSession,
  attempt: number,
  load: (token: string, signal: AbortSignal) => Promise<T[]>
) {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);

  const { accessToken } = session;
  const businessId = session.business.id;

  const scope = JSON.stringify([
    businessId,
    session.membership.id,
    accessToken,
  ]);

  const allowed = session.authorization.roles.includes("ADMIN");

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();

    void load(accessToken, controller.signal)
      .then((data) => {
        controller.signal.throwIfAborted();

        if (data.some((item) => item.businessId !== businessId)) {
          throw new ApiError(
            502,
            "BUSINESS_MISMATCH",
            "No pudimos verificar los datos de este negocio."
          );
        }

        setSnapshot({
          scope,
          attempt,
          data,
          error: null,
          errorStatus: null,
          updatedAt: Date.now(),
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;

        const denied =
          cause instanceof ApiError &&
          (cause.status === 401 || cause.status === 403);

        setSnapshot((previous) => {
          const keep = !denied && previous?.scope === scope;

          return {
            scope,
            attempt,
            data: keep ? previous.data : null,
            updatedAt: keep ? previous.updatedAt : null,
            errorStatus:
              cause instanceof ApiError ? cause.status : null,
            error:
              cause instanceof Error
                ? cause.message
                : "No pudimos cargar los datos.",
          };
        });
      });

    return () => controller.abort();
  }, [accessToken, businessId, scope, allowed, attempt, load]);

  const current =
    allowed && snapshot?.scope === scope ? snapshot : null;

  const pending =
    allowed && (!current || current.attempt !== attempt);

  return {
    data: current?.data ?? null,

    // Durante un reintento ocultamos el error anterior.
    error: allowed
      ? pending
        ? null
        : (current?.error ?? null)
      : "No tienes permiso para consultar inventario.",

    errorStatus: allowed ? (current?.errorStatus ?? null) : 403,

    updatedAt: current?.updatedAt ?? null,

    loading: pending && !current?.data,
    refreshing: pending && !!current?.data,
    pending,
  };
}

export function useInventory(session: AuthSession) {
  const [attempt, setAttempt] = useState(0);

  const items = useResource(session, attempt, getInventoryItems);

  const movements = useResource(session, attempt, getMovementCounter);

  return {
    items,
    movements,
    refresh: () => setAttempt((value) => value + 1),
    pending: items.pending || movements.pending,
  };
}
