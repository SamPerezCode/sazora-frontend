import { z } from "zod";

import { request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import { getLocations } from "../../business/services/organization.service";

import {
  saleId,
  saleDetailSchema,
  salesResponse,
  type SalesFilters,
} from "../schemas/financial-sales.schema";

function options(session: AuthSession, signal: AbortSignal) {
  return {
    accessToken: session.accessToken,
    signal,
    cache: "no-store" as const,
  };
}

function verify<T extends { businessId: string; locationId: string }>(
  row: T,
  session: AuthSession
): T {
  const access = session.authorization.locationAccess;

  if (
    row.businessId !== session.business.id ||
    (!access.hasGlobalAccess &&
      !access.locations.some(
        (location) => location.id === row.locationId
      ))
  ) {
    throw new Error("La venta no corresponde al acceso actual.");
  }

  return row;
}

export async function financialLocations(
  session: AuthSession,
  signal: AbortSignal
) {
  const access = session.authorization.locationAccess;

  const rows = hasPermission(session, "locations.read")
    ? await getLocations(session, signal, { activeOnly: false })
    : access.locations;

  return rows
    .filter(
      (row) => access.hasGlobalAccess || row.isSalesLocation === true
    )
    .map(({ id, name }) => ({
      value: id,
      label: name,
    }));
}

export async function listFinancialSales(
  session: AuthSession,
  filters: SalesFilters,
  page: number,
  signal: AbortSignal,
  pageSize = 20
) {
  const access = session.authorization.locationAccess;

  if (!access.hasGlobalAccess && !filters.locationId) {
    throw new Error(
      "Selecciona una ubicación habilitada para ventas."
    );
  }

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(z.number().int().positive().parse(pageSize)),
  });

  if (filters.locationId) {
    query.set("locationId", saleId.parse(filters.locationId));
  }

  if (filters.cashSessionId) {
    query.set("cashSessionId", saleId.parse(filters.cashSessionId));
  }

  if (filters.status) {
    query.set("status", filters.status);
  }

  if (filters.from) {
    query.set("from", z.iso.datetime().parse(filters.from));
  }

  if (filters.to) {
    query.set("to", z.iso.datetime().parse(filters.to));
  }

  const response = await request(
    "/sales?" + query,
    salesResponse,
    options(session, signal)
  );

  response.data.sales.forEach((row) => {
    verify(row, session);

    if (filters.locationId && row.locationId !== filters.locationId) {
      throw new Error(
        "La respuesta contiene ventas de otra ubicación."
      );
    }
  });

  return response.data;
}

export async function getFinancialSale(
  session: AuthSession,
  id: string,
  signal: AbortSignal
) {
  const response = await request(
    "/sales/" + saleId.parse(id),
    z.object({
      status: z.literal("success"),
      data: z.object({
        sale: saleDetailSchema,
      }),
    }),
    options(session, signal)
  );

  const row = verify(response.data.sale, session);

  if (row.id !== id) {
    throw new Error("La respuesta corresponde a otra venta.");
  }

  return row;
}

export async function getFinancialSaleOverview(
  session: AuthSession,
  id: string,
  signal: AbortSignal
) {
  const sale = await getFinancialSale(session, id, signal);

  // El listado aporta los totales vigentes y el nombre de quien anuló.
  const timestamp = new Date(sale.soldAt).toISOString();

  let page = 1;
  let totalPages: number;

  do {
    signal.throwIfAborted();

    const result = await listFinancialSales(
      session,
      {
        locationId: sale.locationId,
        cashSessionId: sale.cashSessionId,
        status: "",
        from: timestamp,
        to: timestamp,
      },
      page,
      signal
    );

    const summary = result.sales.find((row) => row.id === id);

    if (summary) {
      if (
        summary.status !== sale.status ||
        summary.total !== sale.total
      ) {
        throw new Error(
          "La venta cambió durante la consulta. Vuelve a consultar."
        );
      }

      return { ...sale, summary };
    }

    totalPages = result.pagination.totalPages;
    page++;
  } while (page <= totalPages);

  throw new Error(
    "No fue posible consultar los totales vigentes de la venta."
  );
}
