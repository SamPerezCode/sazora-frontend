import { ApiError, request } from "../../../lib/http/client";
import type { SalesScope } from "../../sales/services/sales.service";

import {
  kitchenId,
  ticketsResponse,
  itemMutationResponse,
  ticketMutationResponse,
} from "../schemas/kitchen.schema";

import type { KitchenMutation } from "../schemas/kitchen.schema";

export function kitchenMessage(cause: unknown): string {
  const messages: Record<string, string> = {
    KITCHEN_LOCATION_REQUIRED:
      "Selecciona un punto de venta para consultar cocina.",
    LOCATION_ACCESS_DENIED: "No tienes acceso a esta ubicación.",
    KITCHEN_STATUS_PERMISSION_DENIED:
      "No tienes permiso para realizar este cambio de preparación.",
    LOCATION_NOT_FOUND: "La ubicación ya no está disponible.",
    KITCHEN_TICKET_NOT_FOUND: "La comanda ya no está disponible.",
    DEFAULT_LOCATION_REQUIRED:
      "No tienes una ubicación predeterminada.",
    LOCATION_INACTIVE: "La ubicación se encuentra inactiva.",
    LOCATION_NOT_POINT_OF_SALE:
      "La pantalla de cocina solamente está disponible para puntos de venta.",
    KITCHEN_SCREEN_WORKFLOW_DISABLED:
      "Esta orden trabaja únicamente con comandas impresas.",
    INVALID_KITCHEN_TICKET_STATUS_TRANSITION:
      "La comanda cambió de estado. Actualizaremos la información.",
    INVALID_KITCHEN_STATUS_TRANSITION:
      "El producto cambió de estado. Actualizaremos la información.",
  };

  return cause instanceof ApiError
    ? (messages[cause.code] ?? cause.message)
    : cause instanceof Error
      ? cause.message
      : "No pudimos actualizar cocina.";
}

export async function getKitchenTickets(
  token: string,
  scope: SalesScope,
  area: string,
  signal: AbortSignal
) {
  const query = new URLSearchParams({
    locationId: kitchenId.parse(scope.location.id),
  });

  if (area) {
    query.set("preparationAreaId", kitchenId.parse(area));
  }

  const result = await request(
    "/kitchen-tickets?" + query,
    ticketsResponse,
    {
      accessToken: token,
      signal,
      cache: "no-store",
    }
  );

  if (result.data.locationId !== scope.location.id) {
    throw new Error("La respuesta no corresponde al punto de venta.");
  }

  const tickets = result.data.kitchenTickets.filter(
    (ticket) =>
      ticket.businessId === scope.businessId &&
      ticket.locationId === scope.location.id &&
      ticket.kitchenWorkflowMode === "PRINT_AND_SCREEN" &&
      (!area || ticket.preparationAreaId === area)
  );

  return [
    ...new Map(tickets.map((ticket) => [ticket.id, ticket])).values(),
  ];
}

export async function updateKitchenStatus(
  action: KitchenMutation,
  token: string,
  signal: AbortSignal
) {
  const id = kitchenId.parse(action.ticketId);

  const options = {
    accessToken: token,
    signal,
    method: "PATCH" as const,
    body: { status: action.status },
  };

  if (action.itemId) {
    const itemId = kitchenId.parse(action.itemId);

    const result = await request(
      `/kitchen-tickets/${id}/items/${itemId}/status`,
      itemMutationResponse,
      options
    );

    return {
      ...result.data,
      items: [result.data.item],
    };
  }

  const result = await request(
    `/kitchen-tickets/${id}/status`,
    ticketMutationResponse,
    options
  );

  return result.data;
}
