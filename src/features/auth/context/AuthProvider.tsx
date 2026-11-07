import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  ApiError,
  subscribeToUnauthorized,
} from "../../../lib/http/client";
import { disconnectSessionSockets } from "../../../lib/realtime/session-socket";
import { clearSalesLocationSelections } from "../../sales/hooks/useSalesLocations";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "../services/auth-storage";
import {
  clearPendingRoleSelection,
  readPendingRoleSelection,
  writePendingRoleSelection,
} from "../services/role-selection-storage";
import {
  selectSessionRole,
  startSession,
  validateSession,
} from "../services/auth.service";
import { loginDataSchema } from "../schemas/auth.schema";
import type {
  AuthSession,
  AuthState,
  LoginData,
  LoginRequest,
  RoleChoice,
} from "../types/auth.types";
import { AuthContext } from "./auth-context";

const EXPIRED_MESSAGE =
  "La selección de rol venció. Ingresa nuevamente tus credenciales.";

function clearRuntime(): void {
  disconnectSessionSockets();
  clearSalesLocationSelections();
}

function selectionErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  switch (error.code) {
    case "INVALID_ROLE_SELECTION_TOKEN":
      return EXPIRED_MESSAGE;

    case "ROLE_ASSIGNMENTS_CHANGED":
      return "Tus roles cambiaron. Inicia sesión nuevamente.";

    case "ROLE_NOT_ASSIGNED":
      return "El rol seleccionado ya no está disponible. Inicia sesión nuevamente.";

    default:
      return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "checking",
  });

  const stateRef = useRef<AuthState>(state);
  const version = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const refreshing = useRef<AbortController | null>(null);

  const [retryCount, setRetryCount] = useState(0);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [sessionRefreshMessage, setSessionRefreshMessage] =
    useState("");

  const publish = useCallback((next: AuthState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const resetGuest = useCallback(
    (message?: string) => {
      version.current += 1;

      operation.current?.abort();
      operation.current = null;

      refreshing.current?.abort();
      refreshing.current = null;

      clearStoredSession();
      clearPendingRoleSelection();
      clearRuntime();

      setRefreshingSession(false);
      setSessionRefreshMessage("");
      publish({ status: "guest", message });
    },
    [publish]
  );

  const logout = useCallback(() => {
    resetGuest();
  }, [resetGuest]);

  const cancelRoleSelection = useCallback(() => {
    resetGuest();
  }, [resetGuest]);

  const commitSession = useCallback(
    (session: AuthSession) => {
      writeStoredSession(session);
      clearPendingRoleSelection();
      publish({ status: "authenticated", session });
    },
    [publish]
  );

  useEffect(
    () =>
      subscribeToUnauthorized((token) => {
        if (readStoredSession()?.accessToken === token) {
          resetGuest("Tu sesión venció. Inicia sesión nuevamente.");
        }
      }),
    [resetGuest]
  );

  useEffect(() => {
    const controller = new AbortController();
    const expectedVersion = version.current;
    const stored = readStoredSession();

    const isCurrent = () =>
      !controller.signal.aborted &&
      version.current === expectedVersion;

    if (!stored) {
      queueMicrotask(() => {
        if (!isCurrent()) return;

        const pending = readPendingRoleSelection();

        if (pending && pending.expiresAt > Date.now()) {
          publish({ status: "selecting-role", pending });
          return;
        }

        clearPendingRoleSelection();

        publish({
          status: "guest",
          message: pending ? EXPIRED_MESSAGE : undefined,
        });
      });

      return () => controller.abort();
    }

    clearPendingRoleSelection();

    void validateSession(stored, controller.signal)
      .then((session) => {
        if (isCurrent()) commitSession(session);
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;

        if (error instanceof ApiError && error.status === 401) {
          resetGuest("Tu sesión venció. Inicia sesión nuevamente.");
          return;
        }

        publish({
          status: "unavailable",
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos comprobar tu sesión.",
        });
      });

    return () => controller.abort();
  }, [retryCount, commitSession, publish, resetGuest]);

  useEffect(() => {
    if (state.status !== "selecting-role") return;

    const pending = state.pending;

    const expire = () => {
      const current = stateRef.current;

      if (
        current.status === "selecting-role" &&
        current.pending.roleSelectionToken ===
          pending.roleSelectionToken &&
        Date.now() >= pending.expiresAt
      ) {
        resetGuest(EXPIRED_MESSAGE);
      }
    };

    const timer = window.setTimeout(
      expire,
      Math.max(0, pending.expiresAt - Date.now())
    );

    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expire);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [state, resetGuest]);

  async function completeIdentity(
    identity: LoginData,
    signal: AbortSignal,
    expectedVersion: number
  ): Promise<void> {
    signal.throwIfAborted();

    if (version.current !== expectedVersion) return;

    // Conserva el token definitivo para reintentar GET /auth/session
    // si la red falla después de completar el login o la selección.
    writeStoredSession(identity);
    clearPendingRoleSelection();

    try {
      const session = await validateSession(identity, signal);

      if (!signal.aborted && version.current === expectedVersion) {
        commitSession(session);
      }
    } catch (error: unknown) {
      if (signal.aborted || version.current !== expectedVersion) {
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        resetGuest("Tu sesión venció. Inicia sesión nuevamente.");
        return;
      }

      publish({
        status: "unavailable",
        message:
          error instanceof ApiError
            ? error.message
            : "No pudimos comprobar tu sesión.",
      });
    }
  }

  async function login(
    input: LoginRequest,
    externalSignal?: AbortSignal
  ): Promise<void> {
    if (operation.current) {
      throw new ApiError(
        409,
        "REQUEST_PENDING",
        "Espera a que termine la solicitud."
      );
    }

    const controller = new AbortController();
    const signal = externalSignal
      ? AbortSignal.any([controller.signal, externalSignal])
      : controller.signal;

    const expectedVersion = ++version.current;
    const startedAt = Date.now();

    operation.current = controller;
    refreshing.current?.abort();
    refreshing.current = null;

    clearStoredSession();
    clearPendingRoleSelection();
    clearRuntime();

    setRefreshingSession(false);
    setSessionRefreshMessage("");

    try {
      const result = await startSession(input, signal);

      signal.throwIfAborted();

      if (version.current !== expectedVersion) return;

      if (result.requiresRoleSelection) {
        const pending = {
          ...result,
          expiresAt:
            startedAt + result.roleSelectionExpiresInSeconds * 1000,
        };

        if (pending.expiresAt <= Date.now()) {
          resetGuest(EXPIRED_MESSAGE);
          return;
        }

        writePendingRoleSelection(pending);
        publish({ status: "selecting-role", pending });
        return;
      }

      const identity = loginDataSchema.parse({
        ...result,
        membership: {
          ...result.membership,
          assignedRoles: result.membership.roles,
        },
      });

      await completeIdentity(identity, signal, expectedVersion);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
      }
    }
  }

  async function selectRole(choice: RoleChoice): Promise<void> {
    const current = stateRef.current;

    if (current.status !== "selecting-role") {
      throw new ApiError(
        401,
        "INVALID_ROLE_SELECTION_TOKEN",
        EXPIRED_MESSAGE
      );
    }

    if (operation.current) {
      throw new ApiError(
        409,
        "REQUEST_PENDING",
        "Espera a que termine la solicitud."
      );
    }

    const controller = new AbortController();
    const expectedVersion = ++version.current;
    operation.current = controller;

    try {
      const identity = await selectSessionRole(
        current.pending,
        choice,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (version.current !== expectedVersion) return;

      // La selección ya terminó: dejamos de mostrar el formulario
      // y de aplicar el vencimiento del token temporal.
      writeStoredSession(identity);
      clearPendingRoleSelection();
      publish({ status: "checking" });

      await completeIdentity(
        identity,
        controller.signal,
        expectedVersion
      );
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        version.current !== expectedVersion
      ) {
        return;
      }

      const message = selectionErrorMessage(error);

      if (message) {
        resetGuest(message);
        return;
      }

      if (Date.now() >= current.pending.expiresAt) {
        resetGuest(EXPIRED_MESSAGE);
        return;
      }

      // Los errores de red mantienen la selección para reintentar.
      throw error;
    } finally {
      if (operation.current === controller) {
        operation.current = null;
      }
    }
  }

  const refreshSession = useCallback(async (): Promise<void> => {
    const current = stateRef.current;

    if (current.status !== "authenticated" || refreshing.current) {
      return;
    }

    const controller = new AbortController();
    const expectedVersion = version.current;
    refreshing.current = controller;

    setRefreshingSession(true);
    setSessionRefreshMessage("");

    try {
      const session = await validateSession(
        current.session,
        controller.signal
      );

      if (
        controller.signal.aborted ||
        version.current !== expectedVersion
      ) {
        return;
      }

      commitSession(session);
      setSessionRefreshMessage("Acceso actualizado.");
    } catch (error: unknown) {
      if (
        controller.signal.aborted ||
        version.current !== expectedVersion
      ) {
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        resetGuest("Tu sesión venció. Inicia sesión nuevamente.");
        return;
      }

      setSessionRefreshMessage(
        error instanceof ApiError
          ? error.message
          : "No pudimos actualizar tu acceso."
      );
    } finally {
      if (refreshing.current === controller) {
        refreshing.current = null;
        setRefreshingSession(false);
      }
    }
  }, [commitSession, resetGuest]);

  const authenticated = state.status === "authenticated";

  useEffect(() => {
    if (!authenticated) return;

    const revalidate = () => {
      if (!document.hidden) void refreshSession();
    };

    const timer = window.setInterval(revalidate, 60_000);

    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [authenticated, refreshSession]);

  useEffect(
    () => () => {
      version.current += 1;
      operation.current?.abort();
      refreshing.current?.abort();
      disconnectSessionSockets();
    },
    []
  );

  function retrySession(): void {
    version.current += 1;
    operation.current?.abort();
    operation.current = null;
    refreshing.current?.abort();
    refreshing.current = null;

    setRefreshingSession(false);
    setSessionRefreshMessage("");
    publish({ status: "checking" });
    setRetryCount((value) => value + 1);
  }

  // Desmonta consultas y estado de pantallas si cambia la autorización.
  const contentKey =
    state.status === "authenticated"
      ? JSON.stringify(state.session.authorization)
      : state.status;

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        selectRole,
        cancelRoleSelection,
        logout,
        retrySession,
        refreshSession,
        refreshingSession,
        sessionRefreshMessage,
      }}
    >
      <Fragment key={contentKey}>{children}</Fragment>
    </AuthContext.Provider>
  );
}
