import { ApiError, request } from "../../../lib/http/client";
import {
  tableIdSchema,
  tableListResponseSchema,
  tableResponseSchema,
} from "../schemas/restaurant-table.schema";
import type {
  TableAction,
  TableInput,
} from "../schemas/restaurant-table.schema";

export async function getRestaurantTables(
  accessToken: string,
  signal: AbortSignal,
  filters: {
    locationId?: string;
    activeOnly?: boolean;
  } = {}
) {
  const query = new URLSearchParams();

  if (filters.locationId) {
    query.set("locationId", tableIdSchema.parse(filters.locationId));
  }

  if (filters.activeOnly !== undefined) {
    query.set("activeOnly", String(filters.activeOnly));
  }

  const response = await request(
    "/restaurant-tables" + (query.size ? "?" + query : ""),
    tableListResponseSchema,
    {
      accessToken,
      signal,
      cache: "no-store",
    }
  );

  return response.data.restaurantTables;
}

export async function getRestaurantTable(
  id: string,
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request(
    "/restaurant-tables/" + tableIdSchema.parse(id),
    tableResponseSchema,
    {
      accessToken,
      signal,
      cache: "no-store",
    }
  );

  return response.data.restaurantTable;
}

export async function saveRestaurantTable(
  action: TableAction,
  accessToken: string,
  signal: AbortSignal
) {
  const id =
    action.kind === "create" ? "" : tableIdSchema.parse(action.id);

  const path =
    action.kind === "create"
      ? "/restaurant-tables"
      : "/restaurant-tables/" +
        id +
        (action.kind === "status" ? "/status" : "");

  let body: object;

  if (action.kind === "status") {
    body = { isActive: action.isActive };
  } else {
    // locationId nunca forma parte de un PATCH.
    const fields: Partial<TableInput> = {};

    if (action.input.code !== undefined) {
      fields.code = action.input.code;
    }

    if (action.input.name !== undefined) {
      fields.name = action.input.name;
    }

    if (action.input.capacity !== undefined) {
      fields.capacity = action.input.capacity;
    }

    body =
      action.kind === "create"
        ? {
            ...fields,
            locationId: tableIdSchema.parse(action.input.locationId),
          }
        : fields;
  }

  const response = await request(path, tableResponseSchema, {
    method: action.kind === "create" ? "POST" : "PATCH",
    accessToken,
    signal,
    body,
  });

  return response.data.restaurantTable;
}

const messages: Record<string, string> = {
  VALIDATION_ERROR:
    "Revisa la información ingresada e inténtalo nuevamente.",

  RESTAURANT_TABLE_CODE_CONFLICT:
    "Ya existe una mesa con este código en el punto de venta seleccionado.",

  RESTAURANT_TABLE_LOCATION_NOT_AVAILABLE:
    "El punto de venta seleccionado no existe, está inactivo o no pertenece a este negocio.",

  LOCATION_NOT_POINT_OF_SALE:
    "Las mesas solamente pueden crearse en puntos de venta.",

  RESTAURANT_TABLE_NOT_FOUND:
    "La mesa no existe o ya no está disponible.",

  RESTAURANT_TABLE_HAS_ACTIVE_ORDER:
    "No se puede desactivar esta mesa porque tiene una orden activa. Cierra o cancela la orden antes de intentarlo nuevamente.",

  LOCATION_NOT_FOUND: "El punto de venta no existe.",

  LOCATION_ACCESS_DENIED: "No tienes acceso a este punto de venta.",

  DEFAULT_LOCATION_REQUIRED:
    "No tienes una ubicación predeterminada configurada. Solicita ayuda a un administrador.",

  AUTHENTICATION_REQUIRED: "Tu sesión ha expirado.",

  FORBIDDEN: "No tienes permisos para administrar las mesas.",

  NETWORK_ERROR: "Revisa tu conexión e inténtalo de nuevo.",

  REQUEST_TIMEOUT:
    "La solicitud tardó demasiado. Inténtalo nuevamente.",
};

export function tableErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return "No pudimos completar la operación. Inténtalo nuevamente.";
    }

    if (messages[error.code]) {
      return messages[error.code];
    }

    if (error.status === 403) {
      return messages.FORBIDDEN;
    }
  }

  return "No pudimos completar la operación. Inténtalo nuevamente.";
}
