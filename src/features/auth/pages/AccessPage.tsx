import { Navigate } from "react-router";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { getSessionDestination } from "../services/session-navigation";

export function AccessPage() {
  const {
    state,
    logout,
    refreshSession,
    refreshingSession,
    sessionRefreshMessage,
  } = useAuth();

  if (state.status !== "authenticated") {
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

  const destination = getSessionDestination(state.session);

  if (destination !== "/acceso") {
    return <Navigate to={destination} replace />;
  }

  return (
    <Card className="mx-auto w-full max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-heading">
        Acceso denegado
      </h1>

      <Alert>
        Tu sesión no tiene un módulo operativo autorizado. Solicita al
        administrador que revise tus permisos.
      </Alert>

      {sessionRefreshMessage && (
        <p role="status" className="text-sm text-muted">
          {sessionRefreshMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          loading={refreshingSession}
          loadingText="Comprobando…"
          onClick={() => void refreshSession()}
        >
          Actualizar acceso
        </Button>

        <Button variant="secondary" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </Card>
  );
}
