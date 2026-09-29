import { ApiError, request } from "../../lib/http/client";
import { resolveFileUrl } from "../../lib/files";
import { businessSettingsResponseSchema } from "./business-settings.schema";
import type {
  BusinessMutation,
  BusinessSettings,
} from "./business-settings.schema";
import type { BusinessIdentity } from "./business-profile.schema";

function verify(
  settings: BusinessSettings,
  businessId: string
): BusinessSettings {
  if (settings.businessId !== businessId) {
    throw new ApiError(
      502,
      "BUSINESS_MISMATCH",
      "No pudimos verificar el negocio."
    );
  }

  return settings;
}

export function toBusinessIdentity(
  settings: BusinessSettings
): BusinessIdentity {
  return {
    id: settings.businessId,
    name: settings.name,
    slug: settings.slug,
    logoUrl: resolveFileUrl(settings.logoUrl),
  };
}

export async function getBusinessSettings(
  businessId: string,
  accessToken: string,
  signal: AbortSignal
): Promise<BusinessSettings> {
  const response = await request(
    "/business-settings",
    businessSettingsResponseSchema,
    {
      accessToken,
      signal,
    }
  );

  return verify(response.data.settings, businessId);
}

export async function getBusinessIdentity(
  businessId: string,
  accessToken: string,
  signal: AbortSignal
): Promise<BusinessIdentity> {
  return toBusinessIdentity(
    await getBusinessSettings(businessId, accessToken, signal)
  );
}

export async function mutateBusinessSettings(
  businessId: string,
  accessToken: string,
  action: BusinessMutation,
  signal: AbortSignal
): Promise<BusinessSettings> {
  const body =
    action.kind === "settings"
      ? action.patch
      : action.file
        ? new FormData()
        : undefined;

  if (
    body instanceof FormData &&
    action.kind === "logo" &&
    action.file
  ) {
    body.append("image", action.file);
  }

  const response = await request(
    action.kind === "settings"
      ? "/business-settings"
      : "/business-settings/logo",
    businessSettingsResponseSchema,
    {
      accessToken,
      signal,
      body,
      method:
        action.kind === "settings"
          ? "PATCH"
          : action.file
            ? "PUT"
            : "DELETE",
    }
  );

  return verify(response.data.settings, businessId);
}
