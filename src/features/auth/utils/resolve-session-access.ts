import type { CurrentSession, RoleCode } from "../types/auth.types";

import {
  canAccessKitchenDashboard,
  hasEveryPermission,
  hasPermission,
} from "./permissions";

import {
  canOpenInventoryWorkspace,
  canOpenProduction,
} from "../../inventory/utils/inventory-access";

type SessionLocation =
  CurrentSession["locationAccess"]["locations"][number];

export interface Workspace {
  id: string;
  role: Exclude<RoleCode, "ADMIN">;
  label: string;
  path: string;
  locationType: SessionLocation["locationType"] | null;
  pending: boolean;
}

type AccessIssue = "no-locations" | "no-default" | "incompatible";

export interface AccessResolution {
  kind: "global" | "blocked" | "single" | "choose";
  home: string;
  allowedPaths: readonly string[];
  workspaces: readonly Workspace[];
  entryWorkspaces: readonly Workspace[];
  defaultLocation: SessionLocation | null;
  issue: AccessIssue | null;
}

export function resolveSessionAccess(
  session: CurrentSession
): AccessResolution {
  const access = session.locationAccess;

  const locations = access.locations.filter(
    (location) => location.isActive !== false
  );

  const defaultLocation =
    locations.find(
      (location) => location.id === access.defaultLocationId
    ) ?? null;

  const hasLocation = (
    type: SessionLocation["locationType"] | null
  ): boolean =>
    access.hasGlobalAccess ||
    locations.some(
      (location) => type === null || location.locationType === type
    );

  const workspaces: Workspace[] = [];

  const canReadSales = hasEveryPermission(session, [
    "orders.read",
    "tables.read",
    "catalog.read",
  ]);

  if (canReadSales && hasLocation("POINT_OF_SALE")) {
    workspaces.push({
      id: "sales",
      role: "WAITER",
      label: "Mesas y pedidos",
      path: "/ventas",
      locationType: "POINT_OF_SALE",
      pending: false,
    });
  }

  if (canAccessKitchenDashboard(session)) {
    workspaces.push({
      id: "kitchen",
      role: "KITCHEN",
      label: "Cocina",
      path: "/cocina",
      locationType: "POINT_OF_SALE",
      pending: false,
    });
  }

  const inventory = canOpenInventoryWorkspace(session);
  const production = canOpenProduction(session);

  if (inventory && hasLocation(null)) {
    workspaces.push({
      id: "inventory",
      role: "INVENTORY_MANAGER",
      label: "Inventario",
      path: "/inventario",
      locationType: null,
      pending: false,
    });
  } else if (production && hasLocation("PRODUCTION_WAREHOUSE")) {
    workspaces.push({
      id: "production",
      role: "PRODUCTION",
      label: "Producción",
      path: "/inventario",
      locationType: "PRODUCTION_WAREHOUSE",
      pending: false,
    });
  }

  if (
    hasPermission(session, "public_orders.read") &&
    hasLocation("POINT_OF_SALE")
  ) {
    workspaces.push({
      id: "public-orders",
      role: "PUBLIC_ORDER_MANAGER",
      label: "Pedidos públicos",
      path: "/pedidos-publicos",
      locationType: "POINT_OF_SALE",
      pending: true,
    });
  }

  if (
    hasPermission(session, "deliveries.read") &&
    hasLocation("POINT_OF_SALE")
  ) {
    workspaces.push({
      id: "deliveries",
      role: "DELIVERY_DRIVER",
      label: "Domicilios",
      path: "/domicilios",
      locationType: "POINT_OF_SALE",
      pending: true,
    });
  }

  const paths = new Set(
    workspaces.map((workspace) => workspace.path)
  );

  const inventoryOnly =
    session.roles.length === 1 &&
    session.roles[0] === "INVENTORY_MANAGER";

  if (
    !inventoryOnly &&
    hasPermission(session, "dashboard.read") &&
    hasLocation(null)
  ) {
    paths.add("/panel");
  }

  if (hasPermission(session, "business.settings.read")) {
    paths.add("/configuracion");
    paths.add("/mi-negocio");
  }

  // Estas son las pantallas existentes de administración del catálogo.
  if (hasPermission(session, "catalog.manage")) {
    paths.add("/productos");
    paths.add("/productos/categorias");
  }

  if (
    hasPermission(session, "sales.reports.read") &&
    hasLocation(null)
  ) {
    paths.add("/estadisticas");
  }

  if (access.hasGlobalAccess && paths.has("/panel")) {
    return {
      kind: "global",
      home: "/panel",
      allowedPaths: [...paths],
      workspaces,
      entryWorkspaces: [],
      defaultLocation,
      issue: null,
    };
  }

  const ready = workspaces.filter((workspace) => !workspace.pending);

  let entries = ready.length ? ready : workspaces;

  // Mesas y pedidos es la entrada principal cuando está disponible.
  // Cocina continúa accesible desde el menú.
  if (entries.some((workspace) => workspace.id === "sales")) {
    entries = entries.filter(
      (workspace) => workspace.id !== "kitchen"
    );
  }

  const choose = entries.length > 1;

  if (choose) {
    paths.add("/espacios");
  }

  const home = choose
    ? "/espacios"
    : (entries[0]?.path ?? [...paths][0]);

  if (!home) {
    return {
      kind: "blocked",
      home: "/acceso",
      allowedPaths: ["/acceso"],
      workspaces: [],
      entryWorkspaces: [],
      defaultLocation,
      issue:
        !access.hasGlobalAccess && locations.length === 0
          ? "no-locations"
          : "incompatible",
    };
  }

  return {
    kind: choose ? "choose" : "single",
    home,
    allowedPaths: [...paths],
    workspaces,
    entryWorkspaces: entries,
    defaultLocation,
    issue: null,
  };
}

export function firstAuthorizedModule(
  access: AccessResolution
): string | null {
  return (
    access.allowedPaths.find(
      (path) =>
        !["/acceso", "/espacios", "/mi-negocio"].includes(path)
    ) ?? null
  );
}
