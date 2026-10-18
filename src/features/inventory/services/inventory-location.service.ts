import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { getLocations } from "../../business/services/organization.service";
import { readItems, readItem } from "./inventory-operations";
import { inventoryItemSchema } from "../schemas/inventory.schema";
import {
  balancesSchema,
  presentationSchema,
  summarySchema,
  purchaseSchema,
  purchaseReportSchema,
  itemInputSchema,
  editInputSchema,
  positive,
  id,
  balanceSchema,
  purchaseInputSchema,
  manualInputSchema,
} from "../schemas/inventory-location.schema";
import type { PurchaseRow } from "../schemas/inventory-location.schema";

export async function inventoryRequest<T>(
  session: AuthSession,
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  method: "GET" | "POST" | "PATCH" | "PUT" = "GET",
  body?: unknown
): Promise<T> {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para gestionar inventario."
    );
  }

  const result = await request(
    path,
    z.object({
      status: z.literal("success"),
      data: schema,
    }),
    {
      accessToken: session.accessToken,
      signal,
      method,
      body,
      cache: "no-store",
    }
  );

  return result.data;
}

export async function loadInventoryWorkspace(
  session: AuthSession,
  signal: AbortSignal
) {
  const [items, locations, result] = await Promise.all([
    readItems(session, signal),
    getLocations(session, signal),
    inventoryRequest(
      session,
      "/inventory-items/location-balances",
      balancesSchema,
      signal
    ),
  ]);

  return {
    items,
    locations: locations.filter(
      (location) => location.isActive && location.isInventoryLocation
    ),
    balances: result.balances,
  };
}

export type InventoryWorkspace = Awaited<
  ReturnType<typeof loadInventoryWorkspace>
>;

export const loadBalances = async (
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) =>
  (
    await inventoryRequest(
      session,
      "/inventory-items/location-balances?locationId=" +
        id.parse(locationId),
      balancesSchema,
      signal
    )
  ).balances;

export const loadSummary = (
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) =>
  inventoryRequest(
    session,
    "/inventory-reports/summary" +
      (locationId ? "?locationId=" + id.parse(locationId) : ""),
    summarySchema,
    signal
  );

export const loadUnvalued = (
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) =>
  inventoryRequest(
    session,
    "/inventory-reports/unvalued" +
      (locationId ? "?locationId=" + id.parse(locationId) : ""),
    z.object({
      itemCount: z.number(),
      items: z.array(
        z.object({
          inventoryItemId: id,
          location: z.object({ id }),
          migratedFromLegacy: z.boolean(),
        })
      ),
    }),
    signal
  );

export async function loadPresentations(
  session: AuthSession,
  signal: AbortSignal,
  itemId: string
) {
  const data = await inventoryRequest(
    session,
    "/inventory-items/" +
      id.parse(itemId) +
      "/purchase-presentations",
    z.object({
      presentations: z.array(presentationSchema),
    }),
    signal
  );

  return data.presentations;
}

export async function loadItemDetail(
  session: AuthSession,
  signal: AbortSignal,
  itemId: string
) {
  const [item, presentations, result] = await Promise.all([
    readItem(itemId, session, signal),
    loadPresentations(session, signal, itemId),
    inventoryRequest(
      session,
      "/inventory-items/location-balances",
      balancesSchema,
      signal
    ),
  ]);

  return {
    item,
    presentations,
    balances: result.balances.filter(
      (balance) => balance.inventoryItemId === itemId
    ),
  };
}

export type ItemWrite =
  | {
      kind: "create";
      body: z.infer<typeof itemInputSchema>;
    }
  | {
      kind: "edit";
      itemId: string;
      body: z.infer<typeof editInputSchema>;
    }
  | {
      kind: "status";
      itemId: string;
      isActive: boolean;
    }
  | {
      kind: "presentation";
      itemId: string;
      name: string;
      conversionFactor: string;
    }
  | {
      kind: "valuation";
      itemId: string;
      locationId: string;
      unitCost: string;
      reason: string;
    };

export async function writeItem(
  session: AuthSession,
  signal: AbortSignal,
  action: ItemWrite
) {
  if (action.kind === "create") {
    return inventoryRequest(
      session,
      "/inventory-items",
      z.object({ item: inventoryItemSchema }),
      signal,
      "POST",
      itemInputSchema.parse(action.body)
    );
  }

  const path = "/inventory-items/" + id.parse(action.itemId);

  if (action.kind === "edit") {
    return inventoryRequest(
      session,
      path,
      z.object({ item: inventoryItemSchema }),
      signal,
      "PATCH",
      editInputSchema.parse(action.body)
    );
  }

  if (action.kind === "status") {
    return inventoryRequest(
      session,
      path + "/status",
      z.object({ item: inventoryItemSchema }),
      signal,
      "PATCH",
      { isActive: action.isActive }
    );
  }

  if (action.kind === "presentation") {
    return inventoryRequest(
      session,
      path + "/purchase-presentations",
      z.object({ presentation: presentationSchema }),
      signal,
      "POST",
      {
        name: z.string().trim().min(1).max(120).parse(action.name),
        conversionFactor: positive.parse(action.conversionFactor),
      }
    );
  }

  return inventoryRequest(
    session,
    path + "/locations/" + id.parse(action.locationId) + "/valuation",
    z.object({ balance: balanceSchema }),
    signal,
    "PUT",
    {
      unitCost: positive.parse(action.unitCost),
      reason: z.string().trim().min(3).max(500).parse(action.reason),
    }
  );
}

export async function loadPurchase(
  session: AuthSession,
  signal: AbortSignal,
  movementId: string
) {
  const { purchase } = await inventoryRequest(
    session,
    "/inventory-movements/purchases/" + id.parse(movementId),
    z.object({ purchase: purchaseSchema }),
    signal
  );

  if (
    purchase.businessId !== session.business.id ||
    purchase.id !== movementId
  ) {
    throw new Error("No pudimos verificar la compra recibida.");
  }

  return purchase;
}

export interface PurchaseFilters {
  from: string;
  to: string;
  locationId: string;
  inventoryItemId: string;
}

export async function loadPurchaseRows(
  session: AuthSession,
  signal: AbortSignal,
  filters: PurchaseFilters
) {
  z.iso.date().parse(filters.from);
  z.iso.date().parse(filters.to);

  const days =
    (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000;

  if (days < 0 || days > 366) {
    throw new Error("Selecciona un rango válido de hasta 366 días.");
  }

  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    pageSize: "100",
  });

  if (filters.locationId) {
    query.set("locationId", id.parse(filters.locationId));
  }

  if (filters.inventoryItemId) {
    query.set("inventoryItemId", id.parse(filters.inventoryItemId));
  }

  const rows = new Map<string, PurchaseRow>();
  let expected = -1;

  // El reporte pagina líneas, no documentos completos.
  for (let page = 1; ; page++) {
    signal.throwIfAborted();
    query.set("page", String(page));

    const data = await inventoryRequest(
      session,
      "/inventory-reports/purchases?" + query,
      purchaseReportSchema,
      signal
    );

    if (expected !== -1 && expected !== data.pagination.total) {
      throw new Error(
        "Las compras cambiaron durante la consulta. Actualiza el historial."
      );
    }

    expected = data.pagination.total;

    for (const row of data.purchases) {
      rows.set(row.movementLineId, row);
    }

    if (page >= data.pagination.totalPages) break;
  }

  if (rows.size !== expected) {
    throw new Error(
      "La consulta cambió. Actualiza para obtener compras completas."
    );
  }

  return [...rows.values()];
}

export async function registerPurchase(
  session: AuthSession,
  signal: AbortSignal,
  input: z.infer<typeof purchaseInputSchema>
) {
  const { purchase } = await inventoryRequest(
    session,
    "/inventory-movements/purchases",
    z.object({ purchase: purchaseSchema }),
    signal,
    "POST",
    purchaseInputSchema.parse(input)
  );

  if (purchase.businessId !== session.business.id) {
    throw new Error("No pudimos verificar el negocio de la compra.");
  }

  return purchase;
}

export const registerManual = (
  session: AuthSession,
  signal: AbortSignal,
  input: z.infer<typeof manualInputSchema>
) =>
  inventoryRequest(
    session,
    "/inventory-movements",
    z.object({
      movement: z.object({ id, businessId: id }),
    }),
    signal,
    "POST",
    manualInputSchema.parse(input)
  );
