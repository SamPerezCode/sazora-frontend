import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import {
  taxClassResponse,
  taxClassesResponse,
  taxDetailsFormSchema,
  taxTypeSchema,
  validateRate,
} from "../schemas/tax-class.schema";
import type { TaxClass, TaxDraft } from "../schemas/tax-class.schema";

const contextResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    context: z.object({
      businessId: z.string(),
      timezone: z.string().refine((value) => {
        try {
          new Intl.DateTimeFormat("es", {
            timeZone: value,
          });

          return value.length > 0;
        } catch {
          return false;
        }
      }),
    }),
  }),
});

function options(
  session: AuthSession,
  signal: AbortSignal,
  write = false
) {
  const permission = write ? "taxes.manage" : "taxes.read";

  if (!hasPermission(session, permission)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para esta operación con impuestos."
    );
  }

  return {
    accessToken: session.accessToken,
    signal,
  };
}

function verify(item: TaxClass, session: AuthSession) {
  if (
    item.businessId !== session.business.id ||
    item.rates.some(
      (rate) =>
        rate.businessId !== session.business.id ||
        rate.taxClassId !== item.id
    )
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El impuesto no corresponde al negocio actual."
    );
  }

  return item;
}

export async function getTaxWorkspace(
  session: AuthSession,
  signal: AbortSignal
) {
  const config = {
    ...options(session, signal),
    cache: "no-store" as const,
  };

  const [response, context] = await Promise.all([
    request("/tax-classes", taxClassesResponse, config),
    request("/auth/context", contextResponse, config),
  ]);

  if (context.data.context.businessId !== session.business.id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El contexto no corresponde al negocio actual."
    );
  }

  return {
    taxClasses: response.data.taxClasses.map((item) =>
      verify(item, session)
    ),
    timezone: context.data.context.timezone,
  };
}

export async function getTaxClass(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/tax-classes/" + encodeURIComponent(id),
    taxClassResponse,
    {
      ...options(session, signal),
      cache: "no-store",
    }
  );

  return verify(response.data.taxClass, session);
}

export async function saveTaxClass(
  draft: TaxDraft,
  original: TaxClass | undefined,
  session: AuthSession,
  signal: AbortSignal
) {
  const authorization = options(session, signal, true);
  const details = taxDetailsFormSchema.parse(draft);

  const body = original
    ? details
    : {
        ...details,
        taxType: taxTypeSchema.parse(draft.taxType),
        initialRate: validateRate(draft),
      };

  const response = await request(
    "/tax-classes" +
      (original ? "/" + encodeURIComponent(original.id) : ""),
    taxClassResponse,
    {
      ...authorization,
      method: original ? "PATCH" : "POST",
      body,
    }
  );

  return verify(response.data.taxClass, session);
}

export async function createTaxRate(
  draft: TaxDraft,
  original: TaxClass,
  session: AuthSession,
  signal: AbortSignal
) {
  const authorization = options(session, signal, true);

  if (!original.isActive) {
    throw new ApiError(
      409,
      "TAX_CLASS_INACTIVE",
      "Activa la clase antes de agregar una tarifa."
    );
  }

  const body = validateRate(draft, original);

  const response = await request(
    "/tax-classes/" + encodeURIComponent(original.id) + "/rates",
    taxClassResponse,
    {
      ...authorization,
      method: "POST",
      body,
    }
  );

  return verify(response.data.taxClass, session);
}

export async function setTaxClassStatus(
  original: TaxClass,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/tax-classes/" + encodeURIComponent(original.id) + "/status",
    taxClassResponse,
    {
      ...options(session, signal, true),
      method: "PATCH",
      body: {
        isActive: !original.isActive,
      },
    }
  );

  return verify(response.data.taxClass, session);
}
