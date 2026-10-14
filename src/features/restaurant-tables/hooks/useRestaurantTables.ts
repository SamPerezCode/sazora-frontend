import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { useAuth } from "../../auth/hooks/useAuth";
import type { AuthSession } from "../../auth/types/auth.types";
import type { BusinessLocation } from "../../business/schemas/organization.schema";
import { getLocations } from "../../business/services/organization.service";
import type { RestaurantTable } from "../schemas/restaurant-table.schema";
import {
  getRestaurantTables,
  tableErrorMessage,
} from "../services/restaurant-table.service";

interface Snapshot {
  key: string;
  tables: RestaurantTable[];
  locations: BusinessLocation[];
  error: string;
}

export function useRestaurantTables(session: AuthSession) {
  const { logout } = useAuth();
  const allowed = session.authorization.roles.includes("ADMIN");

  const [locationId, setLocationId] = useState("");
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [denied, setDenied] = useState("");

  const [noticeMessage, showNoticeMessage] = useTimedMessage(5000);
  const [noticeError, setNoticeError] = useState(false);

  const key = locationId + ":" + revision;

  const retry = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const notify = useCallback(
    (message: string, error = false) => {
      setNoticeError(error);
      showNoticeMessage(message);
    },
    [showNoticeMessage]
  );

  const handleError = useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiError)) return false;

      if (
        error.status === 401 ||
        error.code === "AUTHENTICATION_REQUIRED"
      ) {
        logout();
        return true;
      }

      if (
        error.status === 403 ||
        error.code === "FORBIDDEN" ||
        error.code === "LOCATION_ACCESS_DENIED"
      ) {
        setDenied(tableErrorMessage(error));
        return true;
      }

      if (error.code === "RESTAURANT_TABLE_NOT_FOUND") {
        notify(tableErrorMessage(error), true);
        retry();
        return true;
      }

      if (error.code === "LOCATION_NOT_FOUND" && locationId) {
        setLocationId("");

        notify(
          "El punto de venta no existe. Mostramos todos los puntos de venta.",
          true
        );

        retry();
        return true;
      }

      return false;
    },
    [locationId, logout, notify, retry]
  );

  useEffect(() => {
    if (!allowed || denied) return;

    const controller = new AbortController();

    void Promise.all([
      getLocations(session, controller.signal),
      getRestaurantTables(session.accessToken, controller.signal, {
        locationId: locationId || undefined,
        activeOnly: false,
      }),
    ])
      .then(([locations, tables]) => {
        controller.signal.throwIfAborted();

        if (
          tables.some(
            (table) =>
              table.businessId !== session.business.id ||
              (locationId && table.locationId !== locationId)
          )
        ) {
          throw new ApiError(
            502,
            "INVALID_RESPONSE",
            "Respuesta inesperada."
          );
        }

        setSnapshot({
          key,
          tables,
          error: "",
          locations: locations.filter(
            (location) => location.locationType === "POINT_OF_SALE"
          ),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || handleError(error)) {
          return;
        }

        setSnapshot({
          key,
          tables: [],
          locations: [],
          error: tableErrorMessage(error),
        });
      });

    return () => controller.abort();
  }, [allowed, denied, handleError, key, locationId, session]);

  const current = snapshot?.key === key ? snapshot : null;

  return {
    tables: current?.tables ?? [],
    locations: snapshot?.locations ?? [],
    loading: allowed && !denied && !current,
    error: current?.error ?? "",

    denied: allowed
      ? denied
      : "No tienes permisos para administrar las mesas.",

    locationId,

    notice: {
      message: noticeMessage,
      error: noticeError,
    },

    retry,
    handleError,

    selectLocation: (id: string) => {
      if (
        !id ||
        current?.locations.some((location) => location.id === id)
      ) {
        setLocationId(id);
      }
    },

    saved: (message: string) => {
      notify(message);
      retry();
    },
  };
}
