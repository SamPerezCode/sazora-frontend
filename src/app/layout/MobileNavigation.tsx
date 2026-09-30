import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { BottomSheet } from "../../components/layout/BottomSheet";
import { Avatar } from "../../components/ui/Avatar";
import type { RoleCode } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/schemas/business-profile.schema";
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
  detail = false,
  onNavigate,
  onGroup,
}: {
  item: NavigationItem;
  compact?: boolean;
  detail?: boolean;
  onNavigate: () => void;
  onGroup: (id: string) => void;
}) {
  const { pathname } = useLocation();
  const Icon = item.icon;

  const label = detail
    ? item.label
    : shortLabels[item.id] && (compact || item.id === "settings")
      ? shortLabels[item.id]
      : item.label;

  const className = detail
    ? "mobile-submenu-item"
    : compact
      ? "mobile-nav-item"
      : "mobile-menu-item";

  const content = detail ? (
    <>
      <span className="mobile-submenu-icon">
        <Icon aria-hidden="true" size={22} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="mt-1 block text-[0.625rem] text-muted">
          {item.description}
        </span>
      </span>

      <ChevronRight
        aria-hidden="true"
        size={16}
        className="shrink-0 text-muted"
      />
    </>
  ) : (
    <>
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      <span>{label}</span>

      {item.status === "group" && (
        <ChevronRight
          aria-hidden="true"
          size={12}
          className="absolute right-2 top-2"
        />
      )}
    </>
  );

  if (item.status === "group") {
    const active = item.children.some(
      (child) => child.status === "ready" && child.to === pathname
    );

    return (
      <button
        type="button"
        data-navigation-group={item.id}
        className={`${className} relative ${active ? "is-active" : ""}`}
        onClick={() => onGroup(item.id)}
        aria-label={`${label}, abrir opciones`}
      >
        {content}
      </button>
    );
  }

  return item.status === "ready" ? (
    <NavLink
      to={item.to}
      end
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
  const [groupId, setGroupId] = useState<string | null>(null);
  const sheetId = useId();
  const submenuRef = useRef<HTMLElement>(null);

  const items = getNavigation(roles);
  const group = items.find(
    (item) => item.id === groupId && item.status === "group"
  );
  const primaryItems = items.filter((item) =>
    shortcuts.includes(item.id)
  );

  useEffect(() => {
    if (groupId) {
      submenuRef.current?.focus({ preventScroll: true });
    }
  }, [groupId]);

  function close() {
    setOpen(false);
    setGroupId(null);
  }

  function back() {
    const previous = groupId;
    setGroupId(null);

    requestAnimationFrame(() => {
      const dialog = document.getElementById(sheetId);
      const buttons = dialog?.querySelectorAll<HTMLButtonElement>(
        "[data-navigation-group]"
      );

      Array.from(buttons ?? [])
        .find((button) => button.dataset.navigationGroup === previous)
        ?.focus({ preventScroll: true });
    });
  }

  function openGroup(id: string) {
    setGroupId(id);
    setOpen(true);
  }

  return (
    <>
      <nav
        className="mobile-bottom-nav"
        aria-label="Navegación principal móvil"
      >
        {primaryItems.map((item) => (
          <NavigationEntry
            key={item.id}
            item={item}
            compact
            onNavigate={close}
            onGroup={openGroup}
          />
        ))}

        <button
          type="button"
          className="mobile-nav-item"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={sheetId}
          onClick={() => {
            setGroupId(null);
            setOpen(true);
          }}
        >
          <Menu aria-hidden="true" size={18} strokeWidth={1.75} />
          <span>Más</span>
        </button>
      </nav>

      <BottomSheet
        id={sheetId}
        open={open}
        title={group?.label ?? "Navegación"}
        className="mobile-navigation-sheet"
        onClose={close}
        onBack={group ? back : undefined}
      >
        {group?.status === "group" ? (
          <nav
            ref={submenuRef}
            tabIndex={-1}
            aria-label={`Opciones de ${group.label}`}
            className="mobile-submenu focus:outline-none"
          >
            {group.children.map((item) => (
              <NavigationEntry
                key={item.id}
                item={item}
                detail
                onNavigate={close}
                onGroup={openGroup}
              />
            ))}
          </nav>
        ) : (
          <>
            <nav
              aria-label="Todas las secciones"
              className="mobile-menu-grid"
            >
              {items.map((item) => (
                <NavigationEntry
                  key={item.id}
                  item={item}
                  onNavigate={close}
                  onGroup={openGroup}
                />
              ))}
            </nav>

            {items.some((item) => item.status === "planned") && (
              <p className="mobile-menu-hint">
                Las opciones atenuadas estarán disponibles
                próximamente.
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
                  <p
                    className="mobile-menu-name"
                    title={business.name}
                  >
                    {business.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="profile-logout sm:w-auto sm:whitespace-nowrap sm:rounded-r-xl sm:border-t-0 sm:border-l sm:border-outline"
                onClick={() => {
                  close();
                  onLogout();
                }}
              >
                <LogOut
                  aria-hidden="true"
                  size={16}
                  strokeWidth={1.75}
                />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}

export function MobileNavigation(props: MobileNavigationProps) {
  const isDesktop = useMediaQuery("(min-width: 64rem)");

  return isDesktop ? null : <MobileNavigationContent {...props} />;
}
