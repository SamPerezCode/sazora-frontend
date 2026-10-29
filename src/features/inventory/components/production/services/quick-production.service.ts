import { z } from "zod";

import { ApiError } from "../../../../../lib/http/client";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { id } from "../../../schemas/inventory-location.schema";

import { api } from "./production.api";
import { plantScope } from "../utils/production.access";

import {
  productionMovementSummary,
  quickProductionSchema,
} from "../schemas/quick-production.schemas";

import type {
  QuickProduction,
  QuickProductionSummary,
} from "../schemas/quick-production.schemas";

function checkScope<
  T extends QuickProductionSummary | QuickProduction,
>(
  session: AuthSession,
  row: T,
  locationId: string,
  expectedId?: string
): T {
  if (
    row.businessId !== session.business.id ||
    (expectedId && row.id !== expectedId) ||
    (locationId && row.location?.id !== locationId)
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La producción recibida no corresponde a la consulta."
    );
  }

  if (row.location) {
    plantScope(session, row.location.id);
  }

  return row;
}

export async function listQuickProductions(
  session: AuthSession,
  signal: AbortSignal,
  requestedLocation: string
) {
  const locationId = plantScope(session, requestedLocation);
  const params = new URLSearchParams();

  if (locationId) {
    params.set("locationId", id.parse(locationId));
  }

  const { production } = await api(
    session,
    signal,
    "/production" + (params.size ? "?" + params : ""),
    z.object({
      production: z.array(productionMovementSummary),
    })
  );

  const rows = production.map((row) =>
    checkScope(session, row, locationId)
  );

  return rows
    .filter((row) => row.sourceType === "PRODUCTION_BATCH")
    .sort((a, b) => {
      const byDate =
        Date.parse(b.createdAt) - Date.parse(a.createdAt);

      if (byDate) return byDate;

      return BigInt(a.id) > BigInt(b.id) ? -1 : a.id === b.id ? 0 : 1;
    });
}

export async function getQuickProduction(
  session: AuthSession,
  signal: AbortSignal,
  productionId: string,
  requestedLocation: string
) {
  const locationId = plantScope(session, requestedLocation);

  const { production } = await api(
    session,
    signal,
    "/production/" + id.parse(productionId),
    z.object({
      production: quickProductionSchema,
    })
  );

  return checkScope(session, production, locationId, productionId);
}

export async function getQuickProductionPage(
  session: AuthSession,
  signal: AbortSignal,
  ids: string[],
  locationId: string
) {
  const rows: QuickProduction[] = [];

  for (let offset = 0; offset < ids.length; offset += 4) {
    signal.throwIfAborted();

    rows.push(
      ...(await Promise.all(
        ids
          .slice(offset, offset + 4)
          .map((productionId) =>
            getQuickProduction(
              session,
              signal,
              productionId,
              locationId
            )
          )
      ))
    );
  }

  return rows;
}
