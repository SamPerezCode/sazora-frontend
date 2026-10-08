import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  baseUnitSchema,
  inventoryItemSchema,
  itemTypeSchema,
} from "../schemas/inventory.schema";
import { getInventoryItems } from "./inventory.service";

export const movementLabels = {
  PURCHASE: "Entrada por compra",
  ADJUSTMENT: "Ajuste",
  WASTE: "Desperdicio",
  RETURN: "Devolución",
  OPENING: "Apertura automática",
  PRODUCTION: "Producción automática",
  SALE: "Venta automática",
  REVERSAL: "Reversión automática",
};

export const manualTypes = [
  "PURCHASE",
  "ADJUSTMENT",
  "WASTE",
  "RETURN",
] as const;

export type ManualType = (typeof manualTypes)[number];
export type Direction = "IN" | "OUT";

// Cantidades expresadas como milésimas exactas.
export function units(value: string): bigint | null {
  const text = value.trim().replace(",", ".");

  if (!/^-?\d+(?:\.\d{1,3})?$/.test(text)) return null;

  const negative = text.startsWith("-");

  const [whole, fraction = ""] = (
    negative ? text.slice(1) : text
  ).split(".");

  const result =
    BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));

  return negative ? -result : result;
}

export function decimal(value: bigint): string {
  const positive = value < 0n ? -value : value;

  return (
    (value < 0n ? "-" : "") +
    positive / 1000n +
    "." +
    String(positive % 1000n).padStart(3, "0")
  );
}

export function estimate(
  stock: string,
  quantity: string,
  direction: Direction
): string | null {
  const a = units(stock);
  const b = units(quantity);

  return a === null || b === null || b <= 0n
    ? null
    : decimal(direction === "IN" ? a + b : a - b);
}

const amount = z
  .string()
  .refine((value) => {
    const n = units(value);
    return n !== null && n >= 0n;
  }, "Usa una cantidad positiva o cero, con máximo tres decimales.")
  .transform((value) => decimal(units(value)!));

const text = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres.")
  .transform((value) => value || null);

export const editSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(150),
  sku: z
    .string()
    .trim()
    .max(50)
    .transform((value) => value || null),
  itemType: itemTypeSchema,
  baseUnit: baseUnitSchema,
  minimumStock: amount,
});

export type ItemEdit = z.output<typeof editSchema>;

export const movementInputSchema = z
  .object({
    movementType: z.enum(manualTypes),
    notes: text,
    lines: z
      .array(
        z.object({
          inventoryItemId: z
            .string()
            .regex(/^[1-9]\d*$/, "Selecciona un artículo."),
          direction: z.enum(["IN", "OUT"]),
          quantity: amount.refine(
            (value) => units(value)! > 0n,
            "La cantidad debe ser mayor que cero."
          ),
          notes: text,
        })
      )
      .min(1)
      .max(100),
  })
  .superRefine((data, context) => {
    const ids = new Set<string>();

    if (data.movementType === "ADJUSTMENT" && !data.notes) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Explica el motivo del ajuste.",
      });
    }

    data.lines.forEach((line, index) => {
      if (ids.has(line.inventoryItemId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "inventoryItemId"],
          message: "Este artículo ya está seleccionado.",
        });
      }

      ids.add(line.inventoryItemId);

      const required = data.movementType === "WASTE" ? "OUT" : "IN";

      if (
        data.movementType !== "ADJUSTMENT" &&
        line.direction !== required
      ) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "direction"],
          message: "Dirección no permitida para este movimiento.",
        });
      }
    });
  });

export type MovementInput = z.output<typeof movementInputSchema>;

const signed = z.string().regex(/^-?\d+(?:\.\d{1,3})?$/);

export const movementSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  movementType: z.enum([
    "PURCHASE",
    "ADJUSTMENT",
    "WASTE",
    "RETURN",
    "OPENING",
    "PRODUCTION",
    "SALE",
    "REVERSAL",
  ]),
  notes: z.string().nullable(),
  createdByName: z.string(),
  createdAt: z.string(),
  lines: z.array(
    z.object({
      id: z.string(),
      inventoryItemId: z.string(),
      inventoryItemName: z.string(),
      baseUnit: baseUnitSchema,
      direction: z.enum(["IN", "OUT"]),
      quantity: signed,
      balanceBefore: signed,
      balanceAfter: signed,
      notes: z.string().nullable(),
    })
  ),
});

export type SavedMovement = z.infer<typeof movementSchema>;

const itemResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    item: inventoryItemSchema,
  }),
});

const movementResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    movement: movementSchema,
  }),
});

const linkSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  inventoryItemId: z.string(),
  productId: z.string(),
  productName: z.string(),
  baseUnit: baseUnitSchema,
  quantityPerProduct: signed,
  autoDeduct: z.boolean(),
  isActive: z.boolean(),
});

export type InventoryLink = z.infer<typeof linkSchema>;

function options(session: AuthSession, signal: AbortSignal) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para administrar inventario."
    );
  }

  return {
    accessToken: session.accessToken,
    signal,
  };
}

function checked<T extends { businessId: string }>(
  value: T,
  session: AuthSession
): T {
  if (value.businessId !== session.business.id) {
    throw new ApiError(
      502,
      "BUSINESS_MISMATCH",
      "No pudimos verificar el negocio de la respuesta."
    );
  }

  return value;
}

export async function readItem(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-items/" + encodeURIComponent(id),
    itemResponse,
    options(session, signal)
  );

  const item = checked(response.data.item, session);

  if (item.id !== id) {
    throw new Error(
      "El artículo recibido no coincide con el solicitado."
    );
  }

  return item;
}

export async function readItems(
  session: AuthSession,
  signal: AbortSignal
) {
  options(session, signal);

  const items = await getInventoryItems(session.accessToken, signal);

  return items.map((item) => checked(item, session));
}

export async function readLinks(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/product-inventory-links",
    z.object({
      status: z.literal("success"),
      data: z.object({
        links: z.array(linkSchema),
      }),
    }),
    options(session, signal)
  );

  return response.data.links
    .map((link) => checked(link, session))
    .filter((link) => link.inventoryItemId === id);
}

export async function saveItem(
  id: string,
  body: ItemEdit,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-items/" + encodeURIComponent(id),
    itemResponse,
    {
      ...options(session, signal),
      method: "PATCH",
      body,
    }
  );

  return checked(response.data.item, session);
}

export async function saveStatus(
  id: string,
  isActive: boolean,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-items/" + encodeURIComponent(id) + "/status",
    itemResponse,
    {
      ...options(session, signal),
      method: "PATCH",
      body: { isActive },
    }
  );

  return checked(response.data.item, session);
}

export async function saveMovement(
  body: MovementInput,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-movements",
    movementResponse,
    {
      ...options(session, signal),
      method: "POST",
      body,
    }
  );

  return checked(response.data.movement, session);
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return [
      error.message,
      ...error.errors.map((entry) => entry.message),
    ].join(" ");
  }

  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";
}

export function uncertain(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 0 || error.status >= 500)
  );
}
