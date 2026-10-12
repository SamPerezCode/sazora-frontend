import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  fiscalFormSchema,
  fiscalProfileSchema,
  locationFormSchema,
  locationSchema,
} from "../schemas/organization.schema";
import type {
  FiscalDraft,
  LocationDraft,
} from "../schemas/organization.schema";

const profileResponse = z.object({
  status: z.literal("success"),
  data: z.object({ profile: fiscalProfileSchema }),
});

const locationResponse = z.object({
  status: z.literal("success"),
  data: z.object({ location: locationSchema }),
});

const locationsResponse = z.object({
  status: z.literal("success"),
  data: z.object({ locations: z.array(locationSchema) }),
});

function options(session: AuthSession, signal: AbortSignal) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso a Configuración."
    );
  }

  return {
    accessToken: session.accessToken,
    signal,
  };
}

function verify<T extends { businessId: string }>(
  value: T,
  session: AuthSession
): T {
  if (value.businessId !== session.business.id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La respuesta no corresponde a tu organización."
    );
  }

  return value;
}

export async function getFiscalProfile(
  session: AuthSession,
  signal: AbortSignal
) {
  try {
    const response = await request(
      "/organization-profile",
      profileResponse,
      options(session, signal)
    );

    return verify(response.data.profile, session);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === "ORGANIZATION_FISCAL_PROFILE_NOT_CONFIGURED"
    ) {
      return null;
    }

    throw error;
  }
}

export async function saveFiscalProfile(
  draft: FiscalDraft,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/organization-profile",
    profileResponse,
    {
      ...options(session, signal),
      method: "PUT",
      body: fiscalFormSchema.parse(draft),
    }
  );

  return verify(response.data.profile, session);
}

export async function getLocations(
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/locations",
    locationsResponse,
    options(session, signal)
  );

  return response.data.locations.map((value) =>
    verify(value, session)
  );
}

export async function getLocation(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/locations/" + encodeURIComponent(id),
    locationResponse,
    options(session, signal)
  );

  const location = verify(response.data.location, session);

  if (location.id !== id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Ubicación inesperada."
    );
  }

  return location;
}

export async function saveLocation(
  draft: LocationDraft,
  original: LocationDraft | null,
  id: string | null,
  session: AuthSession,
  signal: AbortSignal
) {
  const data = locationFormSchema.parse(draft);
  let body: Partial<typeof data> = data;

  if (id && original) {
    const baseline = locationFormSchema.parse(original);

    body = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) =>
          value !== baseline[key as keyof typeof baseline]
      )
    );

    /*
     * Compatibilidad con el PATCH actual del backend.
     * Sus transformaciones convierten estos campos omitidos
     * en null. Enviamos sus valores para evitar borrarlos.
     */
    for (const key of [
      "address",
      "departmentCode",
      "departmentName",
      "municipalityCode",
      "municipalityName",
      "postalCode",
      "phone",
    ] as const) {
      body[key] = data[key];
    }
  }

  const response = await request(
    id ? "/locations/" + encodeURIComponent(id) : "/locations",
    locationResponse,
    {
      ...options(session, signal),
      method: id ? "PATCH" : "POST",
      body,
    }
  );

  const location = verify(response.data.location, session);

  if (id && location.id !== id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Ubicación inesperada."
    );
  }

  return location;
}

export async function setLocationStatus(
  id: string,
  isActive: boolean,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/locations/" + encodeURIComponent(id) + "/status",
    locationResponse,
    {
      ...options(session, signal),
      method: "PATCH",
      body: { isActive },
    }
  );

  const location = verify(response.data.location, session);

  if (location.id !== id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Ubicación inesperada."
    );
  }

  return location;
}
