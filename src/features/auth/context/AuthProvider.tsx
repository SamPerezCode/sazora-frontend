import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ApiError,
  subscribeToUnauthorized,
} from "../../../lib/http/client";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "../services/auth-storage";
import {
  startSession,
  validateSession,
} from "../services/auth.service";
import type {
  AuthSession,
  AuthState,
  LoginRequest,
} from "../types/auth.types";
import { resolveSessionAccess } from "../utils/resolve-session-access";
import { AuthContext } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

// Compara la configuración de acceso.
// El orden de los roles o ubicaciones no cuenta como un cambio.
function accessKey(session: AuthSession): string {
  const { roles, locationAccess } = session.authorization;

  return JSON.stringify({
    roles: [...new Set(roles)].sort(),
    hasGlobalAccess: locationAccess.hasGlobalAccess,
    defaultLocationId: locationAccess.defaultLocationId,
    locations: locationAccess.locations
      .map((location) => ({
        id: location.id,
        code: location.code,
        name: location.name,
        locationType: location.locationType,
        isDefault: location.isDefault,
        isActive: location.isActive !== false,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: "checking",
  });

  const [retryCount, setRetryCount] = useState(0);
  const version = useRef(0);

  const refreshController = useRef<AbortController | null>(null);

  const [refreshingSession, setRefreshingSession] = useState(false);

  const [sessionRefreshMessage, setSessionRefreshMessage] =
    useState("");

  const logout = useCallback(() => {
    version.current += 1;

    refreshController.current?.abort();
    refreshController.current = null;

    setRefreshingSession(false);
    setSessionRefreshMessage("");

    clearStoredSession();
    setState({ status: "guest" });
  }, []);

  // Restauración inicial y reintento cuando no se pudo
  // comprobar la sesión.
  useEffect(() => {
    const controller = new AbortController();
    const currentVersion = version.current;
    const stored = readStoredSession();

    const unsubscribe = subscribeToUnauthorized((token) => {
      if (readStoredSession()?.accessToken === token) {
        logout();
      }
    });

    const restoration = stored
      ? validateSession(stored, controller.signal)
      : Promise.resolve(null);

    void restoration
      .then((session) => {
        if (
          controller.signal.aborted ||
          version.current !== currentVersion
        ) {
          return;
        }

        if (session) {
          writeStoredSession(session);
          setState({ status: "authenticated", session });
        } else {
          setState({ status: "guest" });
        }
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          version.current !== currentVersion
        ) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          logout();
          return;
        }

        setState({
          status: "unavailable",
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos comprobar tu sesión.",
        });
      });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [logout, retryCount]);

  // Actualiza la sesión conservando la pantalla visible.
  const refreshSession = useCallback(async (): Promise<void> => {
    if (
      state.status !== "authenticated" ||
      refreshController.current
    ) {
      return;
    }

    const previous = state.session;
    const controller = new AbortController();
    const currentVersion = version.current;

    refreshController.current = controller;
    setRefreshingSession(true);
    setSessionRefreshMessage("");

    try {
      const session = await validateSession(
        previous,
        controller.signal
      );

      if (
        controller.signal.aborted ||
        version.current !== currentVersion ||
        readStoredSession()?.accessToken !== previous.accessToken
      ) {
        return;
      }

      writeStoredSession(session);
      setState({ status: "authenticated", session });

      const access = resolveSessionAccess(session.authorization);

      if (access.kind === "blocked") {
        setSessionRefreshMessage(
          accessKey(previous) === accessKey(session)
            ? "Tu configuración todavía no ha cambiado."
            : "Tu configuración cambió, pero todavía necesita ser corregida por un administrador."
        );
      }

      // Si el acceso ya es válido, los guards existentes
      // redirigen usando la nueva sesión.
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        version.current !== currentVersion
      ) {
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        logout();
        return;
      }

      setSessionRefreshMessage(
        error instanceof ApiError
          ? error.message
          : "No pudimos comprobar tu acceso. Intenta nuevamente."
      );
    } finally {
      if (refreshController.current === controller) {
        refreshController.current = null;
        setRefreshingSession(false);
      }
    }
  }, [state, logout]);

  const accessToken =
    state.status === "authenticated"
      ? state.session.accessToken
      : null;

  // Reutiliza la misma actualización al regresar a la pestaña.
  useEffect(() => {
    if (!accessToken) return;

    function revalidate(): void {
      if (!document.hidden) {
        void refreshSession();
      }
    }

    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);

    const timer = window.setInterval(revalidate, 60_000);

    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      window.clearInterval(timer);
    };
  }, [accessToken, refreshSession]);

  useEffect(() => {
    return () => {
      version.current += 1;
      refreshController.current?.abort();
      refreshController.current = null;
    };
  }, []);

  async function login(
    input: LoginRequest,
    signal?: AbortSignal
  ): Promise<void> {
    const currentVersion = ++version.current;

    refreshController.current?.abort();
    refreshController.current = null;

    setRefreshingSession(false);
    setSessionRefreshMessage("");

    const session = await startSession(input, signal);

    signal?.throwIfAborted();

    if (version.current !== currentVersion) {
      throw new DOMException("Solicitud cancelada", "AbortError");
    }

    writeStoredSession(session);
    setState({ status: "authenticated", session });
  }

  function retrySession(): void {
    version.current += 1;

    refreshController.current?.abort();
    refreshController.current = null;

    setRefreshingSession(false);
    setSessionRefreshMessage("");

    setState({ status: "checking" });
    setRetryCount((current) => current + 1);
  }

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        logout,
        retrySession,
        refreshSession,
        refreshingSession,
        sessionRefreshMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
