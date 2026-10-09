import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { productDetailSchema } from "../../products/schemas/product.schema";
import { getProductDetail } from "../../products/services/product.service";
import {
  inventoryItemSchema,
  baseUnitSchema,
} from "../schemas/inventory.schema";
import { linkSchema, loadLinks } from "./inventory-workspace";

const quantity = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/,
        "Usa una cantidad desde cero, con máximo tres decimales."
      )
  );

export const inventorySetupSchema = z.object({
  trackingType: z.enum(["RESALE", "PRODUCTION"]),

  sku: z
    .string()
    .trim()
    .max(50, "SKU: máximo 50 caracteres.")
    .transform((value) => value || null),

  baseUnit: baseUnitSchema,

  openingQuantity: quantity,

  minimumStock: quantity,

  quantityPerProduct: quantity.refine(
    (value) => Number(value) > 0,
    "La cantidad descontada por venta debe ser mayor que cero."
  ),
});

export type InventorySetupDraft = z.input<
  typeof inventorySetupSchema
>;

const responseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    setup: z.object({
      trackingType: z.enum(["RESALE", "PRODUCTION"]),
      product: productDetailSchema,
      inventoryItem: inventoryItemSchema,
      link: linkSchema,
    }),
  }),
});

function authorize(session: AuthSession) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso al inventario."
    );
  }
}

export async function loadInventorySetup(
  productId: string,
  session: AuthSession,
  signal: AbortSignal
) {
  authorize(session);

  const [product, links] = await Promise.all([
    getProductDetail(productId, false, session.accessToken, signal),
    loadLinks(session, signal),
  ]);

  if (
    product.id !== productId ||
    product.businessId !== session.business.id
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Producto inesperado."
    );
  }

  return {
    product,

    // El backend también considera las relaciones inactivas.
    configured: links.some((link) => link.productId === productId),
  };
}

export async function configureInventory(
  productId: string,
  draft: InventorySetupDraft,
  session: AuthSession,
  signal: AbortSignal
) {
  authorize(session);

  const input = inventorySetupSchema.parse(draft);

  const response = await request(
    "/products/" + encodeURIComponent(productId) + "/inventory-setup",
    responseSchema,
    {
      accessToken: session.accessToken,
      signal,
      method: "POST",
      body: input,
    }
  );

  const setup = response.data.setup;

  if (
    [setup.product, setup.inventoryItem, setup.link].some(
      (value) => value.businessId !== session.business.id
    ) ||
    setup.product.id !== productId ||
    setup.link.productId !== productId ||
    setup.link.inventoryItemId !== setup.inventoryItem.id ||
    setup.trackingType !== input.trackingType
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Configuración inesperada."
    );
  }

  return setup;
}
