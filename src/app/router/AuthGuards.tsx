import { Navigate, Outlet } from "react-router";
import { Alert } from "../../components/feedback/Alert";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/hooks/useAuth";

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
    <Navigate to="/panel" replace />
  ) : (
    <Outlet />
  );
}
