import { ApiError, request } from "../../../lib/http/client";
import {
  loginResponseSchema,
  sessionResponseSchema,
} from "../schemas/auth.schema";
import type {
  AuthSession,
  LoginData,
  LoginRequest,
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
    },
    authorization: current,
  };
}

export async function startSession(
  input: LoginRequest,
  signal?: AbortSignal
): Promise<AuthSession> {
  const response = await request("/auth/login", loginResponseSchema, {
    method: "POST",
    body: input,
    signal,
  });

  return validateSession(response.data, signal);
}
