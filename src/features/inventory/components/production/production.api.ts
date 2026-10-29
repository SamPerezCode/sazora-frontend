import { z } from "zod";
import type { AuthSession } from "../../../auth/types/auth.types";
import { request, ApiError } from "../../../../lib/http/client";
import { assertProduction, plantScope } from "./production.access";

export async function api<T>(
  session: AuthSession,
  signal: AbortSignal,
  path: string,
  schema: z.ZodType<T>,
  method: "GET" | "PUT" | "POST" | "PATCH" = "GET",
  body?: unknown
) {
  assertProduction(session);

  const response = await request(
    path,
    z.object({
      status: z.literal("success"),
      data: schema,
    }),
    {
      accessToken: session.accessToken,
      signal,
      method,
      body,
      cache: "no-store",
    }
  );

  return response.data;
}

export function checkOrder<
  T extends {
    id: string;
    businessId: string;
    location: { id: string };
  },
>(session: AuthSession, order: T, expectedId?: string): T {
  if (
    order.businessId !== session.business.id ||
    (expectedId && order.id !== expectedId)
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La orden recibida no corresponde a la consulta."
    );
  }

  plantScope(session, order.location.id);
  return order;
}
