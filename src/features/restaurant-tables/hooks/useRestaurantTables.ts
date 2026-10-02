import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import { ApiError } from "../../../lib/http/client";
import type {
  RestaurantTable,
  TableAction,
} from "../schemas/restaurant-table.schema";
import {
  getRestaurantTables,
  saveRestaurantTable,
} from "../services/restaurant-table.service";

interface Snapshot {
  scope: string;
  attempt: number;
  tables: RestaurantTable[];
  error: string | null;
}

function sortTables(tables: RestaurantTable[]) {
  return [...tables].sort(
    (a, b) =>
      a.code.localeCompare(b.code, "es", {
        numeric: true,
        sensitivity: "base",
      }) || a.id.localeCompare(b.id, "es", { numeric: true })
  );
}

export function useRestaurantTables(session: AuthSession) {
  const { accessToken, business, membership } = session;
  const businessId = business.id;
  const allowed = session.authorization.roles.includes("ADMIN");
  const scope = [businessId, membership.id, accessToken].join(":");

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingScope, setPendingScope] = useState<string | null>(
    null
  );

  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();
    read.current = controller;

    void getRestaurantTables(accessToken, controller.signal)
      .then((tables) => {
        if (tables.some((table) => table.businessId !== businessId)) {
          throw new Error("Respuesta de otro negocio.");
        }

        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            tables: sortTables(tables),
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            tables: [],
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos consultar las mesas.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, businessId, allowed, scope, attempt]);

  useEffect(
    () => () => {
      write.current?.abort();
      write.current = null;
    },
    [scope, allowed]
  );

  const current =
    snapshot?.scope === scope && snapshot.attempt === attempt
      ? snapshot
      : null;

  const busy = pendingScope === scope;

  async function mutate(
    action: TableAction
  ): Promise<RestaurantTable> {
    if (!allowed || !current || current.error) {
      throw new Error("No puedes guardar mesas en este momento.");
    }

    if (write.current) {
      throw new Error("Espera a que termine el guardado.");
    }

    read.current?.abort();

    const controller = new AbortController();
    write.current = controller;
    setPendingScope(scope);

    try {
      const table = await saveRestaurantTable(
        action,
        accessToken,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (
        table.businessId !== businessId ||
        (action.kind !== "create" && table.id !== action.id)
      ) {
        throw new Error("No pudimos verificar la mesa guardada.");
      }

      setSnapshot((previous) => ({
        scope,
        attempt,
        error: null,
        tables: sortTables([
          ...(previous?.scope === scope
            ? previous.tables
            : []
          ).filter((item) => item.id !== table.id),
          table,
        ]),
      }));

      return table;
    } finally {
      if (write.current === controller) {
        write.current = null;
        setPendingScope(null);
      }
    }
  }

  return {
    tables: allowed ? (current?.tables ?? []) : [],
    loading: allowed && !current,
    error: allowed
      ? (current?.error ?? null)
      : "No tienes acceso a las mesas.",
    busy,
    mutate,
    retry: () => {
      if (!write.current) {
        setAttempt((value) => value + 1);
      }
    },
  };
}
