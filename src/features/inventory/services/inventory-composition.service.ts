import { z } from "zod";

import { ApiError, request } from "../../../lib/http/client";
import { invalidateInventory } from "../../../lib/inventory-invalidation";

import { hasPermission } from "../../auth/utils/permissions";
import type { AuthSession } from "../../auth/types/auth.types";

import {
  compositionProductId,
  compositionSchema,
} from "../schemas/inventory-composition.schema";

import type { CompositionInput } from "../schemas/inventory-composition.schema";

import { linkSchema } from "./inventory-workspace";

export async function saveComposition(
  productId: string,
  draft: CompositionInput,
  session: AuthSession,
  signal: AbortSignal
) {
  if (!hasPermission(session, "inventory.links.manage")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para configurar el consumo."
    );
  }

  const id = compositionProductId.parse(productId);

  // El esquema conserva únicamente los campos del contrato.
  const body = compositionSchema.parse(draft);

  const response = await request(
    "/product-inventory-links/product/" +
      encodeURIComponent(id) +
      "/composition",
    z.object({
      status: z.literal("success"),
      data: z.object({
        productId: compositionProductId,
        links: z.array(linkSchema),
      }),
    }),
    {
      accessToken: session.accessToken,
      signal,
      method: "PUT",
      body,
    }
  );

  const data = response.data;

  const ids = new Set(data.links.map((link) => link.inventoryItemId));

  if (
    data.productId !== id ||
    data.links.length !== body.items.length ||
    ids.size !== data.links.length ||
    data.links.some(
      (link) =>
        link.businessId !== session.business.id ||
        link.productId !== id ||
        !link.isActive ||
        !body.items.some(
          (item) => item.inventoryItemId === link.inventoryItemId
        )
    )
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "No pudimos verificar la composición guardada."
    );
  }

  // Se refrescan las consultas. La respuesta de este producto
  // no reemplaza el listado completo del negocio.
  invalidateInventory(session.business.id);

  return data.links;
}
