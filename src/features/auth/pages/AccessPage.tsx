import { Link, Navigate, useLocation } from "react-router";
import { MapPin, TriangleAlert } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { ROLE_LABELS, ROLE_PRESENTATION } from "../role-presentation";
import { resolveSessionAccess } from "../utils/resolve-session-access";

const locationLabels = {
  POINT_OF_SALE: "Punto de venta",
  PRODUCTION_WAREHOUSE: "Planta de producción y bodega",
};

const messages = {
  "no-locations": {
    title: "Sin ubicación asignada",
    description:
      "Tu cuenta está activa, pero todavía no tienes una sede o planta asignada. Comunícate con un administrador.",
  },
  "no-default": {
    title: "Sin ubicación predeterminada",
    description:
      "Tienes ubicaciones asignadas, pero un administrador debe configurar cuál utilizarás inicialmente.",
  },
  incompatible: {
    title: "Configuración de acceso incompatible",
    description:
      "Tus roles y tu ubicación predeterminada no permiten abrir un espacio de trabajo. Solicita a un administrador que revise tu configuración.",
  },
};

function formatName(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CO");

  return (
    normalized.charAt(0).toLocaleUpperCase("es-CO") +
    normalized.slice(1)
  );
}

export function AccessPage() {
  const { state, logout, retrySession } = useAuth();
  const { pathname } = useLocation();

  if (state.status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  const session = state.session.authorization;
  const access = resolveSessionAccess(session);
  const location = access.defaultLocation;

  const path = pathname.replace(/\/+$/, "");
  const workspace = access.workspaces.find(
    (item) => item.path === path
  );

  const choosing = access.kind === "choose" && path === "/espacios";

  const message = access.issue ? messages[access.issue] : null;

  const Icon = workspace
    ? ROLE_PRESENTATION[workspace.role].icon
    : message
      ? TriangleAlert
      : MapPin;

  if (!message && !choosing && !workspace) {
    return <Navigate to={access.home} replace />;
  }

  return (
    <Card className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <Icon aria-hidden="true" size={28} className="text-accent" />

        <h1 className="text-xl font-bold text-heading sm:text-2xl">
          {message?.title ??
            (choosing
              ? "Elige tu espacio de trabajo"
              : workspace?.id === "production"
                ? "Producción en preparación"
                : "Módulo en preparación")}
        </h1>

        <p className="text-sm leading-relaxed text-muted">
          {message?.description ??
            (choosing
              ? "Selecciona el módulo al que deseas entrar. Todos utilizan tu ubicación predeterminada."
              : `Tienes acceso a ${workspace?.label}. El módulo operativo todavía se está preparando.`)}
        </p>
      </div>

      {location && (
        <dl className="grid gap-3 rounded-2xl border border-outline bg-secondary p-4 text-sm">
          <div>
            <dt className="text-muted">Ubicación predeterminada</dt>
            <dd className="mt-1 break-words font-semibold text-heading">
              {formatName(location.name)}
            </dd>
          </div>

          <div>
            <dt className="text-muted">Código</dt>
            <dd className="mt-1 break-words text-heading">
              {location.code}
            </dd>
          </div>

          <div>
            <dt className="text-muted">Tipo</dt>
            <dd className="mt-1 text-heading">
              {locationLabels[location.locationType]}
            </dd>
          </div>

          {location.isActive === false && (
            <div>
              <dt className="text-muted">Estado</dt>
              <dd className="mt-1 text-heading">Inactiva</dd>
            </div>
          )}
        </dl>
      )}

      {message && (
        <div className="space-y-2 text-sm">
          {!location && session.locationAccess.defaultLocationId && (
            <p className="break-words text-muted">
              ID de ubicación predeterminada:{" "}
              {session.locationAccess.defaultLocationId}
            </p>
          )}

          <p className="font-semibold text-heading">
            Roles asignados
          </p>

          <p className="text-muted">
            {session.roles
              .map((role) => ROLE_LABELS[role])
              .join(" · ")}
          </p>
        </div>
      )}

      {choosing && (
        <div className="grid gap-3 sm:grid-cols-2">
          {access.workspaces.map((item) => {
            const WorkspaceIcon = ROLE_PRESENTATION[item.role].icon;

            return (
              <Link
                key={item.id}
                to={item.path}
                className="flex min-w-0 items-start gap-3 rounded-2xl border border-outline p-4 text-heading transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <WorkspaceIcon
                  aria-hidden="true"
                  size={22}
                  className="shrink-0 text-accent"
                />

                <span className="min-w-0">
                  <span className="block font-semibold">
                    {item.label}
                  </span>

                  <span className="mt-1 block text-sm text-muted">
                    {item.pending
                      ? "Módulo en preparación"
                      : "Entrar al módulo"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline pt-4">
        {access.kind === "choose" && !choosing && (
          <Link
            to="/espacios"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-heading focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cambiar espacio de trabajo
          </Link>
        )}

        {message && (
          <Button variant="secondary" onClick={retrySession}>
            Volver a comprobar
          </Button>
        )}

        <Button variant="secondary" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </Card>
  );
}
