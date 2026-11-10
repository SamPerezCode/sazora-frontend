import { ApiError, request } from "../../../lib/http/client";
import { resolveFileUrl } from "../../../lib/files";
import {
  businessSettingsResponseSchema,
  initializeBusinessSettingsResponseSchema,
} from "../schemas/business-settings.schema";
import type {
  BusinessMutation,
  BusinessSettings,
} from "../schemas/business-settings.schema";
import type { BusinessIdentity } from "../schemas/business-profile.schema";

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

const INITIALIZE_FORBIDDEN =
  "No tienes permisos para inicializar la configuración. Solicita ayuda a un administrador.";

const initializationRequests = new Map<
  string,
  Promise<BusinessSettings>
>();

export async function initializeBusinessSettings(
  businessId: string,
  accessToken: string,
  signal: AbortSignal
): Promise<BusinessSettings> {
  signal.throwIfAborted();

  const key = JSON.stringify([businessId, accessToken]);
  let pending = initializationRequests.get(key);

  if (!pending) {
    // La petición compartida conserva el timeout del cliente HTTP.
    // Cancelar un consumidor no cancela la inicialización de los demás.
    pending = request(
      "/business-settings/initialize",
      initializeBusinessSettingsResponseSchema,
      {
        method: "PUT",
        accessToken,
      }
    )
      .then((response) => verify(response.data.settings, businessId))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) {
          throw new ApiError(403, error.code, INITIALIZE_FORBIDDEN);
        }

        throw error;
      })
      .finally(() => {
        initializationRequests.delete(key);
      });

    initializationRequests.set(key, pending);
  }

  const settings = await pending;
  signal.throwIfAborted();

  return settings;
}

export async function loadBusinessSettings(
  businessId: string,
  accessToken: string,
  signal: AbortSignal,
  canInitialize: boolean
): Promise<BusinessSettings> {
  try {
    return await getBusinessSettings(businessId, accessToken, signal);
  } catch (error: unknown) {
    signal.throwIfAborted();

    if (
      !(error instanceof ApiError) ||
      error.status !== 404 ||
      error.code !== "BUSINESS_SETTINGS_NOT_FOUND"
    ) {
      throw error;
    }

    if (!canInitialize) {
      throw new ApiError(403, "FORBIDDEN", INITIALIZE_FORBIDDEN);
    }

    return initializeBusinessSettings(
      businessId,
      accessToken,
      signal
    );
  }
}
