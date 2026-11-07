import type {
  AuthSession,
  CurrentSession,
} from "../types/auth.types";

type Authorization = Pick<
  CurrentSession,
  "permissions" | "locationAccess"
>;

type Source = AuthSession | Authorization;

function authorization(source: Source): Authorization {
  return "authorization" in source ? source.authorization : source;
}

export function hasPermission(
  source: Source,
  permission: string
): boolean {
  return authorization(source).permissions.includes(permission);
}

export function hasEveryPermission(
  source: Source,
  permissions: readonly string[]
): boolean {
  return permissions.every((permission) =>
    hasPermission(source, permission)
  );
}

export function hasAnyPermission(
  source: Source,
  permissions: readonly string[]
): boolean {
  return permissions.some((permission) =>
    hasPermission(source, permission)
  );
}

export function hasGlobalLocationAccess(source: Source): boolean {
  return authorization(source).locationAccess.hasGlobalAccess;
}

export function canAccessLocation(
  source: Source,
  locationId: string
): boolean {
  if (!locationId) return false;

  const access = authorization(source).locationAccess;

  return (
    access.hasGlobalAccess ||
    access.locations.some(
      (location) =>
        location.id === locationId && location.isActive !== false
    )
  );
}

export function getDefaultLocationId(source: Source): string | null {
  const access = authorization(source).locationAccess;

  if (!access.defaultLocationId) return null;

  return canAccessLocation(source, access.defaultLocationId)
    ? access.defaultLocationId
    : null;
}

export function getAssignedLocations(
  source: Source,
  locationType?: "POINT_OF_SALE" | "PRODUCTION_WAREHOUSE"
) {
  return authorization(source).locationAccess.locations.filter(
    (location) =>
      location.isActive !== false &&
      (!locationType || location.locationType === locationType)
  );
}

export function getInitialAssignedLocationId(
  source: Source,
  locationType?: "POINT_OF_SALE" | "PRODUCTION_WAREHOUSE"
): string {
  const options = getAssignedLocations(source, locationType);
  const preferred = getDefaultLocationId(source);

  return (
    options.find((location) => location.id === preferred)?.id ??
    options[0]?.id ??
    ""
  );
}
