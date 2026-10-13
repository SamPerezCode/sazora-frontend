import type { RoleCode } from "../../auth/types/auth.types";
import type { BusinessLocation } from "../../business/schemas/organization.schema";

export function isActiveProductionPlant(location: BusinessLocation) {
  return location.isActive && location.locationType === "PRODUCTION_WAREHOUSE";
}

export function hasSelectedProductionPlant(
  locations: readonly BusinessLocation[],
  selectedIds: readonly string[]
) {
  return locations.some(
    (location) => isActiveProductionPlant(location) && selectedIds.includes(location.id)
  );
}

export function sortEmployeeLocations(
  locations: readonly BusinessLocation[],
  roles: readonly RoleCode[]
) {
  const result = [...locations];
  if (!roles.includes("PRODUCTION")) return result;

  const rank = (location: BusinessLocation) =>
    isActiveProductionPlant(location) ? 0 : location.isActive ? 1 : 2;

  return result.sort((left, right) => rank(left) - rank(right));
}
