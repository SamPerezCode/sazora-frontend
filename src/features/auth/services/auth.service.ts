import { ApiError, request } from "../../../lib/http/client";
import {
  loginDataSchema,
  loginResponseSchema,
  roleChoiceSchema,
  selectRoleResponseSchema,
  sessionResponseSchema,
} from "../schemas/auth.schema";
import type {
  AuthSession,
  LoginData,
  LoginRequest,
  PendingRoleSelection,
  RoleChoice,
} from "../types/auth.types";

export async function validateSession(
  identity: LoginData,
  signal?: AbortSignal
): Promise<AuthSession> {
  const response = await request(
    "/auth/session",
    sessionResponseSchema,
    {
      accessToken: identity.accessToken,
      cache: "no-store",
      signal,
    }
  );

  const current = response.data.session;

  if (
    current.userId !== identity.user.id ||
    current.businessId !== identity.business.id ||
    current.membershipId !== identity.membership.id
  ) {
    throw new ApiError(
      401,
      "SESSION_MISMATCH",
      "La sesión no corresponde a este usuario y negocio."
    );
  }

  return {
    ...identity,
    membership: {
      ...identity.membership,
      roles: current.roles,
      permissions: current.permissions,
    },
    locationAccess: current.locationAccess,
    authorization: current,
  };
}

export async function startSession(
  input: LoginRequest,
  signal?: AbortSignal
) {
  const response = await request("/auth/login", loginResponseSchema, {
    method: "POST",
    body: input,
    signal,
    cache: "no-store",
  });

  return response.data;
}

export async function selectSessionRole(
  pending: PendingRoleSelection,
  choice: RoleChoice,
  signal?: AbortSignal
): Promise<LoginData> {
  const selected = roleChoiceSchema.parse(choice);

  if (Date.now() >= pending.expiresAt) {
    throw new ApiError(
      401,
      "INVALID_ROLE_SELECTION_TOKEN",
      "La selección venció. Inicia sesión nuevamente."
    );
  }

  if (
    selected.mode === "SINGLE_ROLE" &&
    !pending.membership.roles.includes(selected.role)
  ) {
    throw new ApiError(
      403,
      "ROLE_NOT_ASSIGNED",
      "El rol seleccionado ya no está disponible."
    );
  }

  const response = await request(
    "/auth/session/select-role",
    selectRoleResponseSchema,
    {
      method: "POST",
      body: {
        ...selected,
        roleSelectionToken: pending.roleSelectionToken,
      },
      signal,
      cache: "no-store",
    }
  );

  const result = response.data;

  const sameRoles = (left: string[], right: string[]) =>
    JSON.stringify([...new Set(left)].sort()) ===
    JSON.stringify([...new Set(right)].sort());

  const expectedRoles =
    selected.mode === "SINGLE_ROLE"
      ? [selected.role]
      : result.membership.assignedRoles;

  if (
    result.membership.id !== pending.membership.id ||
    result.authorizationMode !== selected.mode ||
    !sameRoles(
      result.membership.assignedRoles,
      pending.membership.roles
    ) ||
    !sameRoles(result.membership.effectiveRoles, expectedRoles)
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "No pudimos verificar la sesión seleccionada."
    );
  }

  return loginDataSchema.parse({
    accessToken: result.accessToken,
    authorizationMode: result.authorizationMode,
    user: pending.user,
    business: pending.business,
    membership: {
      id: result.membership.id,
      assignedRoles: result.membership.assignedRoles,
      roles: result.membership.effectiveRoles,
      permissions: result.membership.permissions,
    },
    locationAccess: result.locationAccess,
  });
}
