import {
  Bike,
  BookOpen,
  Boxes,
  ChartNoAxesColumnIncreasing,
  ChefHat,
  Flame,
  LayoutDashboard,
  PackageOpen,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoleCode } from "../features/auth/types/auth.types";

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Administrador",
  WAITER: "Mesero",
  KITCHEN: "Cocina",
  PUBLIC_ORDER_MANAGER: "Gestor de pedidos",
  DELIVERY_DRIVER: "Domiciliario",
};

interface NavigationBase {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: readonly RoleCode[] | null;
  group: "main" | "business";
}

export type NavigationItem = NavigationBase &
  ({ status: "ready"; to: string } | { status: "planned" });

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
    label: "Ventas / Meseros",
    description: "Atención de mesas y gestión de órdenes.",
    icon: ChefHat,
    roles: ["ADMIN", "WAITER"],
    group: "main",
    status: "planned",
  },
  {
    id: "kitchen",
    label: "Cocina",
    description: "Comandas y áreas de preparación.",
    icon: Flame,
    roles: ["ADMIN", "KITCHEN"],
    group: "main",
    status: "planned",
  },
  {
    id: "deliveries",
    label: "Pedidos y domicilios",
    description: "Pedidos públicos y entregas.",
    icon: Bike,
    roles: ["ADMIN", "PUBLIC_ORDER_MANAGER", "DELIVERY_DRIVER"],
    group: "main",
    status: "planned",
  },
  {
    id: "inventory",
    label: "Inventario",
    description: "Existencias, movimientos y producción.",
    icon: Boxes,
    roles: ["ADMIN"],
    group: "main",
    status: "planned",
  },
  {
    id: "products",
    label: "Productos",
    description: "Categorías, productos y combos.",
    icon: PackageOpen,
    roles: ["ADMIN"],
    group: "main",
    status: "planned",
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
    label: "Configuración del negocio",
    description: "Identidad y preferencias del establecimiento.",
    icon: Settings,
    roles: ["ADMIN"],
    group: "business",
    status: "ready",
    to: "/mi-negocio",
  },
];

export function getNavigation(
  roles: readonly RoleCode[]
): NavigationItem[] {
  return navigation.filter(
    (item) =>
      item.roles === null ||
      item.roles.some((role) => roles.includes(role))
  );
}
