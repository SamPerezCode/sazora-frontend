import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import type { BusinessIdentity } from "../schemas/business-profile.schema";
import type {
  BusinessMutation,
  BusinessSettings,
  BusinessSettingsResource,
} from "../schemas/business-settings.schema";
import {
  getBusinessSettings,
  mutateBusinessSettings,
  toBusinessIdentity,
} from "../services/business-profile.service";
import { ApiError } from "../../../lib/http/client";

interface Snapshot {
  scope: string;
  attempt: number;
  data: BusinessSettings | null;
  error: string | null;
}

export function useBusinessProfile(session: AuthSession | null) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingScope, setPendingScope] = useState<string | null>(
    null
  );

  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);

  const businessId = session?.business.id;
  const token = session?.accessToken;
  const allowed =
    session?.authorization.roles.includes("ADMIN") ?? false;

  const scope = session
    ? `${session.business.id}:${session.membership.id}:${session.accessToken}`
    : "";

  useEffect(() => {
    if (!allowed || !businessId || !token) return;

    const controller = new AbortController();
    readController.current = controller;

    void getBusinessSettings(businessId, token, controller.signal)
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
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            data: null,
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos consultar el negocio.",
          });
        }
      });

    return () => controller.abort();
  }, [allowed, businessId, token, scope, attempt]);

  useEffect(
    () => () => {
      writeController.current?.abort();
      writeController.current = null;
    },
    [scope, allowed]
  );

  const current =
    allowed &&
    snapshot?.scope === scope &&
    snapshot.attempt === attempt
      ? snapshot
      : null;

  const mutate = useCallback(
    async (action: BusinessMutation): Promise<BusinessSettings> => {
      if (!allowed || !businessId || !token) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "No tienes acceso a la configuración."
        );
      }

      if (writeController.current) {
        throw new ApiError(
          409,
          "REQUEST_PENDING",
          "Espera a que termine el guardado."
        );
      }

      readController.current?.abort();

      const controller = new AbortController();
      writeController.current = controller;
      setPendingScope(scope);

      try {
        const data = await mutateBusinessSettings(
          businessId,
          token,
          action,
          controller.signal
        );

        controller.signal.throwIfAborted();

        setSnapshot({
          scope,
          attempt,
          data,
          error: null,
        });

        return data;
      } finally {
        if (writeController.current === controller) {
          writeController.current = null;
          setPendingScope(null);
        }
      }
    },
    [allowed, businessId, token, scope, attempt]
  );

  const retry = useCallback(() => {
    if (!writeController.current) {
      setAttempt((value) => value + 1);
    }
  }, []);

  const business: BusinessIdentity | null = !session
    ? null
    : current?.data
      ? toBusinessIdentity(current.data)
      : {
          ...session.business,
          logoUrl: null,
        };

  const settings: BusinessSettingsResource = {
    data: current?.data ?? null,
    loading: allowed && current === null,
    error: current?.error ?? null,
    busy: pendingScope === scope,
    retry,
    mutate,
  };

  return {
    business,
    settings,
    error: settings.error,
    retry,
  };
}
