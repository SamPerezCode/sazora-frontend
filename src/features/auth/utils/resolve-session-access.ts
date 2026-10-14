import type { CurrentSession, RoleCode } from "../types/auth.types";

type SessionLocation =
  CurrentSession["locationAccess"]["locations"][number];

export interface Workspace {
  id: string;
  role: Exclude<RoleCode, "ADMIN">;
  label: string;
  path: string;
  locationType: SessionLocation["locationType"];
  pending: boolean;
}

const WORKSPACES: readonly Workspace[] = [
  {
    id: "sales",
    role: "WAITER",
    label: "Ventas",
    path: "/ventas",
    locationType: "POINT_OF_SALE",
    pending: false,
  },
  {
    id: "kitchen",
    role: "KITCHEN",
    label: "Cocina",
    path: "/cocina",
    locationType: "POINT_OF_SALE",
    pending: false,
  },
  {
    id: "production",
    role: "PRODUCTION",
    label: "Producción",
    path: "/produccion",
    locationType: "PRODUCTION_WAREHOUSE",
    pending: true,
  },
  {
    id: "public-orders",
    role: "PUBLIC_ORDER_MANAGER",
    label: "Pedidos públicos",
    path: "/pedidos-publicos",
    locationType: "POINT_OF_SALE",
    pending: true,
  },
  {
    id: "deliveries",
    role: "DELIVERY_DRIVER",
    label: "Domicilios",
    path: "/domicilios",
    locationType: "POINT_OF_SALE",
    pending: true,
  },
];

type AccessIssue = "no-locations" | "no-default" | "incompatible";

export interface AccessResolution {
  kind: "global" | "blocked" | "single" | "choose";
  home: string;
  allowedPaths: readonly string[];

  // Todos los módulos compatibles con el rol y la ubicación.
  workspaces: readonly Workspace[];

  // Opciones utilizadas para decidir el ingreso inicial.
  entryWorkspaces: readonly Workspace[];

  defaultLocation: SessionLocation | null;
  issue: AccessIssue | null;
}

export function resolveSessionAccess(
  session: CurrentSession
): AccessResolution {
  const { roles, locationAccess } = session;

  const { locations, defaultLocationId, hasGlobalAccess } =
    locationAccess;

  const isAdmin = roles.includes("ADMIN");

  const defaultLocation =
    locations.find((location) => location.id === defaultLocationId) ??
    null;

  const workspaces =
    defaultLocation && defaultLocation.isActive !== false
      ? WORKSPACES.filter(
          (workspace) =>
            roles.includes(workspace.role) &&
            workspace.locationType === defaultLocation.locationType
        )
      : [];

  if (isAdmin || hasGlobalAccess) {
    return {
      kind: "global",
      home: "/panel",
      allowedPaths: [
        "/panel",
        ...(isAdmin
          ? [
              "/configuracion",
              "/mi-negocio",
              "/productos",
              "/productos/categorias",
              "/inventario",
            ]
          : []),
        ...workspaces.map((workspace) => workspace.path),
      ],
      workspaces,
      entryWorkspaces: [],
      defaultLocation,
      issue: null,
    };
  }

  let issue: AccessIssue | null = null;

  if (locations.length === 0) {
    issue = "no-locations";
  } else if (defaultLocationId === null) {
    issue = "no-default";
  } else if (
    !defaultLocation ||
    defaultLocation.isActive === false ||
    workspaces.length === 0
  ) {
    issue = "incompatible";
  }

  if (issue) {
    return {
      kind: "blocked",
      home: "/acceso",
      allowedPaths: ["/acceso"],
      workspaces: [],
      entryWorkspaces: [],
      defaultLocation,
      issue,
    };
  }

  // Si hay módulos disponibles, tienen prioridad al ingresar.
  const readyWorkspaces = workspaces.filter(
    (workspace) => !workspace.pending
  );

  // Si todos están pendientes, se ofrecen sus pantallas informativas.
  const entryWorkspaces =
    readyWorkspaces.length > 0 ? readyWorkspaces : workspaces;

  const choose = entryWorkspaces.length > 1;

  return {
    kind: choose ? "choose" : "single",
    home: choose ? "/espacios" : entryWorkspaces[0].path,
    allowedPaths: [
      ...workspaces.map((workspace) => workspace.path),
      ...(choose ? ["/espacios"] : []),
    ],
    workspaces,
    entryWorkspaces,
    defaultLocation,
    issue: null,
  };
}
