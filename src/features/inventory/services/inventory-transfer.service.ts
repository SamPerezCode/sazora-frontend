import { z } from "zod";

import type { AuthSession } from "../../auth/types/auth.types";
import { ApiError } from "../../../lib/http/client";
import { invalidateInventory } from "../../../lib/inventory-invalidation";
import { getLocations } from "../../business/services/organization.service";

import { baseUnitSchema } from "../schemas/inventory.schema";

import {
  balancesSchema,
  id,
  numeric,
  locationSchema,
  stockQuantity,
} from "../schemas/inventory-location.schema";

import type { Balance } from "../schemas/inventory-location.schema";

import { inventoryRequest } from "./inventory-location.service";
import { fixed, multiply, quantity } from "../utils/inventory-value";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const transferQuantity = stockQuantity.pipe(
  z
    .string()
    .refine(
      (value) => fixed(value) > 0n,
      "La cantidad debe ser mayor que cero."
    )
);

export const transferInput = z
  .object({
    sourceLocationId: id,
    destinationLocationId: id,

    externalReference: optionalText(120),

    notes: z
      .string()
      .trim()
      .min(3, "Escribe un motivo de al menos 3 caracteres.")
      .max(500),

    lines: z
      .array(
        z
          .object({
            inventoryItemId: id,
            quantity: transferQuantity,
            notes: optionalText(500),
          })
          .strict()
      )
      .min(1, "Agrega al menos un artículo.")
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sourceLocationId === value.destinationLocationId) {
      context.addIssue({
        code: "custom",
        path: ["destinationLocationId"],
        message: "Origen y destino deben ser diferentes.",
      });
    }

    const uniqueItems = new Set(
      value.lines.map((line) => line.inventoryItemId)
    );

    if (uniqueItems.size !== value.lines.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "No puedes repetir artículos.",
      });
    }
  });

export const transferSchema = z.object({
  id,
  businessId: id,

  sourceLocation: locationSchema,
  destinationLocation: locationSchema,

  sourceMovementId: id,
  destinationMovementId: id,

  status: z.literal("COMPLETED"),

  externalReference: z.string().nullable(),
  notes: z.string().nullable(),

  createdByMembershipId: id,

  createdAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }),

  lines: z
    .array(
      z.object({
        inventoryItemId: id,
        inventoryItemName: z.string(),
        baseUnit: baseUnitSchema,
        quantity: numeric,
        unitCost: numeric,
        totalCost: numeric,
        notes: z.string().nullable(),
      })
    )
    .min(1),
});

export type TransferInput = z.output<typeof transferInput>;
export type Transfer = z.infer<typeof transferSchema>;

function assertAdmin(session: AuthSession) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para realizar transferencias."
    );
  }
}

export async function loadTransferLocations(
  session: AuthSession,
  signal: AbortSignal
) {
  assertAdmin(session);

  const locations = await getLocations(session, signal);

  return locations.filter(
    (location) =>
      location.businessId === session.business.id &&
      location.isActive &&
      location.isInventoryLocation
  );
}

export async function loadTransferBalances(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) {
  assertAdmin(session);

  if (!locationId) return [];

  const result = await inventoryRequest(
    session,
    "/inventory-items/location-balances?locationId=" +
      id.parse(locationId),
    balancesSchema,
    signal
  );

  if (
    result.scope.type !== "LOCATION" ||
    result.scope.location.id !== locationId ||
    result.balances.some((row) => row.location.id !== locationId)
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Los saldos no corresponden al origen seleccionado."
    );
  }

  return result.balances;
}

export function previewTransfer(
  body: TransferInput,
  balances: Balance[]
) {
  return body.lines.map((line) => {
    const balance = balances.find(
      (row) =>
        row.inventoryItemId === line.inventoryItemId &&
        row.location.id === body.sourceLocationId
    );

    if (
      !balance ||
      !balance.isItemActive ||
      !balance.location.isActive
    ) {
      throw new Error(
        "El artículo no está disponible en el origen. Actualiza los saldos."
      );
    }

    if (
      balance.valuationStatus !== "VALUED" ||
      balance.averageUnitCost === null
    ) {
      throw new Error(
        balance.name + ": sin valoración. No se puede transferir."
      );
    }

    if (fixed(balance.currentStock) < fixed(line.quantity)) {
      throw new Error(
        balance.name +
          ": existencia insuficiente. Disponible: " +
          quantity(balance.currentStock, balance.baseUnit) +
          "."
      );
    }

    return {
      ...line,
      inventoryItemName: balance.name,
      sku: balance.sku,
      baseUnit: balance.baseUnit,
      unitCost: balance.averageUnitCost,
      totalCost: multiply(line.quantity, balance.averageUnitCost),
    };
  });
}

export async function createTransfer(
  session: AuthSession,
  signal: AbortSignal,
  raw: TransferInput
) {
  assertAdmin(session);

  const body = transferInput.parse(raw);

  const { transfer } = await inventoryRequest(
    session,
    "/inventory-movements/transfers",
    z.object({ transfer: transferSchema }),
    signal,
    "POST",
    body
  );

  if (
    transfer.businessId !== session.business.id ||
    transfer.sourceLocation.id !== body.sourceLocationId ||
    transfer.destinationLocation.id !== body.destinationLocationId ||
    transfer.sourceMovementId === transfer.destinationMovementId ||
    transfer.lines.length !== body.lines.length ||
    new Set(transfer.lines.map((line) => line.inventoryItemId))
      .size !== body.lines.length ||
    transfer.lines.some((line) => {
      const sent = body.lines.find(
        (entry) => entry.inventoryItemId === line.inventoryItemId
      );

      return !sent || fixed(sent.quantity) !== fixed(line.quantity);
    })
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "No pudimos verificar la transferencia recibida."
    );
  }

  invalidateInventory(session.business.id);

  return transfer;
}

const messages: Record<string, string> = {
  TRANSFER_SOURCE_LOCATION_NOT_FOUND:
    "No se encontró la ubicación de origen.",

  TRANSFER_DESTINATION_LOCATION_NOT_FOUND:
    "No se encontró la ubicación de destino.",

  TRANSFER_SOURCE_LOCATION_INACTIVE:
    "La ubicación de origen está inactiva.",

  TRANSFER_DESTINATION_LOCATION_INACTIVE:
    "La ubicación de destino está inactiva.",

  TRANSFER_SOURCE_LOCATION_NOT_INVENTORY_ENABLED:
    "El origen no está habilitado para inventario.",

  TRANSFER_DESTINATION_LOCATION_NOT_INVENTORY_ENABLED:
    "El destino no está habilitado para inventario.",

  INVENTORY_ITEM_NOT_AVAILABLE:
    "Un artículo ya no está disponible. Revisa las líneas.",

  UNVALUED_INVENTORY_STOCK:
    "Un artículo no tiene un costo de inventario valorado.",

  TRANSFER_UNIT_COST_REQUIRED:
    "Un artículo no tiene un costo válido para transferir.",

  INSUFFICIENT_INVENTORY_STOCK:
    "La existencia disponible cambió. Revisa los saldos actualizados.",
};

export function transferError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("\n");
  }

  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "No tienes permiso para realizar transferencias.";
    }

    if (error.status === 401) {
      return "La sesión ya no es válida. Inicia sesión nuevamente.";
    }

    return messages[error.code] ?? error.message;
  }

  return error instanceof Error
    ? error.message
    : "No se pudo registrar la transferencia.";
}
