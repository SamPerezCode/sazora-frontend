import {
  BookOpen,
  Boxes,
  ChartNoAxesColumnIncreasing,
  ChefHat,
  Flame,
  LayoutDashboard,
  LayoutGrid,
  PackageOpen,
  Settings,
  Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  CurrentSession,
  RoleCode,
} from "../features/auth/types/auth.types";
import { resolveSessionAccess } from "../features/auth/utils/resolve-session-access";
import { ROLE_PRESENTATION } from "../features/auth/role-presentation";

export { ROLE_LABELS } from "../features/auth/role-presentation";

interface NavigationBase {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: readonly RoleCode[] | null;
  group: "main" | "business";
}

export type NavigationLeaf = NavigationBase &
  ({ status: "ready"; to: string } | { status: "planned" });

export type NavigationItem =
  | NavigationLeaf
  | (NavigationBase & {
      status: "group";
      children: readonly NavigationLeaf[];
    });

const navigation: readonly NavigationItem[] = [
  {
    id: "panel",
    label: "Panel",
    description: "Tu espacio de trabajo.",
    icon: LayoutDashboard,
    roles: null,
    group: "main",
    status: "ready",
    to: "/panel",
  },
  {
    id: "sales",
    label: "Mesas y pedidos",
    description: "Atención de mesas y gestión de órdenes.",
    icon: ChefHat,
    roles: ["ADMIN", "WAITER"],
    group: "main",
    status: "ready",
    to: "/ventas",
  },

  {
    id: "kitchen",
    label: "Cocina",
    description: "Comandas y áreas de preparación.",
    icon: Flame,
    roles: ["ADMIN", "KITCHEN"],
    group: "main",
    status: "ready",
    to: "/cocina",
  },
  {
    id: "inventory",
    label: "Inventario",
    description: "Existencias, movimientos y producción.",
    icon: Boxes,
    roles: ["ADMIN"],
    group: "main",
    status: "ready",
    to: "/inventario",
  },
  {
    id: "products",
    label: "Productos",
    description: "Categorías, productos y combos.",
    icon: PackageOpen,
    roles: ["ADMIN"],
    group: "main",
    status: "group",
    children: [
      {
        id: "product-list",
        label: "Productos",
        description: "Consulta y organiza tu carta",
        icon: PackageOpen,
        roles: ["ADMIN"],
        group: "main",
        status: "ready",
        to: "/productos",
      },
      {
        id: "categories",
        label: "Categorías",
        description: "Organiza las secciones del menú",
        icon: Tags,
        roles: ["ADMIN"],
        group: "main",
        status: "ready",
        to: "/productos/categorias",
      },
    ],
  },
  {
    id: "statistics",
    label: "Estadísticas",
    description: "Indicadores de la operación.",
    icon: ChartNoAxesColumnIncreasing,
    roles: ["ADMIN"],
    group: "main",
    status: "planned",
  },
  {
    id: "public-menu",
    label: "Menú público",
    description: "Presentación del menú de tu negocio.",
    icon: BookOpen,
    roles: ["ADMIN"],
    group: "main",
    status: "planned",
  },
  {
    id: "settings",
    label: "Configuración",
    description:
      "Administra la identidad, información fiscal, sedes y operación general.",
    icon: Settings,
    roles: ["ADMIN"],
    group: "business",
    status: "ready",
    to: "/configuracion",
  },
];

export function getNavigation(
  session: CurrentSession
): NavigationItem[] {
  const access = resolveSessionAccess(session);
  const visible: NavigationItem[] = [];

  const allowed = (item: NavigationLeaf): boolean =>
    item.status === "ready"
      ? access.allowedPaths.includes(item.to)
      : access.kind === "global" &&
        (item.roles?.some((role) => session.roles.includes(role)) ??
          false);

  for (const item of navigation) {
    if (item.status === "group") {
      const children = item.children.filter(allowed);

      if (children.length) {
        visible.push({ ...item, children });
      }
    } else if (allowed(item)) {
      visible.push(
        item.id === "panel"
          ? {
              ...item,
              label: "Resumen general",
              description: "Información general de la organización.",
            }
          : item
      );
    }
  }

  if (access.kind === "choose") {
    visible.unshift({
      id: "workspaces",
      label: "Espacios de trabajo",
      description: "Elige el módulo en el que deseas trabajar.",
      icon: LayoutGrid,
      roles: null,
      group: "main",
      status: "ready",
      to: "/espacios",
    });
  }

  for (const workspace of access.workspaces) {
    if (visible.some((item) => item.id === workspace.id)) {
      continue;
    }

    const presentation = ROLE_PRESENTATION[workspace.role];

    visible.push({
      id: workspace.id,
      label: workspace.label,
      description: workspace.pending
        ? "Módulo en preparación."
        : presentation.description,
      icon: presentation.icon,
      roles: [workspace.role],
      group: "main",
      status: "ready",
      to: workspace.path,
    });
  }

  return visible;
}
