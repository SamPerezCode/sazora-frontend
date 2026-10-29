import type {
  RoleCode,
  AuthSession,
} from "../../../../auth/types/auth.types";
import type { BusinessLocation } from "../../../../business/schemas/organization.schema";
import { ApiError } from "../../../../../lib/http/client";
import type { OrderSummary, Action } from "../types/production.types";

export const productionRoles: readonly RoleCode[] = [
  "ADMIN",
  "PRODUCTION",
];

export function isAdmin(session: AuthSession) {
  return session.authorization.roles.includes("ADMIN");
}

export function assignedPlant(session: AuthSession) {
  const access = session.authorization.locationAccess;

  return (
    access.locations.find(
      (location) =>
        location.id === access.defaultLocationId &&
        location.isActive !== false &&
        location.locationType === "PRODUCTION_WAREHOUSE"
    ) ?? null
  );
}

export function assertProduction(session: AuthSession) {
  const allowed = productionRoles.some((role) =>
    session.authorization.roles.includes(role)
  );

  if (!allowed) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso a Producción."
    );
  }

  if (!isAdmin(session) && !assignedPlant(session)) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "No tienes una planta de producción asignada."
    );
  }
}

export function plantScope(session: AuthSession, requested = "") {
  assertProduction(session);

  if (isAdmin(session)) return requested;

  const plant = assignedPlant(session)!;

  if (requested && requested !== plant.id) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "No tienes acceso a esa planta."
    );
  }

  return plant.id;
}

export function usablePlant(location: BusinessLocation) {
  return (
    location.isActive &&
    location.isInventoryLocation &&
    location.isProductionLocation &&
    location.locationType === "PRODUCTION_WAREHOUSE"
  );
}

export function allowedActions(
  session: AuthSession,
  order: Pick<
    OrderSummary,
    "status" | "location" | "inventoryMovementId"
  >
): Action[] {
  if (
    !productionRoles.some((role) =>
      session.authorization.roles.includes(role)
    )
  ) {
    return [];
  }

  const admin = isAdmin(session);

  if (!admin && assignedPlant(session)?.id !== order.location.id) {
    return [];
  }

  const actions: Action[] = ["detail"];

  if (order.status === "DRAFT" && admin) {
    actions.push("edit", "plan", "cancel");
  }

  if (order.status === "PLANNED") {
    actions.push("start");
    if (admin) actions.push("cancel");
  }

  if (order.status === "IN_PROGRESS") {
    actions.push("waste", "complete", "performance");
  }

  if (order.status === "COMPLETED") {
    actions.push("performance");
    if (order.inventoryMovementId) actions.push("movement");
  }

  return actions;
}
