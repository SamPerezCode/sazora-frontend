import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Alert } from "../../components/feedback/Alert";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { resolveSessionAccess } from "../../features/auth/utils/resolve-session-access";
import {
  getSessionDestination,
  rememberModule,
} from "../../features/auth/services/session-navigation";

export function SessionBoundary() {
  const { state, retrySession, logout } = useAuth();

  if (state.status === "checking") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <LoadingState message="Comprobando tu sesión…" />
      </main>
    );
  }

  if (state.status === "unavailable") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <section className="w-full max-w-md space-y-5">
          <h1 className="text-xl font-semibold text-heading">
            No pudimos comprobar tu sesión
          </h1>

          <Alert>{state.message}</Alert>

          <div className="flex flex-wrap gap-3">
            <Button onClick={retrySession}>Reintentar</Button>

            <Button variant="secondary" onClick={logout}>
              Volver al acceso
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return <Outlet />;
}

export function RequireAuth() {
  const { state } = useAuth();

  if (state.status === "authenticated") {
    return <Outlet />;
  }

  return (
    <Navigate
      to={
        state.status === "selecting-role"
          ? "/seleccionar-rol"
          : "/login"
      }
      replace
    />
  );
}

export function GuestOnly() {
  const { state } = useAuth();

  if (state.status === "selecting-role") {
    return <Navigate to="/seleccionar-rol" replace />;
  }

  if (state.status === "authenticated") {
    return (
      <Navigate to={getSessionDestination(state.session)} replace />
    );
  }

  return <Outlet />;
}

export function SessionHome() {
  const { state } = useAuth();

  const target =
    state.status === "authenticated"
      ? getSessionDestination(state.session)
      : state.status === "selecting-role"
        ? "/seleccionar-rol"
        : "/login";

  return <Navigate to={target} replace />;
}

export function RequireAccess() {
  const { state } = useAuth();
  const { pathname, search } = useLocation();

  const session =
    state.status === "authenticated" ? state.session : null;

  const access = session
    ? resolveSessionAccess(session.authorization)
    : null;

  const path = pathname.replace(/\/+$/, "") || "/";
  const allowed = access?.allowedPaths.includes(path) ?? false;

  useEffect(() => {
    if (session && allowed) {
      rememberModule(session, pathname + search);
    }
  }, [session, allowed, pathname, search]);

  if (!session) {
    return (
      <Navigate
        to={
          state.status === "selecting-role"
            ? "/seleccionar-rol"
            : "/login"
        }
        replace
      />
    );
  }

  return allowed ? (
    <Outlet />
  ) : (
    <Navigate to={getSessionDestination(session)} replace />
  );
}
