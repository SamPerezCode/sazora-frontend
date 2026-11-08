import type {
  AuthSession,
  CurrentSession,
} from "../../auth/types/auth.types";

import {
  hasAnyPermission,
  hasEveryPermission,
  hasGlobalLocationAccess,
  hasPermission,
} from "../../auth/utils/permissions";

type Session = AuthSession | CurrentSession;

export function canOpenProduction(session: Session): boolean {
  return hasAnyPermission(session, [
    "production.orders.read",
    "production.recipes.read",
    "production.reports.read",
    "production.quick.create",
  ]);
}

export function canOpenInventoryWorkspace(session: Session): boolean {
  // Esta pantalla utiliza el catálogo administrativo completo.
  // El backend devuelve un catálogo reducido para Producción.
  return hasEveryPermission(session, [
    "inventory.items.read",
    "inventory.items.manage",
    "inventory.balances.read",
    "locations.read",
  ]);
}

export function canOpenInventoryTab(
  session: Session,
  tab: string
): boolean {
  switch (tab) {
    case "stock":
      return hasEveryPermission(session, [
        "inventory.items.read",
        "inventory.balances.read",
      ]);

    case "summary":
      return hasEveryPermission(session, [
        "inventory.reports.read",
        "inventory.movements.read",
      ]);

    case "purchases":
      return hasEveryPermission(session, [
        "inventory.reports.read",
        "inventory.purchases.read",
      ]);

    case "movements":
      return hasPermission(session, "inventory.movements.read");

    case "production":
      return canOpenProduction(session);

    case "kardex":
      return hasEveryPermission(session, [
        "inventory.reports.read",
        "inventory.movements.read",
        "inventory.purchases.read",
      ]);

    case "reconciliation":
      return (
        hasPermission(session, "inventory.reconciliation.read") &&
        hasGlobalLocationAccess(session)
      );

    case "consumption":
      return hasEveryPermission(session, [
        "inventory.links.manage",
        "catalog.read",
      ]);

    default:
      return false;
  }
}

export function canConfigureProductInventory(
  session: Session
): boolean {
  return hasEveryPermission(session, [
    "catalog.manage",
    "inventory.links.manage",
  ]);
}

export function canRunInventoryAction(
  session: Session,
  action: string
): boolean {
  const permissions: Record<string, string> = {
    create: "inventory.items.manage",
    detail: "inventory.items.manage",
    edit: "inventory.items.manage",
    status: "inventory.items.manage",
    presentation: "inventory.purchases.create",
    valuation: "inventory.valuation.manage",
    movement: "inventory.movements.create",
    purchase: "inventory.purchases.create",
    transfer: "inventory.transfers.create",
    kardex: "inventory.reports.read",
  };

  const permission = permissions[action];

  return Boolean(permission && hasPermission(session, permission));
}
