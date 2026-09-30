import { useId, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import type { NavigationItem } from "../navigation";

interface SidebarGroupProps {
  item: Extract<NavigationItem, { status: "group" }>;
  collapsed: boolean;
  onExpand: () => void;
  onNavigate?: () => void;
}

export function SidebarGroup({
  item,
  collapsed,
  onExpand,
  onNavigate,
}: SidebarGroupProps) {
  const { pathname } = useLocation();

  const active = item.children.some(
    (child) => child.status === "ready" && child.to === pathname
  );

  const [expanded, setExpanded] = useState(active);
  const id = useId();
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        className={`shell-nav-item ${active || expanded ? "is-active" : ""}`}
        title={item.label}
        aria-label={item.label}
        aria-expanded={!collapsed && expanded}
        aria-controls={id}
        onClick={() => {
          if (collapsed) {
            setExpanded(true);
            onExpand();
          } else {
            setExpanded((value) => !value);
          }
        }}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
        <span className="shell-label">{item.label}</span>

        {!collapsed && (
          <ChevronDown
            aria-hidden="true"
            size={14}
            className={`ml-auto shrink-0 ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      <div id={id} hidden={collapsed || !expanded}>
        <ul className="shell-subnavigation">
          {item.children.map((child) => (
            <li key={child.id}>
              {child.status === "ready" ? (
                <NavLink
                  to={child.to}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `shell-subnav-item ${isActive ? "is-active" : ""}`
                  }
                >
                  {child.label}
                </NavLink>
              ) : (
                <button
                  type="button"
                  disabled
                  className="shell-subnav-item"
                  title={`${child.label} · Próximamente`}
                  aria-label={`${child.label}, próximamente`}
                >
                  {child.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
