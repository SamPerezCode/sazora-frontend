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

// Solo presentación. Los permisos siguen usando los códigos de rol.
export const ROLE_PRESENTATION: Record<RoleCode, RolePresentation> = {
  ADMIN: {
    label: "Administrador",
    description: "Administración del negocio.",
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
  PRODUCTION: {
    label: "Producción",
    description:
      "Procesos de planta, producción y productos terminados.",
    icon: Factory,
  },
  INVENTORY_MANAGER: {
    label: "Inventario",
    description:
      "Gestiona existencias, compras, movimientos, transferencias y costos.",
    icon: Boxes,
  },
  PUBLIC_ORDER_MANAGER: {
    label: "Gestor de pedidos",
    description: "Gestión de pedidos del menú público.",
    icon: ClipboardList,
  },
  DELIVERY_DRIVER: {
    label: "Domiciliario",
    description: "Entrega de pedidos a domicilio.",
    icon: Truck,
  },
};

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_PRESENTATION).map(([code, role]) => [
    code,
    role.label,
  ])
);

ROLE_LABELS.CASHIER = "Caja";

export function getRolePresentation(code: string): RolePresentation {
  if (Object.prototype.hasOwnProperty.call(ROLE_PRESENTATION, code)) {
    return ROLE_PRESENTATION[code as RoleCode];
  }

  if (code === "CASHIER") {
    return {
      label: "Caja",
      description: "Pedidos, cobros, aperturas y cierres de caja.",
      icon: Wallet,
    };
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
