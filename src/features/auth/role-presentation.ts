import {
  Boxes,
  ChefHat,
  ClipboardList,
  Factory,
  ShieldCheck,
  Truck,
  UserRound,
  Utensils,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoleCode } from "./types/auth.types";

interface RolePresentation {
  label: string;
  description: string;
  icon: LucideIcon;
}

export const ROLE_PRESENTATION: Record<RoleCode, RolePresentation> = {
  ADMIN: {
    label: "Administrador",
    description:
      "Administración del negocio y acceso global a ubicaciones.",
    icon: ShieldCheck,
  },
  WAITER: {
    label: "Mesero",
    description: "Atención de mesas y pedidos.",
    icon: Utensils,
  },
  KITCHEN: {
    label: "Cocina",
    description: "Preparación de productos de comandas y pedidos.",
    icon: ChefHat,
  },
  PUBLIC_ORDER_MANAGER: {
    label: "Gestor de pedidos públicos",
    description: "Gestión de pedidos del menú público.",
    icon: ClipboardList,
  },
  DELIVERY_DRIVER: {
    label: "Domiciliario",
    description: "Entrega de pedidos a domicilio.",
    icon: Truck,
  },
  PRODUCTION: {
    label: "Producción",
    description:
      "Procesos de planta, producción y productos terminados.",
    icon: Factory,
  },
  CASHIER: {
    label: "Caja",
    description: "Pedidos, cobros, aperturas y cierres de caja.",
    icon: Wallet,
  },
  INVENTORY_MANAGER: {
    label: "Gestor de inventario",
    description:
      "Gestiona existencias, compras, movimientos y transferencias.",
    icon: Boxes,
  },
};

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_PRESENTATION).map(([code, role]) => [
    code,
    role.label,
  ])
);

export function getRolePresentation(code: string): RolePresentation {
  if (Object.prototype.hasOwnProperty.call(ROLE_PRESENTATION, code)) {
    return ROLE_PRESENTATION[code as RoleCode];
  }

  const readable = code
    .replace(/[_-]+/g, " ")
    .trim()
    .toLocaleLowerCase("es-CO");

  return {
    label:
      readable.charAt(0).toLocaleUpperCase("es-CO") +
      readable.slice(1),
    description: "Acceso según los permisos asignados a este rol.",
    icon: UserRound,
  };
}
