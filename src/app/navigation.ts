import {
  Banknote,
  ReceiptText,
  BookOpen,
  Boxes,
  ChartNoAxesColumnIncreasing,
  ChefHat,
  Flame,
  LayoutDashboard,
  PackageOpen,
  Settings,
  Tags,
  Bike,
  ClipboardList,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import type {
  CurrentSession,
  RoleCode,
} from "../features/auth/types/auth.types";

import { resolveSessionAccess } from "../features/auth/utils/resolve-session-access";

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
  (
    | {
        status: "ready";
        to: string;
      }
    | {
        status: "planned";
      }
  );

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
    id: "cash",
    label: "Cajas y turnos",
    description: "Operación de efectivo por ubicación.",
    icon: Banknote,
    roles: null,
    group: "main",
    status: "ready",
    to: "/cajas",
  },
  {
    id: "sale-history",
    label: "Historial de ventas",
    description: "Ventas definitivas, anulaciones y devoluciones",
    icon: ReceiptText,
    roles: null,
    group: "main",
    status: "ready",
    to: "/historial-ventas",
  },
  {
    id: "public-orders",
    label: "Solicitudes del menú público",
    description: "Ventas · Revisión comercial",
    icon: ClipboardList,
    roles: null,
    group: "main",
    status: "ready",
    to: "/pedidos-publicos",
  },
  {
    id: "deliveries",
    label: "Domicilios",
    description: "Ventas · Pedidos aceptados",
    icon: Bike,
    roles: null,
    group: "main",
    status: "ready",
    to: "/domicilios",
  },
  {
    id: "kitchen",
    label: "Cocina",
    description: "Comandas y áreas de preparación.",
    icon: Flame,
    roles: null,
    group: "main",
    status: "ready",
    to: "/cocina",
  },
  {
    id: "inventory",
    label: "Inventario",
    description: "Existencias, movimientos y producción.",
    icon: Boxes,
    roles: ["ADMIN", "PRODUCTION"],
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
    label: "Dashboard e informes",
    description:
      "Resumen, ventas, cancelaciones y operación de cocina.",
    icon: ChartNoAxesColumnIncreasing,
    roles: ["ADMIN"],
    group: "main",
    status: "ready",
    to: "/estadisticas",
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
    item.status === "ready" && access.allowedPaths.includes(item.to);

  for (const item of navigation) {
    if (item.status === "group") {
      const children = item.children.filter(allowed);

      if (children.length) {
        visible.push({ ...item, children });
      }

      continue;
    }

    if (!allowed(item)) continue;

    if (item.id === "panel") {
      visible.push({
        ...item,
        label: "Resumen general",
        description: "Información general de la organización.",
      });
    } else if (item.id === "inventory") {
      const module = access.workspaces.find(
        (workspace) => workspace.path === "/inventario"
      );

      visible.push({
        ...item,
        label: module?.label ?? item.label,
      });
    } else {
      visible.push(item);
    }
  }

  return visible;
}
