import { ApiError, request } from "../../lib/http/client";

import type { SalesScope } from "../sales/services/sales.service";
import { getOrder } from "../sales/services/sales.service";
import { getOrderKitchenHistory } from "../sales/services/sales-history.service";

import {
  initialPrintBody,
  kitchenPrintResponseSchema,
  kitchenPrintsResponseSchema,
  kitchenSettingsResponseSchema,
  reprintInputSchema,
} from "./kitchen-flow.schema";

import type {
  KitchenPrint,
  KitchenWorkflowMode,
  PrintTicket,
} from "./kitchen-flow.schema";

function invalidResponse(): never {
  throw new ApiError(
    502,
    "INVALID_RESPONSE",
    "La respuesta no corresponde a la cuenta solicitada."
  );
}

export async function getKitchenSettings(
  token: string,
  scope: SalesScope,
  signal?: AbortSignal
) {
  const response = await request(
    `/kitchen-settings/${scope.location.id}`,
    kitchenSettingsResponseSchema,
    {
      accessToken: token,
      cache: "no-store",
      signal,
    }
  );

  const settings = response.data.kitchenSettings;

  if (
    settings.businessId !== scope.businessId ||
    settings.locationId !== scope.location.id ||
    settings.location.id !== scope.location.id
  ) {
    invalidResponse();
  }

  if (settings.location.locationType !== "POINT_OF_SALE") {
    throw new ApiError(
      409,
      "LOCATION_NOT_POINT_OF_SALE",
      "Selecciona un punto de venta."
    );
  }

  return settings;
}

export async function updateKitchenSettings(
  token: string,
  scope: SalesScope,
  workflowMode: KitchenWorkflowMode
) {
  const response = await request(
    `/kitchen-settings/${scope.location.id}`,
    kitchenSettingsResponseSchema,
    {
      method: "PATCH",
      accessToken: token,
      body: { workflowMode },
    }
  );

  const settings = response.data.kitchenSettings;

  if (
    settings.businessId !== scope.businessId ||
    settings.locationId !== scope.location.id ||
    settings.location.id !== scope.location.id ||
    settings.location.locationType !== "POINT_OF_SALE"
  ) {
    invalidResponse();
  }

  return settings;
}

export async function getOrderKitchenTickets(
  token: string,
  scope: SalesScope,
  orderId: string,
  signal?: AbortSignal
) {
  const readSignal = signal ?? new AbortController().signal;

  // El listado activo de Cocina excluye PRINT_ONLY y comandas terminadas.
  // El historial real conserva las comandas de ambos modos.
  const [order, history] = await Promise.all([
    getOrder(token, orderId, scope, readSignal),
    getOrderKitchenHistory(token, scope, orderId, readSignal),
  ]);

  if (order.id !== history.orderId) invalidResponse();

  return history.tickets.map((ticket) => ({
    ...ticket,
    businessId: order.businessId,
    orderId: order.id,
  }));
}

function verifyPrint(
  print: KitchenPrint,
  scope: SalesScope,
  ticket: PrintTicket
): KitchenPrint {
  const snapshot = print.contentSnapshot;

  if (
    print.businessId !== scope.businessId ||
    print.kitchenTicketId !== ticket.id ||
    snapshot.businessId !== scope.businessId ||
    snapshot.kitchenTicketId !== ticket.id ||
    snapshot.orderId !== ticket.orderId ||
    snapshot.preparationAreaId !== ticket.preparationAreaId ||
    snapshot.ticketVersion !== print.ticketVersion
  ) {
    invalidResponse();
  }

  return print;
}

export interface KitchenPrintApi {
  history(ticket: PrintTicket): Promise<KitchenPrint[]>;
  initial(ticket: PrintTicket): Promise<KitchenPrint>;
  reprint(
    ticket: PrintTicket,
    source: KitchenPrint,
    reason: string,
    printerName: string | null
  ): Promise<KitchenPrint>;
}

export function createKitchenPrintApi(
  token: string,
  scope: SalesScope
): KitchenPrintApi {
  return {
    async history(ticket) {
      const response = await request(
        `/kitchen-tickets/${ticket.id}/prints`,
        kitchenPrintsResponseSchema,
        {
          accessToken: token,
          cache: "no-store",
        }
      );

      return response.data.prints.map((print) =>
        verifyPrint(print, scope, ticket)
      );
    },

    async initial(ticket) {
      const response = await request(
        `/kitchen-tickets/${ticket.id}/prints`,
        kitchenPrintResponseSchema,
        {
          method: "POST",
          accessToken: token,
          body: initialPrintBody(ticket.currentVersion),
        }
      );

      return verifyPrint(response.data.print, scope, ticket);
    },

    async reprint(ticket, source, reason, printerName) {
      const body = reprintInputSchema.parse({
        reason,
        printerName,
      });

      const response = await request(
        `/kitchen-tickets/${ticket.id}/prints/${source.id}/reprint`,
        kitchenPrintResponseSchema,
        {
          method: "POST",
          accessToken: token,
          body,
        }
      );

      return verifyPrint(response.data.print, scope, ticket);
    },
  };
}
