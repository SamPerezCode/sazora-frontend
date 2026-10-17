import { Navigate, Outlet, useLocation } from "react-router";
import { Alert } from "../../components/feedback/Alert";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/hooks/useAuth";
import type { ReactNode } from "react";
import type { RoleCode } from "../../features/auth/types/auth.types";
import { resolveSessionAccess } from "../../features/auth/utils/resolve-session-access";

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

  return state.status === "authenticated" ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
}

export function GuestOnly() {
  const { state } = useAuth();

  return state.status === "authenticated" ? (
    <Navigate
      to={resolveSessionAccess(state.session.authorization).home}
      replace
    />
  ) : (
    <Outlet />
  );
}

export function SessionHome() {
  const { state } = useAuth();

  return (
    <Navigate
      to={
        state.status === "authenticated"
          ? resolveSessionAccess(state.session.authorization).home
          : "/login"
      }
      replace
    />
  );
}

export function RequireAccess() {
  const { state } = useAuth();
  const { pathname } = useLocation();

  if (state.status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  const access = resolveSessionAccess(state.session.authorization);

  const path = pathname.replace(/\/+$/, "") || "/";

  if (
    path === "/estadisticas" &&
    !state.session.authorization.roles.includes("ADMIN")
  ) {
    return (
      <main className="p-6">
        <Alert>
          No tienes permisos para consultar estos informes.
        </Alert>
      </main>
    );
  }

  return access.allowedPaths.includes(path) ? (
    <Outlet />
  ) : (
    <Navigate to={access.home} replace />
  );
}
export function RequireRole({
  role,
  children,
}: {
  role: RoleCode;
  children: ReactNode;
}) {
  const { state } = useAuth();

  if (state.status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return state.session.authorization.roles.includes(role) ? (
    children
  ) : (
    <Navigate to="/panel" replace />
  );
}
