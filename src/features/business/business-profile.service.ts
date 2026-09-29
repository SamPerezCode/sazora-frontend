import { API_BASE_URL } from "../../config/env";
import { ApiError, request } from "../../lib/http/client";
import { businessProfileResponseSchema } from "./business-profile.schema";
import type { BusinessIdentity } from "./business-profile.schema";

function resolveLogoUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, `${API_BASE_URL}/`);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function getBusinessIdentity(
  businessId: string,
  accessToken: string,
  signal: AbortSignal
): Promise<BusinessIdentity> {
  const response = await request(
    "/business-settings",
    businessProfileResponseSchema,
    {
      accessToken,
      signal,
    }
  );

  const profile = response.data.settings;

  if (profile.businessId !== businessId) {
    throw new ApiError(
      502,
      "BUSINESS_MISMATCH",
      "No pudimos verificar el negocio."
    );
  }

  return {
    id: profile.businessId,
    name: profile.name,
    slug: profile.slug,
    logoUrl: resolveLogoUrl(profile.logoUrl),
  };
}
