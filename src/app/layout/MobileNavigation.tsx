import { useId, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { NavLink } from "react-router";
import { BottomSheet } from "../../components/layout/BottomSheet";
import { Avatar } from "../../components/ui/Avatar";
import type { RoleCode } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/business-profile.schema";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { getNavigation } from "../navigation";
import type { NavigationItem } from "../navigation";

interface MobileNavigationProps {
  roles: readonly RoleCode[];
  business: BusinessIdentity;
  onLogout: () => void;
}

const shortcuts = ["panel", "sales", "kitchen", "deliveries"];

const shortLabels: Record<string, string> = {
  sales: "Ventas",
  deliveries: "Pedidos",
  settings: "Configuración",
};

function NavigationEntry({
  item,
  compact = false,
  onNavigate,
}: {
  item: NavigationItem;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const label = compact
    ? (shortLabels[item.id] ?? item.label)
    : item.id === "settings"
      ? "Configuración"
      : item.label;

  const className = compact ? "mobile-nav-item" : "mobile-menu-item";

  const content = (
    <>
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      <span>{label}</span>
    </>
  );

  return item.status === "ready" ? (
    <NavLink
      to={item.to}
      end={item.id === "panel"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${className}${isActive ? " is-active" : ""}`
      }
    >
      {content}
    </NavLink>
  ) : (
    <button
      type="button"
      disabled
      className={className}
      title={`${item.label} · Próximamente`}
      aria-label={`${label}, próximamente`}
    >
      {content}
    </button>
  );
}

function MobileNavigationContent({
  roles,
  business,
  onLogout,
}: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();

  const items = getNavigation(roles);

  const primaryItems = items.filter((item) =>
    shortcuts.includes(item.id)
  );

  return (
    <>
      <nav
        className="mobile-bottom-nav"
        aria-label="Navegación principal móvil"
      >
        {primaryItems.map((item) => (
          <NavigationEntry key={item.id} item={item} compact />
        ))}

        <button
          type="button"
          className="mobile-nav-item"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={sheetId}
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" size={18} strokeWidth={1.75} />
          <span>Más</span>
        </button>
      </nav>

      <BottomSheet
        id={sheetId}
        open={open}
        title="Navegación"
        onClose={() => setOpen(false)}
      >
        <nav
          aria-label="Todas las secciones"
          className="mobile-menu-grid"
        >
          {items.map((item) => (
            <NavigationEntry
              key={item.id}
              item={item}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>

        {items.some((item) => item.status === "planned") && (
          <p className="mobile-menu-hint">
            Las opciones atenuadas estarán disponibles próximamente.
          </p>
        )}

        <div className="mt-3.5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
          <div className="mobile-menu-business mt-0 min-w-0">
            <Avatar
              name={business.name}
              src={business.logoUrl}
              size="sm"
            />

            <div className="min-w-0">
              <p className="mobile-menu-caption">Negocio</p>

              <p className="mobile-menu-name" title={business.name}>
                {business.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="profile-logout sm:w-auto sm:whitespace-nowrap sm:rounded-r-xl sm:border-t-0 sm:border-l sm:border-outline"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

export function MobileNavigation(props: MobileNavigationProps) {
  const isDesktop = useMediaQuery("(min-width: 64rem)");

  if (isDesktop) return null;

  return <MobileNavigationContent {...props} />;
}
