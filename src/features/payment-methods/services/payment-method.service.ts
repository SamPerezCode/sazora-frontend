import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  hasAnyPermission,
  hasPermission,
} from "../../auth/utils/permissions";
import {
  paymentMethodFormSchema,
  paymentMethodResponseSchema,
  paymentMethodsResponseSchema,
} from "../schemas/payment-method.schema";
import type {
  PaymentMethod,
  PaymentMethodDraft,
} from "../schemas/payment-method.schema";

function options(
  session: AuthSession,
  signal?: AbortSignal,
  write = false
) {
  const allowed = write
    ? hasPermission(session, "business.settings.manage")
    : hasAnyPermission(session, [
        "cash.sessions.read",
        "business.settings.read",
        "orders.close",
      ]);

  if (!allowed) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para esta operación con formas de pago."
    );
  }

  return {
    accessToken: session.accessToken,
    signal,
  };
}

function verify(method: PaymentMethod, session: AuthSession) {
  if (method.businessId !== session.business.id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La forma de pago no pertenece al negocio de la sesión."
    );
  }

  return method;
}

export async function getPaymentMethods(
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/payment-methods?activeOnly=false",
    paymentMethodsResponseSchema,
    {
      ...options(session, signal),
      cache: "no-store",
    }
  );

  return response.data.paymentMethods.map((item) =>
    verify(item, session)
  );
}

export async function getPaymentMethod(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/payment-methods/" + encodeURIComponent(id),
    paymentMethodResponseSchema,
    {
      ...options(session, signal),
      cache: "no-store",
    }
  );

  return verify(response.data.paymentMethod, session);
}

export async function savePaymentMethod(
  draft: PaymentMethodDraft,
  id: string | null,
  session: AuthSession,
  signal: AbortSignal
) {
  const authorization = options(session, signal, true);
  const body = paymentMethodFormSchema.parse(draft);

  const response = await request(
    "/payment-methods" + (id ? "/" + encodeURIComponent(id) : ""),
    paymentMethodResponseSchema,
    {
      ...authorization,
      method: id ? "PATCH" : "POST",
      body,
    }
  );

  return verify(response.data.paymentMethod, session);
}

export async function setPaymentMethodStatus(
  id: string,
  isActive: boolean,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/payment-methods/" + encodeURIComponent(id) + "/status",
    paymentMethodResponseSchema,
    {
      ...options(session, signal, true),
      method: "PATCH",
      body: { isActive },
    }
  );

  return verify(response.data.paymentMethod, session);
}
