import { z } from "zod";

import { ApiError, request } from "../../../lib/http/client";
import { invalidateOperations } from "../../../lib/operations-sync";

import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";

import { saleId } from "../../sales/schemas/financial-sales.schema";

import { reportQuery } from "../../reports/services/reports.service";

import {
  customerSchema,
  customerListSchema,
  customerOrdersSchema,
  customerSalesSchema,
  type CustomerFilter,
  type CustomerChange,
} from "../schemas/customers.schema";

const root = "/commercial-customers";

export const customerKey = (id: string) => "customers:" + id;

function requirePermission(session: AuthSession, permission: string) {
  if (!hasPermission(session, permission)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para esta operación."
    );
  }
}

function verify<T extends { businessId: string }>(
  session: AuthSession,
  row: T
) {
  if (row.businessId !== session.business.id) {
    throw new ApiError(
      502,
      "SCOPE_MISMATCH",
      "La respuesta pertenece a otro negocio."
    );
  }

  return row;
}

async function read<T>(
  session: AuthSession,
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal
) {
  requirePermission(session, "customers.read");

  const response = await request(
    path,
    z.object({
      status: z.literal("success"),
      data: schema,
    }),
    {
      accessToken: session.accessToken,
      signal,
      cache: "no-store",
    }
  );

  return response.data;
}

async function pageResult<
  T extends { pagination: { totalPages: number } },
>(page: number, load: (page: number) => Promise<T>) {
  const result = await load(page);
  const last = Math.max(1, result.pagination.totalPages);

  return page > last ? load(last) : result;
}

export async function listCustomers(
  session: AuthSession,
  filters: CustomerFilter,
  signal: AbortSignal
) {
  const query = z
    .object({
      search: z.string().trim().max(100),
      isActive: z.enum(["", "true", "false"]),

      acquisitionSourceChannel: z
        .enum(["", "IN_PERSON", "WHATSAPP", "PHONE", "PUBLIC_MENU"])
        .default(""),

      page: z.number().int().positive(),
      pageSize: z.number().int().min(1).max(100),
    })
    .parse(filters);

  const data = await pageResult(query.page, (page) =>
    read(
      session,
      root + reportQuery({ ...query, page }),
      customerListSchema,
      signal
    )
  );

  data.customers.forEach((row) => verify(session, row));

  return data;
}

export async function getCustomer(
  session: AuthSession,
  id: string,
  signal: AbortSignal
) {
  const data = await read(
    session,
    root + "/" + saleId.parse(id),
    z.object({ customer: customerSchema }),
    signal
  );

  const row = verify(session, data.customer);

  if (row.id !== id) {
    throw new Error("La respuesta corresponde a otro cliente.");
  }

  return row;
}

export function refreshCustomer(session: AuthSession, id: string) {
  invalidateOperations(session.accessToken, [
    "customers",
    customerKey(id),
  ]);
}

export async function changeCustomer(
  session: AuthSession,
  id: string,
  change: CustomerChange,
  signal: AbortSignal
) {
  requirePermission(session, "customers.read");
  requirePermission(session, "customers.manage");

  const response = await request(
    root + "/" + saleId.parse(id) + "/" + change.kind,
    z.object({
      status: z.literal("success"),
      data: z.object({ customer: customerSchema }),
    }),
    {
      accessToken: session.accessToken,
      signal,
      method: "PATCH",
      body:
        change.kind === "status"
          ? { isActive: change.value }
          : { marketingConsent: change.value },
    }
  );

  const row = verify(session, response.data.customer);

  if (row.id !== id) {
    throw new Error("La respuesta corresponde a otro cliente.");
  }

  refreshCustomer(session, id);

  return row;
}

export async function getCustomerOrders(
  session: AuthSession,
  id: string,
  page: number,
  signal: AbortSignal
) {
  const data = await pageResult(page, (value) =>
    read(
      session,
      root +
        "/" +
        saleId.parse(id) +
        "/orders" +
        reportQuery({ page: value, pageSize: 20 }),
      customerOrdersSchema,
      signal
    )
  );

  data.orders.forEach((row) => {
    verify(session, row);

    if (
      row.commercialCustomerId !== id ||
      row.location.id !== row.locationId
    ) {
      throw new Error(
        "El pedido no corresponde al cliente o ubicación."
      );
    }
  });

  return data;
}

export async function getCustomerSales(
  session: AuthSession,
  id: string,
  page: number,
  signal: AbortSignal
) {
  const data = await pageResult(page, (value) =>
    read(
      session,
      root +
        "/" +
        saleId.parse(id) +
        "/sales" +
        reportQuery({ page: value, pageSize: 20 }),
      customerSalesSchema,
      signal
    )
  );

  data.sales.forEach((row) => {
    verify(session, row);

    if (
      row.commercialCustomerId !== id ||
      row.location.id !== row.locationId
    ) {
      throw new Error(
        "La venta no corresponde al cliente o ubicación."
      );
    }
  });

  return data;
}
