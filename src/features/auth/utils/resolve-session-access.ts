import type { CurrentSession } from "../types/auth.types";
import { hasPermission } from "./permissions";

interface ModuleDefinition {
  id: string;
  label: string;
  path: string;
  permission: string;
  available: boolean;
}

const modules: readonly ModuleDefinition[] = [
  {
    id: "panel",
    label: "Resumen general",
    path: "/panel",
    permission: "dashboard.read",
    available: true,
  },
  {
    id: "sales",
    label: "Mesas y pedidos",
    path: "/ventas",
    permission: "orders.read",
    available: true,
  },
  {
    id: "kitchen",
    label: "Cocina",
    path: "/cocina",
    permission: "kitchen.dashboard.read",
    available: true,
  },
  {
    id: "inventory",
    label: "Inventario",
    path: "/inventario",
    permission: "inventory.balances.read",
    available: true,
  },
  {
    id: "production",
    label: "Producción",
    path: "/inventario",
    permission: "production.orders.read",
    available: true,
  },
  {
    id: "public-orders",
    label: "Solicitudes del menú público",
    path: "/pedidos-publicos",
    permission: "public_orders.read",
    available: true,
  },
  {
    id: "deliveries",
    label: "Domicilios",
    path: "/domicilios",
    permission: "deliveries.read",
    available: true,
  },
  {
    id: "statistics",
    label: "Dashboard e informes",
    path: "/estadisticas",
    permission: "sales.reports.read",
    available: true,
  },
  {
    id: "products",
    label: "Productos",
    path: "/productos",
    permission: "catalog.manage",
    available: true,
  },
  {
    id: "settings",
    label: "Configuración",
    path: "/configuracion",
    permission: "business.settings.read",
    available: true,
  },
];

function authorizedModules(session: CurrentSession) {
  return modules.filter(
    (module) =>
      module.available && hasPermission(session, module.permission)
  );
}

export function authorizedModulePath(
  session: CurrentSession,
  target: string | null
): string | null {
  if (!target) return null;

  const [pathname = "", query = ""] = target.split("?");
  const path = pathname.replace(/\/+$/, "") || "/";
  const available = authorizedModules(session);

  if (path === "/inventario") {
    const inventory = available.some(
      (module) => module.id === "inventory"
    );

    const production = available.some(
      (module) => module.id === "production"
    );

    if (new URLSearchParams(query).get("tab") === "production") {
      return production ? "/inventario?tab=production" : null;
    }

    return inventory ? "/inventario" : null;
  }

  const canonical =
    path === "/mi-negocio"
      ? "/configuracion"
      : path === "/productos/categorias"
        ? "/productos"
        : path;

  return available.some((module) => module.path === canonical)
    ? canonical
    : null;
}

export function resolveSessionAccess(
  session: CurrentSession,
  lastModule: string | null = null
) {
  const available = authorizedModules(session);
  const paths = new Set(available.map((module) => module.path));

  if (paths.has("/productos")) {
    paths.add("/productos/categorias");
  }

  if (paths.has("/configuracion")) {
    paths.add("/mi-negocio");
  }

  const initial = available[0];

  const initialPath =
    initial?.id === "production"
      ? "/inventario?tab=production"
      : (initial?.path ?? null);

  const home =
    authorizedModulePath(session, lastModule) ??
    authorizedModulePath(session, initialPath) ??
    "/acceso";

  if (home === "/acceso") {
    paths.add("/acceso");
  }

  const workspaces = available.filter(
    (module, index) =>
      ["sales", "kitchen", "inventory", "production"].includes(
        module.id
      ) &&
      available.findIndex((item) => item.path === module.path) ===
        index
  );

  const defaultLocation =
    session.locationAccess.locations.find(
      (location) =>
        location.id === session.locationAccess.defaultLocationId &&
        location.isActive !== false
    ) ?? null;

  return {
    home,
    allowedPaths: [...paths],
    workspaces,
    defaultLocation,
  };
}

export type AccessResolution = ReturnType<
  typeof resolveSessionAccess
>;
