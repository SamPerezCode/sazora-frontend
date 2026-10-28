import type { AuthSession, RoleCode } from "../../auth/types/auth.types";
import type { Action, OrderSummary } from "./production.contracts";
import type { BusinessLocation } from "../../business/schemas/organization.schema";
import { ApiError } from "../../../lib/http/client";

export const productionRoles: readonly RoleCode[] = ["ADMIN", "PRODUCTION"];
export const isAdmin = (session: AuthSession) => session.authorization.roles.includes("ADMIN");
export function assignedPlant(session: AuthSession) {
  const access = session.authorization.locationAccess;
  return access.locations.find(location =>
    location.id === access.defaultLocationId &&
    location.isActive !== false && location.locationType === "PRODUCTION_WAREHOUSE"
  ) ?? null;
}
export function assertProduction(session: AuthSession) {
  if (!productionRoles.some(role => session.authorization.roles.includes(role)))
    throw new ApiError(403, "FORBIDDEN", "No tienes acceso a Producción.");
  if (!isAdmin(session) && !assignedPlant(session))
    throw new ApiError(403, "LOCATION_ACCESS_DENIED", "No tienes una planta de producción asignada.");
}
export function plantScope(session: AuthSession, requested = "") {
  assertProduction(session);
  if (isAdmin(session)) return requested;
  const plant = assignedPlant(session)!;
  if (requested && requested !== plant.id)
    throw new ApiError(403, "LOCATION_ACCESS_DENIED", "No tienes acceso a esa planta.");
  return plant.id;
}
export const usablePlant = (location: BusinessLocation) =>
  location.isActive && location.isInventoryLocation && location.isProductionLocation &&
  location.locationType === "PRODUCTION_WAREHOUSE";
export function allowedActions(session: AuthSession, order: Pick<OrderSummary, "status" | "location" | "inventoryMovementId">): Action[] {
  if (!productionRoles.some(role => session.authorization.roles.includes(role))) return [];
  const admin = isAdmin(session);
  if (!admin && assignedPlant(session)?.id !== order.location.id) return [];
  const result: Action[] = ["detail"];
  if (order.status === "DRAFT" && admin) result.push("edit", "plan", "cancel");
  if (order.status === "PLANNED") result.push("start", ...(admin ? ["cancel" as const] : []));
  if (order.status === "IN_PROGRESS") result.push("waste", "complete", "performance");
  if (order.status === "COMPLETED") {
    result.push("performance");
    if (order.inventoryMovementId) result.push("movement");
  }
  return result;
}
export const actionLabels: Record<Action, string> = {
  detail: "Ver detalle", edit: "Editar", plan: "Planificar", start: "Iniciar",
  cancel: "Cancelar orden", complete: "Completar producción", waste: "Registrar desperdicio",
  performance: "Ver rendimiento", movement: "Ver movimiento valorizado",
};
export const statusLabels = {
  DRAFT: "Borrador", PLANNED: "Planificada", IN_PROGRESS: "En proceso",
  COMPLETED: "Completada", CANCELLED: "Cancelada",
};
