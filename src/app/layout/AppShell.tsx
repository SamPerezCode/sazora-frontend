import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Alert } from "../../components/feedback/Alert";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useBusinessProfile } from "../../features/business/useBusinessProfile";
import { useDashboard } from "../../features/dashboard/hooks/useDashboard";
import { businessDate } from "../../features/dashboard/utils/dashboard-format";
import {
  readSidebarCollapsed,
  saveSidebarCollapsed,
} from "../../lib/storage/layout-preferences";
import { getNavigation } from "../navigation";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileNavigation } from "./MobileNavigation";
import type { AppShellContext } from "./shell-context";

export function AppShell() {
  const { state, logout } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  const session =
    state.status === "authenticated" ? state.session : null;

  const { business, settings, error, retry } =
    useBusinessProfile(session);

  const isSettings = location.pathname === "/mi-negocio";
  const isPanel = location.pathname === "/panel";
  const dashboard = useDashboard(session, isPanel);

  if (!session || !business) {
    return null;
  }

  const current = getNavigation(session.authorization.roles).find(
    (item) => item.status === "ready" && item.to === location.pathname
  );

  const context: AppShellContext = {
    session,
    dashboard,
    business,
    settings,
  };

  function toggleSidebar(): void {
    const next = !collapsed;

    setCollapsed(next);
    saveSidebarCollapsed(next);
  }

  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <a href="#app-content" className="shell-skip-link">
        Saltar al contenido
      </a>

      <div className="shell-desktop-sidebar">
        <AppSidebar
          session={session}
          business={business}
          collapsed={collapsed}
          onToggle={toggleSidebar}
        />
      </div>

      <div className="shell-workspace">
        <AppHeader
          key={`${location.key}:${session.membership.id}`}
          title={
            isPanel
              ? `Buen servicio, ${session.user.fullName.trim().split(/\s+/)[0]}`
              : isSettings
                ? "Mi negocio"
                : (current?.label ?? "Panel")
          }
          subtitle={
            isSettings
              ? "Personaliza el perfil, menú y documentos de tu restaurante."
              : isPanel && dashboard.data
                ? `${businessDate(dashboard.data.period.today)} · ${business.name}`
                : business.name
          }
          session={session}
          business={business}
          showCashAction={isPanel}
          onLogout={logout}
        />

        <main
          id="app-content"
          tabIndex={-1}
          className="shell-content"
        >
          {error && !isSettings && (
            <Alert className="mb-5">
              <p>{error}</p>

              <Button
                size="sm"
                variant="secondary"
                onClick={retry}
                className="mt-3"
              >
                Reintentar
              </Button>
            </Alert>
          )}

          <Outlet context={context} />
        </main>
      </div>

      <MobileNavigation
        key={location.key}
        roles={session.authorization.roles}
        business={business}
        onLogout={logout}
      />
    </div>
  );
}
