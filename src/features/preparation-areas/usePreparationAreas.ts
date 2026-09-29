import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "../auth/types/auth.types";
import { ApiError } from "../../lib/http/client";
import type {
  AreaAction,
  PreparationArea,
} from "./preparation-area.schema";
import {
  getPreparationAreas,
  savePreparationArea,
} from "./preparation-area.service";

interface Snapshot {
  scope: string;
  attempt: number;
  areas: PreparationArea[];
  error: string | null;
}

function sortAreas(areas: PreparationArea[]): PreparationArea[] {
  return [...areas].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.name.localeCompare(b.name, "es", {
        sensitivity: "base",
      }) ||
      (BigInt(a.id) < BigInt(b.id)
        ? -1
        : BigInt(a.id) > BigInt(b.id)
          ? 1
          : 0)
  );
}

export function usePreparationAreas(session: AuthSession) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingScope, setPendingScope] = useState<string | null>(
    null
  );

  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);

  const { accessToken, business, membership } = session;
  const businessId = business.id;
  const allowed = session.authorization.roles.includes("ADMIN");

  const scope = `${businessId}:${membership.id}:${accessToken}`;

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();
    readController.current = controller;

    void getPreparationAreas(accessToken, controller.signal)
      .then((areas) => {
        if (areas.some((area) => area.businessId !== businessId)) {
          throw new ApiError(
            502,
            "BUSINESS_MISMATCH",
            "No pudimos verificar las áreas."
          );
        }

        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            areas,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            areas: [],
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos cargar las áreas.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, businessId, allowed, scope, attempt]);

  useEffect(
    () => () => {
      writeController.current?.abort();
      writeController.current = null;
    },
    [scope, allowed]
  );

  const current =
    snapshot?.scope === scope && snapshot.attempt === attempt
      ? snapshot
      : null;

  const busy = pendingScope === scope;

  async function mutate(
    action: AreaAction
  ): Promise<PreparationArea> {
    if (!allowed) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "No tienes acceso a las áreas."
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
      const area = await savePreparationArea(
        action,
        accessToken,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (
        area.businessId !== businessId ||
        (action.kind !== "create" && area.id !== action.id)
      ) {
        throw new ApiError(
          502,
          "AREA_MISMATCH",
          "No pudimos verificar el área guardada."
        );
      }

      setSnapshot((previous) => ({
        scope,
        attempt,
        error: null,
        areas: sortAreas([
          ...(previous?.scope === scope ? previous.areas : []).filter(
            (item) => item.id !== area.id
          ),
          area,
        ]),
      }));

      return area;
    } finally {
      if (writeController.current === controller) {
        writeController.current = null;
        setPendingScope(null);
      }
    }
  }

  return {
    areas: allowed ? (current?.areas ?? []) : [],
    loading: allowed && current === null,
    error: allowed
      ? (current?.error ?? null)
      : "No tienes acceso a las áreas.",
    busy,
    mutate,
    retry: () => {
      if (!writeController.current) {
        setAttempt((value) => value + 1);
      }
    },
  };
}
