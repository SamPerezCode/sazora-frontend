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
import type { AuthState, LoginRequest } from "../types/auth.types";
import { AuthContext } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: "checking",
  });
  const [retryCount, setRetryCount] = useState(0);
  const version = useRef(0);

  const logout = useCallback(() => {
    version.current += 1;
    clearStoredSession();
    setState({ status: "guest" });
  }, []);

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

  const accessToken =
    state.status === "authenticated"
      ? state.session.accessToken
      : null;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let pending: AbortController | null = null;

    function revalidate(): void {
      if (document.hidden || pending) {
        return;
      }

      const stored = readStoredSession();

      if (!stored || stored.accessToken !== accessToken) {
        return;
      }

      const controller = new AbortController();
      const currentVersion = version.current;
      pending = controller;

      void validateSession(stored, controller.signal)
        .then((session) => {
          if (
            controller.signal.aborted ||
            version.current !== currentVersion ||
            readStoredSession()?.accessToken !== accessToken
          ) {
            return;
          }

          writeStoredSession(session);
          setState({ status: "authenticated", session });
        })
        .catch((error: unknown) => {
          if (
            !controller.signal.aborted &&
            version.current === currentVersion &&
            error instanceof ApiError &&
            error.status === 401
          ) {
            logout();
          }
          // Los errores temporales de conexión no cierran la sesión.
        })
        .finally(() => {
          pending = null;
        });
    }

    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    const timer = window.setInterval(revalidate, 60_000);

    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      window.clearInterval(timer);
      pending?.abort();
    };
  }, [accessToken, logout]);

  async function login(
    input: LoginRequest,
    signal?: AbortSignal
  ): Promise<void> {
    const currentVersion = ++version.current;
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
    setState({ status: "checking" });
    setRetryCount((current) => current + 1);
  }

  return (
    <AuthContext.Provider
      value={{ state, login, logout, retrySession }}
    >
      {children}
    </AuthContext.Provider>
  );
}
