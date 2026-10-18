import { z } from "zod";
import type { AuthSession } from "../../auth/types/auth.types";
import { inventoryRequest } from "./inventory-location.service";
import { id } from "../schemas/inventory-location.schema";
import {
  movementSummary,
  movementDetail,
  kardexReport,
  reconciliationReport,
  productionInput,
} from "../schemas/inventory-audit.schema";
import type { ProductionInput } from "../schemas/inventory-audit.schema";

export async function loadActivity(
  session: AuthSession,
  signal: AbortSignal,
  production: boolean
) {
  const rows = production
    ? (
        await inventoryRequest(
          session,
          "/production",
          z.object({ production: z.array(movementSummary) }),
          signal
        )
      ).production
    : (
        await inventoryRequest(
          session,
          "/inventory-movements",
          z.object({ movements: z.array(movementSummary) }),
          signal
        )
      ).movements;

  if (rows.some((row) => row.businessId !== session.business.id)) {
    throw new Error(
      "No pudimos verificar el negocio de los registros."
    );
  }

  return rows;
}

export async function loadMovement(
  session: AuthSession,
  signal: AbortSignal,
  movementId: string,
  production = false
) {
  const path =
    (production ? "/production/" : "/inventory-movements/") +
    id.parse(movementId);

  const result = production
    ? (
        await inventoryRequest(
          session,
          path,
          z.object({ production: movementDetail }),
          signal
        )
      ).production
    : (
        await inventoryRequest(
          session,
          path,
          z.object({ movement: movementDetail }),
          signal
        )
      ).movement;

  if (
    result.businessId !== session.business.id ||
    result.id !== movementId
  ) {
    throw new Error("No pudimos verificar el registro.");
  }

  return result;
}

export async function createProduction(
  session: AuthSession,
  signal: AbortSignal,
  body: ProductionInput
) {
  const result = await inventoryRequest(
    session,
    "/production",
    z.object({ production: movementDetail }),
    signal,
    "POST",
    productionInput.parse(body)
  );

  if (result.production.businessId !== session.business.id) {
    throw new Error(
      "No pudimos verificar el negocio de la producción."
    );
  }

  return result.production;
}

export interface KardexFilters {
  from: string;
  to: string;
  locationId: string;
  inventoryItemId: string;
  movementType: string;
  page: number;
  pageSize: number;
}

export function loadKardex(
  session: AuthSession,
  signal: AbortSignal,
  filters: KardexFilters
) {
  if (
    !z.iso.date().safeParse(filters.from).success ||
    !z.iso.date().safeParse(filters.to).success
  ) {
    throw new Error("Selecciona ambas fechas.");
  }

  const days =
    (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000;

  if (days < 0 || days > 366) {
    throw new Error(
      "El período debe ser válido y no superar 366 días."
    );
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== "") {
      params.set(key, String(value));
    }
  }

  return inventoryRequest(
    session,
    "/inventory-reports/kardex?" + params,
    kardexReport,
    signal
  );
}

export const loadReconciliation = (
  session: AuthSession,
  signal: AbortSignal
) =>
  inventoryRequest(
    session,
    "/inventory-reports/reconciliation",
    reconciliationReport,
    signal
  );
