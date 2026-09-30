import { NavLink, useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import symbol from "../../assets/brand/sazora_icon_dark.png";
import { Avatar } from "../../components/ui/Avatar";
import { IconButton } from "../../components/ui/IconButton";
import { SidebarGroup } from "./SidebarGroup";
import type { BusinessIdentity } from "../../features/business/schemas/business-profile.schema";
import type { AuthSession } from "../../features/auth/types/auth.types";
import { getNavigation, ROLE_LABELS } from "../navigation";

interface AppSidebarProps {
  session: AuthSession;
  business: BusinessIdentity;
  collapsed: boolean;
  mobile?: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({
  session,
  business,
  collapsed,
  mobile = false,
  onToggle,
  onNavigate,
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const items = getNavigation(session.authorization.roles);
  const settings = items.find((item) => item.group === "business");

  const ToggleIcon = mobile
    ? X
    : collapsed
      ? PanelLeftOpen
      : PanelLeftClose;

  return (
    <aside className="shell-sidebar" data-collapsed={collapsed}>
      <div className="shell-brand-row">
        <NavLink
          to="/panel"
          className="shell-brand"
          onClick={onNavigate}
          aria-label="Sazora, ir al panel"
        >
          <img
            src={symbol}
            alt=""
            className="size-12 object-contain"
          />

          <span className="shell-label font-semibold tracking-wider">
            SAZORA
          </span>
        </NavLink>

        <IconButton
          label={
            mobile
              ? "Cerrar menú"
              : collapsed
                ? "Expandir menú"
                : "Plegar menú"
          }
          onClick={onToggle}
          aria-expanded={mobile || !collapsed}
          variant="sidebar"
        >
          <ToggleIcon
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
          />
        </IconButton>
      </div>

      <nav
        aria-label="Navegación principal"
        className="shell-navigation"
      >
        {items
          .filter((item) => item.group === "main")
          .map((item) => {
            if (item.status === "group") {
              return (
                <SidebarGroup
                  key={`${item.id}:${pathname}`}
                  item={item}
                  collapsed={collapsed}
                  onExpand={onToggle}
                  onNavigate={onNavigate}
                />
              );
            }
            const Icon = item.icon;

            const content = (
              <>
                <Icon
                  aria-hidden="true"
                  size={18}
                  strokeWidth={1.75}
                />
                <span className="shell-label">{item.label}</span>
              </>
            );

            return item.status === "ready" ? (
              <NavLink
                key={item.id}
                to={item.to}
                end
                onClick={onNavigate}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `shell-nav-item ${isActive ? "is-active" : ""}`
                }
              >
                {content}
              </NavLink>
            ) : (
              <button
                key={item.id}
                type="button"
                disabled
                title={`${item.label} · Próximamente`}
                aria-label={`${item.label}, próximamente`}
                className="shell-nav-item"
              >
                {content}
              </button>
            );
          })}
      </nav>

      <div className="shell-business" title={business.name}>
        {settings?.status === "ready" ? (
          <NavLink
            to={settings.to}
            onClick={onNavigate}
            className="shell-business-link"
            aria-label={`Configuración de ${business.name}`}
            title="Configuración del negocio"
          >
            <Avatar name={business.name} src={business.logoUrl} />

            <div className="shell-label min-w-0">
              <p className="text-[0.625rem] text-slate-300">
                Negocio
              </p>

              <p className="truncate text-sm font-semibold">
                {business.name}
              </p>
            </div>
          </NavLink>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={business.name} src={business.logoUrl} />

            <div className="shell-label min-w-0">
              <p className="text-[0.625rem] text-slate-300">
                Negocio
              </p>

              <p className="truncate text-sm font-semibold">
                {business.name}
              </p>
            </div>
          </div>
        )}

        {settings?.status === "ready" && (
          <NavLink
            to={settings.to}
            onClick={onNavigate}
            className="shell-settings shell-label"
          >
            <settings.icon
              aria-hidden="true"
              size={16}
              strokeWidth={1.75}
            />
            Configuración del negocio
          </NavLink>
        )}

        <div className="shell-label mt-3 border-t border-white/15 pt-3">
          <p
            className="truncate text-xs"
            title={session.user.fullName}
          >
            {session.user.fullName}
          </p>

          <p className="mt-1 text-[0.625rem] text-slate-300">
            {session.authorization.roles
              .map((role) => ROLE_LABELS[role])
              .join(" · ")}
          </p>
        </div>
      </div>
    </aside>
  );
}
