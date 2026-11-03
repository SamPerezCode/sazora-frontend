import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Alert } from "../../components/feedback/Alert";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useBusinessProfile } from "../../features/business/hooks/useBusinessProfile";
import { useDashboard } from "../../features/dashboard/hooks/useDashboard";
import { businessDate } from "../../features/dashboard/utils/dashboard-format";
import { resolveSessionAccess } from "../../features/auth/utils/resolve-session-access";
import {
  readSidebarCollapsed,
  saveSidebarCollapsed,
} from "../../lib/storage/layout-preferences";
import { getNavigation } from "../navigation";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import type { AppShellContext } from "./shell-context";

export function AppShell() {
  const { state, logout } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  const session =
    state.status === "authenticated" ? state.session : null;

  const { business, settings, error, retry } =
    useBusinessProfile(session);

  const isSettings = location.pathname === "/configuracion";
  const isSales = location.pathname === "/ventas";
  const isPanel = location.pathname === "/panel";
  const isInventory = location.pathname === "/inventario";
  const dashboard = useDashboard(session, isPanel);

  if (!session || !business) {
    return null;
  }

  const access = resolveSessionAccess(session.authorization);
  const pathname = location.pathname.replace(/\/+$/, "") || "/";

  const operatingLocation =
    !isSales &&
    access.workspaces.some((workspace) => workspace.path === pathname)
      ? access.defaultLocation
      : null;

  const normalizedLocationName =
    operatingLocation?.name
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("es-CO") ?? "";

  const operatingLocationLabel = operatingLocation
    ? {
        name:
          normalizedLocationName
            .charAt(0)
            .toLocaleUpperCase("es-CO") +
          normalizedLocationName.slice(1),
        code: operatingLocation.code,
      }
    : undefined;

  const current = getNavigation(session.authorization)
    .flatMap((item) =>
      item.status === "group" ? item.children : [item]
    )
    .find(
      (item) =>
        item.status === "ready" && item.to === location.pathname
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

      <div
        className={
          "shell-workspace " +
          (isInventory
            ? "[&_.shell-header-copy_h1]:text-[20px] [&_.shell-header-copy_h1]:leading-tight [&_.shell-header-copy_h1]:whitespace-normal md:[&_.shell-header-copy_h1]:text-[30px] [&_.shell-header-copy_p]:text-[13px] md:[&_.shell-header-copy_p]:text-[16px]"
            : "")
        }
      >
        <AppHeader
          key={`${location.key}:${session.membership.id}`}
          title={
            isPanel
              ? "Resumen general"
              : isSettings
                ? "Configuración"
                : isInventory
                  ? "Gestión de inventario"
                  : (current?.label ?? "Acceso")
          }
          subtitle={
            isSales
              ? "Órdenes por punto de venta"
              : isSettings
                ? "Administra la identidad, información fiscal, sedes y operación general."
                : isInventory
                  ? "Existencias y costos por ubicación"
                  : isPanel && dashboard.data
                    ? `${businessDate(dashboard.data.period.today)} · ${business.name}`
                    : business.name
          }
          session={session}
          business={business}
          operatingLocation={operatingLocationLabel}
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

          {typeof location.state?.accessNotice === "string" && (
            <Alert className="mb-5">
              {location.state.accessNotice}
            </Alert>
          )}

          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}
