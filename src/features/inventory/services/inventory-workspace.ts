import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { productListSchema } from "../../products/schemas/product.schema";
import {
  baseUnitSchema,
  inventoryItemSchema,
  itemTypeSchema,
} from "../schemas/inventory.schema";
import {
  decimal,
  editSchema,
  movementSchema,
  units,
} from "./inventory-operations";

export const newItemSchema = editSchema.extend({
  openingQuantity: editSchema.shape.minimumStock,
});

export const consumptionInputSchema = z.object({
  productId: z
    .string()
    .regex(/^[1-9]\d*$/, "Selecciona un producto."),

  inventoryItemId: z
    .string()
    .regex(/^[1-9]\d*$/, "Selecciona un artículo."),

  quantityPerProduct: z
    .string()
    .refine((value) => {
      const quantity = units(value);

      return quantity !== null && quantity > 0n;
    }, "La cantidad debe ser mayor que cero y tener máximo tres decimales.")
    .transform((value) => decimal(units(value)!)),

  autoDeduct: z.boolean(),
});

const linkSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  productId: z.string(),
  productName: z.string(),
  inventoryItemId: z.string(),
  inventoryItemName: z.string(),
  inventoryItemType: itemTypeSchema,
  baseUnit: baseUnitSchema,
  quantityPerProduct: z.string().regex(/^\d+(?:\.\d{1,3})?$/),
  autoDeduct: z.boolean(),
  isActive: z.boolean(),
});

const metadata = z.object({
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  createdByMembershipId: z.string(),
});

const summarySchema = movementSchema.omit({ lines: true }).extend({
  ...metadata.shape,
  lineCount: z.number().int().nonnegative(),
});

const detailSchema = movementSchema.extend(metadata.shape);

export type ConsumptionLink = z.infer<typeof linkSchema>;
export type MovementDetail = z.infer<typeof detailSchema>;

export type MovementRow = z.infer<typeof summarySchema> & {
  lines?: MovementDetail["lines"];
};

function options(session: AuthSession, signal: AbortSignal) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso al inventario."
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
      "La respuesta no corresponde al negocio."
    );
  }

  return value;
}

export async function createItem(
  draft: z.input<typeof newItemSchema>,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-items",
    z.object({
      status: z.literal("success"),
      data: z.object({
        item: inventoryItemSchema,
      }),
    }),
    {
      ...options(session, signal),
      method: "POST",
      body: newItemSchema.parse(draft),
    }
  );

  return checked(response.data.item, session);
}

export async function loadMovements(
  session: AuthSession,
  signal: AbortSignal
): Promise<MovementRow[]> {
  const response = await request(
    "/inventory-movements",
    z.object({
      status: z.literal("success"),
      data: z.object({
        movements: z.array(summarySchema),
      }),
    }),
    options(session, signal)
  );

  return response.data.movements.map((row) => checked(row, session));
}

export async function loadMovement(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/inventory-movements/" + encodeURIComponent(id),
    z.object({
      status: z.literal("success"),
      data: z.object({
        movement: detailSchema,
      }),
    }),
    options(session, signal)
  );

  const movement = checked(response.data.movement, session);

  if (movement.id !== id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Movimiento inesperado."
    );
  }

  return movement;
}

// La API actual no filtra por artículo ni incluye líneas en el listado.
// Consultamos los detalles solo al buscar texto o filtrar por artículo.
// Máximo cuatro consultas simultáneas.
// Si alguna falla, no mostramos resultados parciales como completos.
export async function loadMovementIndex(
  session: AuthSession,
  signal: AbortSignal
): Promise<MovementRow[]> {
  const rows = await loadMovements(session, signal);

  let next = 0;

  const result: MovementRow[] = new Array(rows.length);
  const controller = new AbortController();

  const combined = AbortSignal.any([signal, controller.signal]);

  async function worker() {
    while (next < rows.length) {
      combined.throwIfAborted();

      const index = next++;

      const detail = await loadMovement(
        rows[index].id,
        session,
        combined
      );

      result[index] = {
        ...detail,
        lineCount: detail.lines.length,
      };
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(4, rows.length) }, worker)
    );

    return result;
  } catch (error) {
    controller.abort();
    throw error;
  }
}

export async function loadLinks(
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

  return response.data.links.map((link) => checked(link, session));
}

export async function loadProducts(
  session: AuthSession,
  signal: AbortSignal
) {
  const first = await request(
    "/products",
    productListSchema,
    options(session, signal)
  );

  const products = [...first.data.products];
  const pagination = first.data.pagination;

  if (pagination) {
    for (
      let page = pagination.page + 1;
      page <= pagination.totalPages;
      page++
    ) {
      const response = await request(
        "/products?page=" + page + "&pageSize=" + pagination.pageSize,
        productListSchema,
        options(session, signal)
      );

      products.push(...response.data.products);
    }
  }

  return [
    ...new Map(
      products.map((product) => [
        product.id,
        checked(product, session),
      ])
    ).values(),
  ];
}

export async function saveLink(
  id: string | null,
  draft: z.input<typeof consumptionInputSchema>,
  session: AuthSession,
  signal: AbortSignal
) {
  const input = consumptionInputSchema.parse(draft);

  const response = await request(
    "/product-inventory-links" +
      (id ? "/" + encodeURIComponent(id) : ""),
    z.object({
      status: z.literal("success"),
      data: z.object({
        link: linkSchema,
      }),
    }),
    {
      ...options(session, signal),
      method: id ? "PATCH" : "POST",
      body: id
        ? {
            quantityPerProduct: input.quantityPerProduct,
            autoDeduct: input.autoDeduct,
          }
        : input,
    }
  );

  return checked(response.data.link, session);
}

export async function setLinkStatus(
  id: string,
  isActive: boolean,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/product-inventory-links/" + encodeURIComponent(id) + "/status",
    z.object({
      status: z.literal("success"),
      data: z.object({
        link: linkSchema,
      }),
    }),
    {
      ...options(session, signal),
      method: "PATCH",
      body: { isActive },
    }
  );

  return checked(response.data.link, session);
}

export function movementReference(row: MovementRow | MovementDetail) {
  if (!row.sourceId) {
    return "Movimiento #" + row.id;
  }

  const labels: Record<string, string> = {
    ORDER: "Orden",
    ORDER_ITEM: "Ítem de pedido",
    INVENTORY_ITEM: "Artículo",
    PRODUCTION: "Producción",
  };

  return (
    (labels[row.sourceType ?? ""] ?? row.sourceType ?? "Referencia") +
    " #" +
    row.sourceId
  );
}
