import { z } from "zod";

const id = z.string().regex(/^[1-9]\d*$/);
const date = z.iso.datetime({ offset: true });

export const kitchenWorkflowModeSchema = z.enum([
  "PRINT_ONLY",
  "PRINT_AND_SCREEN",
]);

export type KitchenWorkflowMode = z.infer<
  typeof kitchenWorkflowModeSchema
>;

export const WORKFLOW_LABELS: Record<KitchenWorkflowMode, string> = {
  PRINT_ONLY: "Solo comandas impresas",
  PRINT_AND_SCREEN: "Comandas impresas + pantalla",
};

export const WORKFLOW_DESCRIPTIONS: Record<
  KitchenWorkflowMode,
  string
> = {
  PRINT_ONLY: "La cocina trabaja con las comandas impresas.",
  PRINT_AND_SCREEN:
    "La cocina gestiona la preparación desde su pantalla.",
};

export function resolveKitchenMode(
  order: {
    status: string;
    kitchenWorkflowMode: KitchenWorkflowMode | null;
  },
  locationMode: KitchenWorkflowMode | null
): KitchenWorkflowMode | null {
  return order.status === "OPEN"
    ? locationMode
    : order.kitchenWorkflowMode;
}

export const kitchenSettingsSchema = z.object({
  businessId: id,
  locationId: id,
  workflowMode: kitchenWorkflowModeSchema,
  isConfigured: z.boolean(),
  location: z.object({
    id,
    code: z.string(),
    name: z.string(),
    locationType: z.enum(["POINT_OF_SALE", "PRODUCTION_WAREHOUSE"]),
    isActive: z.boolean(),
  }),
  createdAt: date.nullable(),
  updatedAt: date.nullable(),
});

export type LocationKitchenSettings = z.infer<
  typeof kitchenSettingsSchema
>;

export const kitchenSettingsResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    kitchenSettings: kitchenSettingsSchema,
  }),
});

export const kitchenPrintSnapshotSchema = z.object({
  businessId: id,
  businessName: z.string(),
  kitchenTicketFooter: z.string().nullable(),
  kitchenTicketId: id,
  orderId: id,
  preparationAreaId: id,
  preparationAreaName: z.string(),
  ticketVersion: z.number().int().positive(),
  serviceType: z.enum(["TABLE", "TAKEAWAY", "DELIVERY"]),
  restaurantTableCode: z.string().nullable(),
  restaurantTableName: z.string().nullable(),
  orderNotes: z.string().nullable(),
  generatedAt: date,
  items: z.array(
    z.object({
      kitchenTicketItemId: id,
      orderItemId: id,
      productName: z.string(),
      fulfillmentMode: z.string(),
      quantity: z.number().int().positive(),
      notes: z.string().nullable(),
      preparationStatus: z.string(),
    })
  ),
});

export const kitchenPrintSchema = z.object({
  id,
  businessId: id,
  kitchenTicketId: id,
  printedByMembershipId: id,
  ticketVersion: z.number().int().positive(),
  printType: z.enum(["INITIAL", "MODIFICATION", "REPRINT"]),
  reason: z.string().nullable(),
  printerName: z.string().nullable(),
  contentSnapshot: kitchenPrintSnapshotSchema,
  createdAt: date,
});

export type KitchenPrint = z.infer<typeof kitchenPrintSchema>;

export const kitchenPrintResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ print: kitchenPrintSchema }),
});

export const kitchenPrintsResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    prints: z.array(kitchenPrintSchema),
  }),
});

export const reprintInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Escribe el motivo de la reimpresión.")
    .max(500, "El motivo no puede superar 500 caracteres."),
  printerName: z
    .string()
    .trim()
    .max(150, "El nombre de la impresora es demasiado largo.")
    .nullable(),
});

export interface PrintTicket {
  id: string;
  orderId: string;
  preparationAreaId: string;
  preparationAreaName: string;
  currentVersion: number;
}

export function initialPrintBody(version: number) {
  return {
    reason: version > 1 ? "Adición enviada a cocina" : null,
    printerName: null,
  };
}

export function kitchenErrorMessage(cause: unknown): string {
  const messages: Record<string, string> = {
    LOCATION_ACCESS_DENIED:
      "Ya no tienes acceso a este punto de venta. Selecciona otro.",
    LOCATION_NOT_POINT_OF_SALE:
      "La configuración de cocina solo está disponible para puntos de venta.",
    KITCHEN_TICKET_PRINT_REASON_REQUIRED:
      "Escribe el motivo para registrar esta impresión.",
    ORDER_REQUIRES_KITCHEN_SCREEN:
      "Esta orden debe completar su proceso desde la pantalla de cocina.",
    KITCHEN_SCREEN_WORKFLOW_DISABLED:
      "Esta orden trabaja únicamente con comandas impresas.",
    ORDER_NOT_CONFIRMED:
      "El estado de la orden cambió. Actualiza la cuenta.",
  };

  if (
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    typeof cause.code === "string" &&
    messages[cause.code]
  ) {
    return messages[cause.code];
  }

  return cause instanceof Error
    ? cause.message
    : "No fue posible completar la operación.";
}

export function printDate(value: string): string {
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
