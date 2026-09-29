import { RefreshCw } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { getNavigation, ROLE_LABELS } from "../../../app/navigation";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import {
  CriticalInventoryCard,
  DashboardSummary,
  OrdersInProgressCard,
  TopProductsCard,
} from "../components/DashboardSections";
import { WeeklySalesCard } from "../components/WeeklySalesCard";

function WelcomePanel() {
  const { session, business } = useAppShell();

  const modules = getNavigation(session.authorization.roles).filter(
    (item) => item.id !== "panel"
  );

  return (
    <div className="space-y-6">
      <Card aria-labelledby="welcome-heading">
        <div className="flex items-start gap-4">
          <Avatar
            name={business.name}
            src={business.logoUrl}
            size="lg"
          />

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Bienvenido a tu espacio de trabajo
            </p>

            <h2
              id="welcome-heading"
              className="mt-2 break-words text-xl font-bold text-heading sm:text-2xl"
            >
              Hola, {session.user.fullName}
            </h2>

            <p className="mt-2 break-words text-sm leading-relaxed text-muted">
              Estás en {business.name}.
            </p>

            <ul
              aria-label="Tus roles en este negocio"
              className="mt-4 flex flex-wrap gap-2"
            >
              {session.authorization.roles.map((role) => (
                <li
                  key={role}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-heading"
                >
                  {ROLE_LABELS[role]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <section aria-labelledby="modules-heading">
        <h2
          id="modules-heading"
          className="text-lg font-bold text-heading"
        >
          Tu espacio de trabajo
        </h2>

        <p className="mt-1 text-sm text-muted">
          Secciones de tu rol. Las marcadas como próximas aún no están
          disponibles.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.id} aria-label={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon
                      aria-hidden="true"
                      size={20}
                      strokeWidth={1.75}
                    />
                  </span>

                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.6875rem] text-muted">
                    Próximamente
                  </span>
                </div>

                <h3 className="mt-4 text-sm font-semibold text-heading">
                  {item.label}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function DashboardPage() {
  const { session, dashboard } = useAppShell();

  if (!session.authorization.roles.includes("ADMIN")) {
    return <WelcomePanel />;
  }

  const { data, loading, error, refresh } = dashboard;

  return (
    <div className="space-y-5">
      {error && (
        <Alert>
          {error.message}

          {data && (
            <p className="mt-1">
              Se muestran los datos de la última consulta correcta.
            </p>
          )}
        </Alert>
      )}

      {!data && loading && (
        <Card className="py-16">
          <LoadingState message="Cargando el resumen del negocio…" />
        </Card>
      )}

      {data && (
        <div aria-busy={loading} className="space-y-5">
          <DashboardSummary data={data} />

          <div className="dashboard-middle-grid">
            <WeeklySalesCard
              sales={data.weeklySales}
              currency={data.business.currencyCode}
            />

            <TopProductsCard data={data} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <OrdersInProgressCard data={data} />
            <CriticalInventoryCard data={data} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {data
            ? `Actualizado: ${new Intl.DateTimeFormat("es-CO", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: data.period.timezone,
              }).format(new Date(data.generatedAt))}`
            : "Resumen del negocio"}
        </p>

        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          loadingText="Actualizando…"
          onClick={refresh}
        >
          <RefreshCw
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
          />
          {error ? "Reintentar" : "Actualizar"}
        </Button>
      </div>
    </div>
  );
}
