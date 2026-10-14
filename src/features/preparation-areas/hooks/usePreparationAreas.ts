import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth";
import type { AuthSession } from "../../auth/types/auth.types";
import { resolveSessionAccess } from "../../auth/utils/resolve-session-access";
import { getLocations } from "../../business/services/organization.service";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { ApiError } from "../../../lib/http/client";
import type {
  AreaLocation,
  PreparationArea,
} from "../schemas/preparation-area.schema";
import { getPreparationAreas } from "../services/preparation-area.service";

interface Snapshot {
  key: string;
  areas: PreparationArea[];
  locations: AreaLocation[];
  error: string;
}

export function usePreparationAreas(session: AuthSession) {
  const navigate = useNavigate();
  const { refreshSession, logout } = useAuth();

  const [locationId, setLocationId] = useState("");
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [noticeMessage, showNoticeMessage] = useTimedMessage(5000);
  const [noticeError, setNoticeError] = useState(false);

  const setNotice = useCallback(
    (next: { message: string; error: boolean }) => {
      setNoticeError(next.error);
      showNoticeMessage(next.message);
    },
    [showNoticeMessage]
  );

  const notice = {
    message: noticeMessage,
    error: noticeError,
  };
  const [denied, setDenied] = useState(false);

  const permissionChecked = useRef(false);
  const allowed = session.authorization.roles.includes("ADMIN");
  const key = `${locationId}:${revision}`;

  const retry = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const handleError = useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiError)) return false;

      if (error.code === "AUTHENTICATION_REQUIRED") {
        logout();
        return true;
      }

      if (
        error.code === "FORBIDDEN" ||
        error.code === "LOCATION_ACCESS_DENIED"
      ) {
        setDenied(true);

        if (!permissionChecked.current) {
          permissionChecked.current = true;
          void refreshSession();
        }

        if (error.code === "FORBIDDEN") {
          void navigate(
            resolveSessionAccess(session.authorization).home,
            {
              replace: true,
              state: {
                accessNotice:
                  "No tienes permisos para administrar las áreas de preparación.",
              },
            }
          );
        }

        return true;
      }

      if (error.code === "LOCATION_NOT_FOUND") {
        setLocationId("");

        setNotice({
          message:
            "La ubicación ya no existe. Mostramos todas las ubicaciones.",
          error: true,
        });

        retry();
        return true;
      }

      if (error.code === "PREPARATION_AREA_NOT_FOUND") {
        setNotice({
          message: "El área ya no está disponible.",
          error: true,
        });

        retry();
        return true;
      }

      return false;
    },
    [
      logout,
      navigate,
      refreshSession,
      retry,
      session.authorization,
      setNotice,
    ]
  );

  useEffect(() => {
    if (!allowed || denied) return;

    const controller = new AbortController();

    void Promise.all([
      getLocations(session, controller.signal),
      getPreparationAreas(session.accessToken, controller.signal, {
        locationId: locationId || undefined,
        activeOnly: false,
      }),
    ])
      .then(([locations, areas]) => {
        controller.signal.throwIfAborted();

        if (
          areas.some(
            (area) => area.businessId !== session.business.id
          )
        ) {
          throw new ApiError(
            502,
            "INVALID_RESPONSE",
            "No pudimos verificar las áreas."
          );
        }

        setSnapshot({
          key,
          locations,
          areas,
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || handleError(error)) {
          return;
        }

        setSnapshot({
          key,
          locations: [],
          areas: [],
          error:
            error instanceof ApiError
              ? error.message
              : "No pudimos cargar la información.",
        });
      });

    return () => controller.abort();
  }, [allowed, denied, handleError, key, locationId, session]);

  const current = snapshot?.key === key ? snapshot : null;

  return {
    areas: current?.areas ?? [],
    locations: snapshot?.locations ?? [],
    loading: allowed && !denied && !current,
    error: current?.error ?? "",
    denied: denied || !allowed,
    locationId,
    notice,
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
      setNotice({ message, error: false });
      retry();
    },
  };
}
