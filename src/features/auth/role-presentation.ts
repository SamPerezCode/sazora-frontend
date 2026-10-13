import {
  ChefHat,
  ClipboardList,
  Factory,
  ShieldCheck,
  Truck,
  Utensils,
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
    description: "Procesos de planta, producción y productos terminados.",
    icon: Factory,
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

export const ROLE_LABELS = Object.fromEntries(
  Object.entries(ROLE_PRESENTATION).map(([code, role]) => [code, role.label])
) as Record<RoleCode, string>;
