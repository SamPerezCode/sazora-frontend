import { z } from "zod";

const id = z.string().regex(/^[1-9]\d*$/);

const activePreparation = z.enum([
  "PENDING",
  "IN_PREPARATION",
  "READY",
]);

const quantities = {
  previousQuantity: z.number().int().positive(),
  cancelledQuantity: z.number().int().positive(),
  remainingQuantity: z.number().int().positive(),
};

const coherent = (value: {
  previousQuantity: number;
  cancelledQuantity: number;
  remainingQuantity: number;
}) =>
  value.previousQuantity - value.cancelledQuantity ===
  value.remainingQuantity;

export const cancelQuantityInputSchema = z.object({
  quantity: z
    .number()
    .int("Usa una cantidad entera.")
    .positive("Cancela al menos una unidad."),

  reason: z
    .string()
    .trim()
    .min(3, "Escribe un motivo de al menos 3 caracteres.")
    .max(500, "El motivo admite máximo 500 caracteres."),
});

const adjustmentSchema = z
  .object({
    orderItemId: id,
    ...quantities,
    cancellationReason: z.string(),
    kitchenTicketId: id,
    kitchenTicketItemId: id,
    kitchenTicketVersion: z.number().int().positive(),
    preparationStatus: activePreparation,
    orderStatus: z.literal("CONFIRMED"),
    inventoryReversalMovementId: id.nullable(),
    adjustedAt: z.iso.datetime({ offset: true }),
  })
  .refine(coherent, "Las cantidades recibidas no coinciden.");

export const cancelQuantityResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    adjustment: adjustmentSchema,
  }),
});

export const quantityCancelledEventSchema = z
  .object({
    businessId: id,
    orderId: id,
    orderItemId: id,
    kitchenTicketId: id,
    kitchenTicketItemId: id,
    kitchenTicketVersion: z.number().int().positive(),
    ...quantities,
    preparationStatus: activePreparation,
    cancellationReason: z.string(),
    cancelledByMembershipId: id,
    adjustedAt: z.iso.datetime({ offset: true }),
  })
  .refine(coherent, "Las cantidades recibidas no coinciden.");

export type QuantityCancelledEvent = z.infer<
  typeof quantityCancelledEventSchema
>;

export type QuantityCancellationResult = {
  ok: boolean;
  close?: boolean;
  message?: string;
  fields?: Partial<Record<"quantity" | "reason", string>>;
  offerFull?: boolean;
};

export function quantityChangeKey(value: {
  orderId: string;
  orderItemId: string;
  kitchenTicketVersion: number;
  adjustedAt: string;
}) {
  return [
    value.orderId,
    value.orderItemId,
    value.kitchenTicketVersion,
    value.adjustedAt,
  ].join(":");
}

export function quantityRecovery(
  item:
    | {
        status: "ACTIVE" | "CANCELLED";
        quantity: number;
      }
    | undefined,
  previousQuantity: number,
  quantityToCancel: number
) {
  if (!item) return "missing";
  if (item.status === "CANCELLED") return "cancelled";

  if (item.quantity === previousQuantity - quantityToCancel) {
    return "applied";
  }

  if (item.quantity === previousQuantity) {
    return "unchanged";
  }

  return "changed";
}
