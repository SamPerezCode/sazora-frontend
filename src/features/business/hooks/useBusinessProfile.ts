import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import type { BusinessIdentity } from "../schemas/business-profile.schema";
import type {
  BusinessMutation,
  BusinessSettings,
  BusinessSettingsResource,
} from "../schemas/business-settings.schema";
import {
  loadBusinessSettings,
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

  const canRead = Boolean(
    session && hasPermission(session, "business.settings.read")
  );

  const canManage = Boolean(
    session && hasPermission(session, "business.settings.manage")
  );

  const scope = session
    ? JSON.stringify([
        session.business.id,
        session.membership.id,
        session.accessToken,
        canRead,
        canManage,
      ])
    : "";

  useEffect(() => {
    if (!canRead || !businessId || !token) return;

    const controller = new AbortController();
    readController.current = controller;

    void loadBusinessSettings(
      businessId,
      token,
      controller.signal,
      canManage
    )
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
          setSnapshot((previous) => ({
            scope,
            attempt,
            data: previous?.scope === scope ? previous.data : null,
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos consultar el negocio.",
          }));
        }
      })
      .finally(() => {
        if (readController.current === controller) {
          readController.current = null;
        }
      });

    return () => controller.abort();
  }, [canRead, canManage, businessId, token, scope, attempt]);

  useEffect(
    () => () => {
      writeController.current?.abort();
    },
    [scope]
  );

  const current =
    canRead && snapshot?.scope === scope ? snapshot : null;

  const refreshing =
    canRead && (!current || current.attempt !== attempt);

  const mutate = useCallback(
    async (action: BusinessMutation): Promise<BusinessSettings> => {
      if (!canRead || !canManage || !businessId || !token) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "No tienes acceso para modificar la configuración."
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
    [canRead, canManage, businessId, token, scope, attempt]
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
    loading: refreshing && !current?.data,
    error: !canRead
      ? "No tienes permisos para consultar la configuración."
      : current?.attempt === attempt
        ? current.error
        : null,
    busy: pendingScope === scope || refreshing,
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
