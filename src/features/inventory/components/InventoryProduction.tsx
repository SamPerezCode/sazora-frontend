import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import {
  BookOpen,
  Boxes,
  CalendarCheck,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Factory,
  FilterX,
  FlaskConical,
  History,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Pagination } from "../../../components/ui/Pagination";
import { DateField } from "../../../components/forms/DateField";
import { calendarToday } from "../../../components/forms/calendar-date";
import { useInventoryRealtime } from "../../../hooks/useInventoryRealtime";
import { ApiError, request } from "../../../lib/http/client";

import type {
  AuthSession,
  RoleCode,
} from "../../auth/types/auth.types";
import type { BusinessLocation } from "../../business/schemas/organization.schema";
import { getLocations } from "../../business/services/organization.service";

import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadBalances } from "../services/inventory-location.service";
import { movementDetail } from "../schemas/inventory-audit.schema";
import { id, numeric } from "../schemas/inventory-location.schema";
import { baseUnitSchema } from "../schemas/inventory.schema";
import {
  dayKey,
  formatQuantity,
  searchKey,
} from "../utils/inventory-format";
import {
  add,
  cost as formatCost,
  divide,
  fixed,
  money,
  multiply,
  quantity,
  quantity3,
  subtract,
  unit,
} from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Choice, Field, Modal, Notice } from "./InventoryLocationUI";
import { InventoryResponsiveRecords as Records } from "./InventoryResponsiveRecords";

const productionRoles: readonly RoleCode[] = ["ADMIN", "PRODUCTION"];

const statusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const named = z.object({
  id,
  code: z.string(),
  name: z.string(),
});

const date = z.iso.datetime({ offset: true });

const orderLineSchema = z.object({
  id,
  inventoryItemId: id,
  inventoryItemName: z.string(),
  inventoryItemSku: z.string().nullable(),
  baseUnit: baseUnitSchema,
  plannedQuantity: numeric,
  actualQuantity: numeric.nullable(),
});

const orderSchema = z.object({
  id,
  businessId: id,
  recipe: named,
  location: named,
  status: statusSchema,
  batchQuantity: numeric,
  plannedFor: date.nullable(),
  notes: z.string().nullable(),
  inventoryMovementId: id.nullable(),
  version: z.number().int().positive(),

  createdByMembershipId: id,
  createdByName: z.string(),
  updatedByMembershipId: id,
  updatedByName: z.string(),

  startedByMembershipId: id.nullable(),
  startedByName: z.string().nullable(),
  completedByMembershipId: id.nullable(),
  completedByName: z.string().nullable(),
  cancelledByMembershipId: id.nullable(),
  cancelledByName: z.string().nullable(),

  createdAt: date,
  updatedAt: date,
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  cancelledAt: date.nullable(),
  cancellationReason: z.string().nullable(),

  inputs: z.array(orderLineSchema),
  outputs: z.array(
    orderLineSchema.extend({
      costAllocationPercentage: numeric,
    })
  ),
});

const orderSummarySchema = orderSchema
  .omit({ inputs: true, outputs: true })
  .extend({
    inputCount: z.number().int(),
    outputCount: z.number().int(),
  });

const recipeLineSchema = orderLineSchema
  .omit({ plannedQuantity: true, actualQuantity: true })
  .extend({
    quantity: numeric,
    notes: z.string().nullable(),
  });

const recipeSchema = named.extend({
  businessId: id,
  isActive: z.boolean(),
  notes: z.string().nullable(),
  updatedAt: date,
  inputs: z.array(recipeLineSchema),
  outputs: z.array(
    recipeLineSchema.extend({
      costAllocationPercentage: numeric,
    })
  ),
});

const recipeSummarySchema = recipeSchema.omit({
  inputs: true,
  outputs: true,
});

const performanceLineSchema = orderLineSchema
  .omit({ id: true })
  .extend({
    differenceQuantity: numeric.nullable(),
    variationPercentage: numeric.nullable(),
    actualUnitCost: numeric.nullable(),
    actualCost: numeric.nullable(),
    declaredWasteQuantity: numeric,
    declaredWasteCost: numeric,
  });

const costSummarySchema = z.object({
  expectedInputCostAtActualRate: numeric.nullable(),
  actualInputCost: numeric.nullable(),
  inputCostDifference: numeric.nullable(),
  inputCostVariationPercentage: numeric.nullable(),
  declaredWasteCost: numeric,
  totalResourceCost: numeric.nullable(),
  producedInventoryValue: numeric.nullable(),
});

const performanceSchema = z.object({
  productionOrderId: id,
  businessId: id,
  locationId: id,
  status: statusSchema,
  inventoryMovementId: id.nullable(),
  inputs: z.array(
    performanceLineSchema.extend({
      expectedCostAtActualRate: numeric.nullable(),
      costDifference: numeric.nullable(),
      costVariationPercentage: numeric.nullable(),
    })
  ),
  outputs: z.array(
    performanceLineSchema.extend({
      costAllocationPercentage: numeric,
      yieldPercentage: numeric.nullable(),
    })
  ),
  summary: costSummarySchema,
});

const wasteSchema = z.object({
  id,
  businessId: id,
  productionOrderId: id,
  inventoryMovementId: id,
  reason: z.string(),
  recordedByMembershipId: id,
  recordedByName: z.string(),
  createdAt: date,
  lines: z.array(
    recipeLineSchema.extend({
      unitCost: numeric.nullable(),
      totalCost: numeric.nullable(),
    })
  ),
});

const historySchema = z.object({
  orders: z.array(
    costSummarySchema.extend({
      productionOrderId: id,
      status: statusSchema,
      location: named,
      performanceAvailable: z.boolean(),
    })
  ),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

const reportSummarySchema = z.object({
  summary: costSummarySchema.extend({
    orderCount: z.number().int(),
    draftCount: z.number().int(),
    plannedCount: z.number().int(),
    inProgressCount: z.number().int(),
    completedCount: z.number().int(),
    cancelledCount: z.number().int(),
  }),
});

const positiveQuantity = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/,
    "Usa punto decimal y máximo 3 decimales."
  )
  .pipe(
    z
      .string()
      .refine(
        (value) => fixed(value) > 0n,
        "La cantidad debe ser mayor que cero."
      )
  );

const versionSchema = z.number().int().positive();

const quantityLineSchema = z
  .object({
    inventoryItemId: id,
    quantity: positiveQuantity,
  })
  .strict();

const editOrderSchema = z
  .object({
    version: versionSchema,
    recipeId: id,
    locationId: id,
    batchQuantity: positiveQuantity,
    plannedFor: date.nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .strict();

const completeOrderSchema = z
  .object({
    version: versionSchema,
    inputs: z.array(quantityLineSchema).min(1).max(100),
    outputs: z.array(quantityLineSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = [...value.inputs, ...value.outputs].map(
      (line) => line.inventoryItemId
    );

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "No repitas artículos en la orden.",
      });
    }
  });

const wasteInputSchema = z
  .object({
    version: versionSchema,
    reason: z
      .string()
      .trim()
      .min(3, "Explica el motivo (mínimo 3 caracteres).")
      .max(500),
    lines: z
      .array(
        quantityLineSchema.extend({
          notes: z.string().trim().max(500).nullable(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.lines.map((line) => line.inventoryItemId);

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "No repitas artículos.",
      });
    }
  });

type Order = z.infer<typeof orderSchema>;
type OrderSummary = z.infer<typeof orderSummarySchema>;
type Status = Order["status"];

type Action =
  | "detail"
  | "edit"
  | "plan"
  | "start"
  | "cancel"
  | "complete"
  | "waste"
  | "performance"
  | "movement";

type Mutation =
  | {
      action: "edit";
      payload: z.infer<typeof editOrderSchema>;
    }
  | {
      action: "complete";
      payload: z.infer<typeof completeOrderSchema>;
    }
  | {
      action: "waste";
      payload: z.infer<typeof wasteInputSchema>;
    }
  | {
      action: "plan" | "start";
      payload: { version: number };
    }
  | {
      action: "cancel";
      payload: {
        version: number;
        cancellationReason: string;
      };
    };

const statusLabels: Record<Status, string> = {
  DRAFT: "Borrador",
  PLANNED: "Planificada",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const actionLabels: Record<Action, string> = {
  detail: "Ver detalle",
  edit: "Editar",
  plan: "Planificar",
  start: "Iniciar",
  cancel: "Cancelar orden",
  complete: "Completar producción",
  waste: "Registrar desperdicio",
  performance: "Ver rendimiento",
  movement: "Ver movimiento valorizado",
};

function isAdmin(session: AuthSession) {
  return session.authorization.roles.includes("ADMIN");
}

function assignedPlant(session: AuthSession) {
  const access = session.authorization.locationAccess;

  return (
    access.locations.find(
      (location) =>
        location.id === access.defaultLocationId &&
        location.isActive !== false &&
        location.locationType === "PRODUCTION_WAREHOUSE"
    ) ?? null
  );
}

function assertProduction(session: AuthSession) {
  if (
    !productionRoles.some((role) =>
      session.authorization.roles.includes(role)
    )
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso a Producción."
    );
  }

  if (!isAdmin(session) && !assignedPlant(session)) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "No tienes una planta de producción asignada."
    );
  }
}

function plantScope(session: AuthSession, requested = "") {
  assertProduction(session);

  if (isAdmin(session)) return requested;

  const plant = assignedPlant(session)!;

  if (requested && requested !== plant.id) {
    throw new ApiError(
      403,
      "LOCATION_ACCESS_DENIED",
      "No tienes acceso a esa planta."
    );
  }

  return plant.id;
}

function usablePlant(location: BusinessLocation) {
  return (
    location.isActive &&
    location.isInventoryLocation &&
    location.isProductionLocation &&
    location.locationType === "PRODUCTION_WAREHOUSE"
  );
}

function allowedActions(
  session: AuthSession,
  order: Pick<
    OrderSummary,
    "status" | "location" | "inventoryMovementId"
  >
): Action[] {
  if (
    !productionRoles.some((role) =>
      session.authorization.roles.includes(role)
    )
  ) {
    return [];
  }

  const admin = isAdmin(session);

  if (!admin && assignedPlant(session)?.id !== order.location.id) {
    return [];
  }

  const actions: Action[] = ["detail"];

  if (order.status === "DRAFT" && admin) {
    actions.push("edit", "plan", "cancel");
  }

  if (order.status === "PLANNED") {
    actions.push("start");

    if (admin) actions.push("cancel");
  }

  if (order.status === "IN_PROGRESS") {
    actions.push("waste", "complete", "performance");
  }

  if (order.status === "COMPLETED") {
    actions.push("performance");

    if (order.inventoryMovementId) actions.push("movement");
  }

  return actions;
}

async function api<T>(
  session: AuthSession,
  signal: AbortSignal,
  path: string,
  schema: z.ZodType<T>,
  method: "GET" | "PUT" | "POST" | "PATCH" = "GET",
  body?: unknown
) {
  assertProduction(session);

  const response = await request(
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

  return response.data;
}

function checkOrder<
  T extends {
    id: string;
    businessId: string;
    location: { id: string };
  },
>(session: AuthSession, order: T, expectedId?: string): T {
  if (
    order.businessId !== session.business.id ||
    (expectedId && order.id !== expectedId)
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La orden recibida no corresponde a la consulta."
    );
  }

  plantScope(session, order.location.id);

  return order;
}

async function loadPlants(session: AuthSession, signal: AbortSignal) {
  assertProduction(session);

  if (!isAdmin(session)) return [assignedPlant(session)!];

  return (await getLocations(session, signal)).filter(usablePlant);
}

async function loadContext(
  session: AuthSession,
  signal: AbortSignal
) {
  const plants = await loadPlants(session, signal);

  if (isAdmin(session)) {
    return { plants, zone: null };
  }

  // La configuración del negocio es ADMIN.
  // El informe autorizado informa la zona horaria del negocio.
  const today = new Date().toISOString().slice(0, 10);

  const params = new URLSearchParams({
    from: today,
    to: today,
    dateField: "COMPLETED",
    locationId: plantScope(session),
  });

  const { report } = await api(
    session,
    signal,
    "/production-reports/summary?" + params,
    z.object({
      report: z.object({
        period: z.object({
          timezone: z.string(),
        }),
      }),
    })
  );

  new Intl.DateTimeFormat("es-CO", {
    timeZone: report.period.timezone,
  });

  return {
    plants,
    zone: report.period.timezone,
  };
}

async function listOrders(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) {
  const location = plantScope(session, locationId);
  const params = new URLSearchParams();

  if (location) params.set("locationId", id.parse(location));

  const result = await api(
    session,
    signal,
    "/production-orders" + (params.size ? "?" + params : ""),
    z.object({
      productionOrders: z.array(orderSummarySchema),
    })
  );

  return result.productionOrders.map((order) =>
    checkOrder(session, order)
  );
}

async function getOrder(
  session: AuthSession,
  signal: AbortSignal,
  orderId: string
) {
  const result = await api(
    session,
    signal,
    "/production-orders/" + id.parse(orderId),
    z.object({
      productionOrder: orderSchema,
    })
  );

  return checkOrder(session, result.productionOrder, orderId);
}

async function getPerformance(
  session: AuthSession,
  signal: AbortSignal,
  order: Order
) {
  const result = await api(
    session,
    signal,
    "/production-orders/" + order.id + "/performance",
    z.object({
      performance: performanceSchema,
    })
  );

  const value = result.performance;

  if (
    value.productionOrderId !== order.id ||
    value.businessId !== session.business.id ||
    value.locationId !== order.location.id
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El rendimiento no corresponde a la orden."
    );
  }

  return value;
}

async function orderResources(
  session: AuthSession,
  signal: AbortSignal,
  orderId: string
) {
  const order = await getOrder(session, signal, orderId);

  const [performance, waste, balances] = await Promise.all([
    getPerformance(session, signal, order),

    api(
      session,
      signal,
      "/production-orders/" + order.id + "/waste",
      z.object({
        wasteRecords: z.array(wasteSchema),
      })
    ),

    isAdmin(session)
      ? loadBalances(session, signal, order.location.id)
      : Promise.resolve(null),
  ]);

  for (const record of waste.wasteRecords) {
    if (
      record.businessId !== session.business.id ||
      record.productionOrderId !== order.id
    ) {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "El desperdicio no corresponde a la orden."
      );
    }
  }

  return {
    order,
    performance,
    waste: waste.wasteRecords,
    balances,
  };
}

type OrderResources = Awaited<ReturnType<typeof orderResources>>;

async function orderPage(
  session: AuthSession,
  signal: AbortSignal,
  ids: string[]
) {
  const result: {
    order: Order;
    value: string | null;
  }[] = [];

  for (let offset = 0; offset < ids.length; offset += 4) {
    signal.throwIfAborted();

    result.push(
      ...(await Promise.all(
        ids.slice(offset, offset + 4).map(async (orderId) => {
          const order = await getOrder(session, signal, orderId);

          const performance =
            order.status === "COMPLETED"
              ? await getPerformance(session, signal, order)
              : null;

          return {
            order,
            value:
              performance?.summary.producedInventoryValue ?? null,
          };
        })
      ))
    );
  }

  return result;
}

async function listRecipes(
  session: AuthSession,
  signal: AbortSignal
) {
  const { recipes } = await api(
    session,
    signal,
    "/production-recipes",
    z.object({
      recipes: z.array(recipeSummarySchema),
    })
  );

  if (
    recipes.some(
      (recipe) => recipe.businessId !== session.business.id
    )
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Las recetas no corresponden al negocio."
    );
  }

  return recipes;
}

async function getRecipe(
  session: AuthSession,
  signal: AbortSignal,
  recipeId: string
) {
  const { recipe } = await api(
    session,
    signal,
    "/production-recipes/" + id.parse(recipeId),
    z.object({
      recipe: recipeSchema,
    })
  );

  if (
    recipe.businessId !== session.business.id ||
    recipe.id !== recipeId
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La receta no corresponde a la consulta."
    );
  }

  return recipe;
}

async function getOrderMovement(
  session: AuthSession,
  signal: AbortSignal,
  order: Order
) {
  if (!order.inventoryMovementId) {
    throw new Error("La orden todavía no tiene movimiento.");
  }

  const { production } = await api(
    session,
    signal,
    "/production/" + id.parse(order.inventoryMovementId),
    z.object({
      production: movementDetail,
    })
  );

  if (
    production.id !== order.inventoryMovementId ||
    production.businessId !== session.business.id ||
    production.location?.id !== order.location.id ||
    production.movementType !== "PRODUCTION"
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El movimiento no corresponde a la orden."
    );
  }

  return production;
}

async function saveOrder(
  session: AuthSession,
  signal: AbortSignal,
  order: Order,
  mutation: Mutation
) {
  if (!allowedActions(session, order).includes(mutation.action)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "La acción no está permitida para esta orden."
    );
  }

  if (mutation.payload.version !== order.version) {
    throw new Error("Actualiza la versión de la orden.");
  }

  const path = "/production-orders/" + id.parse(order.id);

  const response = z.object({
    productionOrder: orderSchema,
  });

  let result: { productionOrder: Order };

  switch (mutation.action) {
    case "edit":
      result = await api(
        session,
        signal,
        path,
        response,
        "PUT",
        editOrderSchema.parse(mutation.payload)
      );
      break;

    case "plan":
    case "cancel":
      result = await api(
        session,
        signal,
        path + "/status",
        response,
        "PATCH",
        {
          version: order.version,
          status:
            mutation.action === "plan" ? "PLANNED" : "CANCELLED",
          cancellationReason:
            mutation.action === "cancel"
              ? z
                  .string()
                  .trim()
                  .min(3)
                  .max(500)
                  .parse(mutation.payload.cancellationReason)
              : null,
        }
      );
      break;

    case "start":
      result = await api(
        session,
        signal,
        path + "/start",
        response,
        "POST",
        { version: order.version }
      );
      break;

    case "complete": {
      const body = completeOrderSchema.parse(mutation.payload);

      for (const group of ["inputs", "outputs"] as const) {
        const expected = new Set(
          order[group].map((line) => line.inventoryItemId)
        );

        if (
          body[group].length !== expected.size ||
          body[group].some(
            (line) => !expected.has(line.inventoryItemId)
          )
        ) {
          throw new Error(
            "Los artículos deben coincidir exactamente con la orden."
          );
        }
      }

      result = await api(
        session,
        signal,
        path + "/complete",
        response,
        "POST",
        body
      );
      break;
    }

    case "waste": {
      const body = wasteInputSchema.parse(mutation.payload);

      const expected = new Set(
        [...order.inputs, ...order.outputs].map(
          (line) => line.inventoryItemId
        )
      );

      if (
        body.lines.some((line) => !expected.has(line.inventoryItemId))
      ) {
        throw new Error(
          "Solo puedes registrar artículos de esta orden."
        );
      }

      result = await api(
        session,
        signal,
        path + "/waste",
        response.extend({ wasteRecord: wasteSchema }),
        "POST",
        body
      );
      break;
    }
  }

  return checkOrder(session, result.productionOrder, order.id);
}

async function loadPeriod(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string,
  from: string,
  to: string
) {
  const params = new URLSearchParams({
    from,
    to,
    dateField: "COMPLETED",
  });

  const location = plantScope(session, locationId);

  if (location) params.set("locationId", location);

  const summary = await api(
    session,
    signal,
    "/production-reports/summary?" + params,
    z.object({
      report: reportSummarySchema,
    })
  );

  params.set("pageSize", "100");

  const seen = new Set<string>();
  let count = 0;
  let expected = -1;
  let unavailable = false;

  for (let page = 1; ; page++) {
    signal.throwIfAborted();
    params.set("page", String(page));

    const { report } = await api(
      session,
      signal,
      "/production-reports/orders?" + params,
      z.object({
        report: historySchema,
      })
    );

    if (expected !== -1 && report.pagination.total !== expected) {
      throw new Error(
        "El período cambió durante la consulta. Actualiza."
      );
    }

    expected = report.pagination.total;

    for (const row of report.orders) {
      plantScope(session, row.location.id);

      if (seen.has(row.productionOrderId)) {
        throw new Error("El período cambió. Actualiza.");
      }

      seen.add(row.productionOrderId);

      if (row.status === "COMPLETED") {
        if (row.inputCostDifference === null) {
          unavailable = true;
        } else if (fixed(row.inputCostDifference) !== 0n) {
          count++;
        }
      }
    }

    if (page >= report.pagination.totalPages) break;

    if (!report.orders.length) {
      throw new Error("La consulta del período está incompleta.");
    }
  }

  if (seen.size !== expected) {
    throw new Error("La consulta del período está incompleta.");
  }

  return {
    summary: summary.report.summary,
    variations: unavailable ? null : count,
  };
}

function cash(value: string | null, currency: string) {
  if (value === null) return "Sin valoración";

  return currency ? money(value, currency) : formatQuantity(value);
}

function cost(
  value: string | null,
  base: Parameters<typeof formatCost>[1],
  currency: string
) {
  if (currency) return formatCost(value, base, currency);

  return value === null
    ? "Sin valoración"
    : formatQuantity(value) + "/" + unit(base);
}

function percentage(value: string | null) {
  return value === null ? "—" : formatQuantity(value) + " %";
}

function timestamp(value: string | null, zone: string) {
  if (value === null) return "Pendiente";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorText(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => issue.path.join(".") + ": " + issue.message)
      .join("\n");
  }

  if (error instanceof ApiError) {
    return (
      error.message +
      (error.errors.length
        ? "\n" +
          error.errors
            .map((item) => item.field + ": " + item.message)
            .join("\n")
        : "")
    );
  }

  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación.";
}

function plannedISO(
  day: string,
  zone: string,
  original: string | null
) {
  if (!day) return null;

  if (original && dayKey(original, zone) === day) {
    return original;
  }

  z.iso.date().parse(day);

  const target = Date.parse(day + "T00:00:00Z");

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const localTime = (value: number) => {
    const parts = formatter.formatToParts(value);

    const part = (type: string) =>
      parts.find((item) => item.type === type)!.value;

    return Date.parse(
      part("year") +
        "-" +
        part("month") +
        "-" +
        part("day") +
        "T" +
        part("hour") +
        ":" +
        part("minute") +
        ":" +
        part("second") +
        "Z"
    );
  };

  let guess = target;

  for (let index = 0; index < 4; index++) {
    guess += target - localTime(guess);
  }

  if (localTime(guess) !== target) {
    throw new Error(
      "No se pudo representar esa fecha en la zona del negocio."
    );
  }

  return new Date(guess).toISOString();
}

function estimate(
  order: Order,
  balances: OrderResources["balances"],
  actual: Record<string, string>
) {
  const inputs = order.inputs.map((line) => {
    const balance = balances?.find(
      (row) => row.inventoryItemId === line.inventoryItemId
    );

    const rate =
      balance?.valuationStatus === "VALUED"
        ? balance.averageUnitCost
        : null;

    return {
      id: line.inventoryItemId,
      expected:
        rate == null ? null : multiply(line.plannedQuantity, rate),
      actual:
        rate == null
          ? null
          : multiply(actual[line.inventoryItemId], rate),
    };
  });

  const sum = (values: (string | null)[]) =>
    values.some((value) => value === null)
      ? null
      : values.reduce<string>(
          (total, value) => add(total, value!),
          "0"
        );

  const expected = sum(inputs.map((line) => line.expected));
  const total = sum(inputs.map((line) => line.actual));

  let allocated = "0";

  const outputs = order.outputs.map((line, index) => {
    const value =
      total === null
        ? null
        : index === order.outputs.length - 1
          ? subtract(total, allocated)
          : divide(
              multiply(total, line.costAllocationPercentage),
              "100"
            );

    if (value !== null) allocated = add(allocated, value);

    return {
      id: line.inventoryItemId,
      value,
      unitCost:
        value === null
          ? null
          : divide(value, actual[line.inventoryItemId]),
    };
  });

  return {
    inputs,
    outputs,
    expected,
    total,
    difference:
      total === null || expected === null
        ? null
        : subtract(total, expected),
  };
}

function StatusBadge({ status }: { status: Status }) {
  const tones: Record<Status, string> = {
    DRAFT: "bg-secondary text-muted",
    PLANNED: "bg-violet-500/10 text-violet-700 dark:text-violet-200",
    IN_PROGRESS:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    COMPLETED:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    CANCELLED: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  return (
    <span
      className={
        "inline-flex rounded-xl px-2 py-1 text-xs font-medium " +
        tones[status]
      }
    >
      {statusLabels[status]}
    </span>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="flex gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm leading-6 text-heading"
    >
      <CircleAlert
        size={18}
        aria-hidden
        className="mt-1 shrink-0 text-orange-600 dark:text-orange-400"
      />
      <div>{children}</div>
    </div>
  );
}

function Metrics({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="min-w-0 rounded-2xl border border-outline bg-surface p-4"
        >
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="m-0 mt-2 text-xl font-bold text-heading [overflow-wrap:anywhere]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function InventoryProduction() {
  const { session, settings } = useAppShell();
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);

  const context = useInventoryQuery(
    "production-context",
    loadContext,
    revision,
    productionRoles
  );

  const plants = {
    ...context,
    data: context.data?.plants ?? null,
  };

  const refresh = () => setRevision((value) => value + 1);

  useInventoryRealtime(session, () => {
    if (plants.pending) return false;

    refresh();
    return true;
  });

  const admin = isAdmin(session);

  const allowed =
    admin || session.authorization.roles.includes("PRODUCTION");

  const currency = admin ? (settings.data?.currencyCode ?? "") : "";

  const zone = admin ? settings.data?.timezone : context.data?.zone;

  const requested = params.get("locationId") ?? "";

  const locationId = admin
    ? plants.data?.some((plant) => plant.id === requested)
      ? requested
      : ""
    : (assignedPlant(session)?.id ?? "");

  const inventoryTabs = [
    { id: "summary", label: "Resumen", Icon: ChartNoAxesCombined },
    { id: "stock", label: "Existencias", Icon: Boxes },
    { id: "purchases", label: "Compras", Icon: ReceiptText },
    { id: "movements", label: "Movimientos", Icon: History },
    { id: "production", label: "Producción", Icon: Factory },
    {
      id: "kardex",
      label: "Kardex y costos",
      Icon: SlidersHorizontal,
    },
    {
      id: "reconciliation",
      label: "Conciliación",
      Icon: ClipboardCheck,
    },
  ];

  if (!allowed) {
    return <Notice>No tienes acceso a Producción.</Notice>;
  }

  if (!admin && !assignedPlant(session)) {
    return (
      <Notice>
        No tienes una planta de producción asignada. Solicita la
        asignación a un administrador.
      </Notice>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 text-heading">
      <nav
        aria-label="Secciones de inventario"
        className="flex min-w-0 gap-1 overflow-x-auto border-b border-outline pb-2"
      >
        {inventoryTabs
          .filter((tab) => admin || tab.id === "production")
          .map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === "production" ? "page" : undefined}
              className={
                "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent " +
                (id === "production"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-secondary")
              }
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("tab", id);
                  return next;
                })
              }
            >
              <Icon size={17} aria-hidden />
              {label}
            </button>
          ))}
      </nav>

      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="text-xl font-bold">Producción</h2>
          <p className="mt-1 text-sm text-muted">
            Planifica, ejecuta y analiza la transformación de
            inventario.
          </p>
        </div>

        <Choice
          label="Planta"
          value={locationId}
          disabled={!admin || plants.pending}
          onValueChange={(value) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);

              next.set("tab", "production");

              if (value) next.set("locationId", value);
              else next.delete("locationId");

              return next;
            })
          }
          options={[
            ...(admin
              ? [{ value: "", label: "Todas las plantas" }]
              : []),
            ...(plants.data ?? []).map((plant) => ({
              value: plant.id,
              label: plant.name + " · " + plant.code,
            })),
          ]}
        />
      </div>

      <nav
        aria-label="Secciones de producción"
        className="flex gap-1 overflow-x-auto border-b border-outline pb-2"
      >
        {[
          { label: "Órdenes", Icon: ClipboardList, ready: true },
          {
            label: "Producción rápida",
            Icon: FlaskConical,
            ready: false,
          },
          { label: "Recetas", Icon: BookOpen, ready: false },
          {
            label: "Informes",
            Icon: ChartNoAxesCombined,
            ready: false,
          },
        ].map(({ label, Icon, ready }) => (
          <button
            type="button"
            key={label}
            disabled={!ready}
            aria-current={ready ? "page" : undefined}
            title={ready ? undefined : "Próximamente"}
            className={
              "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm disabled:opacity-50 " +
              (ready ? "bg-accent/10 text-accent" : "text-muted")
            }
          >
            <Icon size={17} aria-hidden />
            {label}
          </button>
        ))}

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          disabled={plants.pending}
          aria-label="Actualizar producción"
          onClick={refresh}
        >
          <RefreshCw size={17} />
        </Button>
      </nav>

      {plants.pending && <Notice>Actualizando plantas…</Notice>}

      {plants.error && (
        <Notice>
          {plants.error}{" "}
          <Button variant="secondary" onClick={plants.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {admin && settings.error && (
        <Notice>
          {settings.error}{" "}
          <Button variant="secondary" onClick={settings.retry}>
            Reintentar configuración
          </Button>
        </Notice>
      )}

      {admin && !settings.data && !settings.error && (
        <Notice>Cargando configuración del negocio…</Notice>
      )}

      {!admin && (
        <Notice>
          Los importes se muestran en la moneda del negocio, sin
          símbolo.
        </Notice>
      )}

      {plants.data &&
        !plants.error &&
        zone &&
        (!admin || !settings.error) && (
          <ProductionOrders
            key={locationId}
            locationId={locationId}
            currency={currency}
            zone={zone}
            revision={revision}
            onChanged={refresh}
          />
        )}
    </div>
  );
}

function useOrderPage(idsKey: string, revision: number) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      orderPage(session, signal, JSON.parse(idsKey) as string[]),
    [idsKey]
  );

  return useInventoryQuery(
    "production-order-page:" + idsKey,
    loader,
    revision,
    productionRoles
  );
}

function ProductionOrders({
  locationId,
  currency,
  zone,
  revision,
  onChanged,
}: {
  locationId: string;
  currency: string;
  zone: string;
  revision: number;
  onChanged: () => void;
}) {
  const { session } = useAppShell();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [notice, setNotice] = useState("");

  const [selection, setSelection] = useState<{
    id: string;
    action: Action;
  } | null>(null);

  const [returned, setReturned] = useState<Order | null>(null);

  const today = calendarToday(zone);
  const from = today.slice(0, 7) + "-01";

  const loader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      listOrders(current, signal, locationId),
    [locationId]
  );

  const query = useInventoryQuery(
    "production-orders:" + locationId,
    loader,
    revision,
    productionRoles
  );

  const periodLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      loadPeriod(current, signal, locationId, from, today),
    [locationId, from, today]
  );

  const period = useInventoryQuery(
    "production-period:" + locationId + ":" + from + ":" + today,
    periodLoader,
    revision,
    productionRoles
  );

  const items = (query.data ?? []).map((row) =>
    returned?.id === row.id && returned.version >= row.version
      ? {
          ...returned,
          inputCount: returned.inputs.length,
          outputCount: returned.outputs.length,
        }
      : row
  );

  const filtered = items.filter(
    (row) =>
      (!status || row.status === status) &&
      searchKey(
        "OP-" + row.id + " " + row.recipe.code + " " + row.recipe.name
      ).includes(searchKey(search))
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size))
  );

  const visible = filtered.slice(
    (current - 1) * size,
    current * size
  );

  const idsKey = JSON.stringify(visible.map((row) => row.id));
  const details = useOrderPage(idsKey, revision);

  const icons = {
    detail: Eye,
    edit: Pencil,
    plan: CalendarCheck,
    start: Play,
    cancel: Trash2,
    complete: CircleCheck,
    waste: Trash2,
    performance: ChartNoAxesCombined,
    movement: History,
  };

  const rows = visible.map((summary) => {
    const detail = details.data?.find(
      (item) => item.order.id === summary.id
    );

    const row = detail?.order ?? summary;

    return {
      id: row.id,
      fields: [
        {
          label: "Orden",
          value: (
            <button
              type="button"
              className="min-h-11 font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              onClick={() =>
                setSelection({ id: row.id, action: "detail" })
              }
            >
              OP-{row.id}
            </button>
          ),
        },
        {
          label: "Receta",
          value: (
            <div>
              {row.recipe.name}
              <p className="text-xs text-muted">{row.recipe.code}</p>
            </div>
          ),
        },
        {
          label: "Planta",
          value: row.location.name + " · " + row.location.code,
        },
        {
          label: "Estado",
          value: <StatusBadge status={row.status} />,
        },
        {
          label: "Fecha prevista",
          value: row.plannedFor
            ? dayKey(row.plannedFor, zone)
            : "Sin fecha",
        },
        {
          label: "Responsable",
          value:
            row.completedByName ??
            row.startedByName ??
            row.createdByName,
        },
        {
          label: "Productos esperados",
          value: detail
            ? detail.order.outputs
                .map(
                  (line) =>
                    line.inventoryItemName +
                    " · " +
                    quantity(line.plannedQuantity, line.baseUnit)
                )
                .join("; ")
            : details.pending
              ? "Cargando…"
              : summary.outputCount +
                " resultados · consulta el detalle",
        },
        {
          label: "Valor producido",
          value:
            row.status !== "COMPLETED"
              ? "No aplicado"
              : details.pending
                ? "Cargando…"
                : cash(detail?.value ?? null, currency),
        },
        {
          label: "Acciones",
          value: (
            <ActionMenu
              label={"Acciones de OP-" + row.id}
              actions={allowedActions(session, row).map((action) => {
                const Icon = icons[action];

                return {
                  id: action,
                  label: actionLabels[action],
                  icon: <Icon size={16} />,
                  danger: action === "cancel",
                  separatorBefore: action === "cancel",
                  onSelect: () =>
                    setSelection({ id: row.id, action }),
                };
              })}
            />
          ),
        },
      ],
    };
  });

  function saved(order: Order) {
    setReturned(order);
    setSelection(null);

    setNotice(
      "Orden OP-" +
        order.id +
        " actualizada. Estado: " +
        statusLabels[order.status] +
        "."
    );

    onChanged();
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">
          Órdenes de producción
        </h3>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled title="Próximamente">
            <FlaskConical size={17} />
            Producción rápida
          </Button>

          {isAdmin(session) && (
            <Button disabled title="Próximamente">
              <Plus size={17} />
              Nueva orden
            </Button>
          )}
        </div>
      </div>

      {notice && <Notice>{notice}</Notice>}

      {query.pending && <Notice>Consultando órdenes…</Notice>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="secondary" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!query.pending && !query.error && query.data && (
        <>
          <Metrics
            rows={[
              {
                label: "Borradores",
                value: items.filter((row) => row.status === "DRAFT")
                  .length,
              },
              {
                label: "Planificadas",
                value: items.filter((row) => row.status === "PLANNED")
                  .length,
              },
              {
                label: "En proceso",
                value: items.filter(
                  (row) => row.status === "IN_PROGRESS"
                ).length,
              },
              {
                label: "Completadas durante el período",
                value: period.pending
                  ? "…"
                  : period.error
                    ? "Sin datos"
                    : (period.data?.summary.completedCount ??
                      "Sin datos"),
              },
              {
                label: "Órdenes con variación de costo en el período",
                value: period.pending
                  ? "…"
                  : period.error
                    ? "Sin datos"
                    : (period.data?.variations ?? "Sin datos"),
              },
              {
                label: "Costo producido durante el período",
                value: period.pending
                  ? "…"
                  : period.error
                    ? "Sin datos"
                    : cash(
                        period.data?.summary.producedInventoryValue ??
                          null,
                        currency
                      ),
              },
            ]}
          />

          <p className="text-xs text-muted">
            Período: {from} a {today} · Fecha de finalización · {zone}
            . Los estados pendientes abarcan todas las fechas de la
            planta seleccionada.
          </p>

          {period.error && (
            <Notice>
              {period.error}{" "}
              <Button variant="secondary" onClick={period.refresh}>
                Reintentar resumen
              </Button>
            </Notice>
          )}

          <div className="grid gap-3 border-b border-outline pb-4">
            <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm">
                Buscar
                <input
                  type="search"
                  value={search}
                  placeholder="Número, código o nombre de receta"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 min-w-0 rounded-xl border border-outline bg-surface px-3 text-heading outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <Button
                variant="ghost"
                className="min-h-11 justify-self-end"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(1);
                }}
              >
                <FilterX size={17} />
                Limpiar filtros
              </Button>
            </div>

            <div className="md:max-w-xs">
              <Choice
                label="Estado"
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Todos los estados" },
                  ...Object.entries(statusLabels).map(
                    ([value, label]) => ({ value, label })
                  ),
                ]}
              />
            </div>
          </div>

          {details.error && (
            <Notice>
              {details.error}{" "}
              <Button variant="secondary" onClick={details.refresh}>
                Reintentar detalles
              </Button>
            </Notice>
          )}

          <Records label="Órdenes de producción" rows={rows} wide />

          {!filtered.length && (
            <Notice>No hay órdenes para estos filtros.</Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={filtered.length}
            itemLabel="órdenes"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}

      {selection && (
        <ProductionOrderDialog
          key={selection.id + ":" + selection.action}
          {...selection}
          currency={currency}
          zone={zone}
          onClose={() => setSelection(null)}
          onSaved={saved}
          onStale={onChanged}
        />
      )}
    </div>
  );
}

interface FormContext {
  data: OrderResources;
  currency: string;
  zone: string;
  busy: boolean;
  locked: boolean;
  error: string;
  onClose: () => void;
  commit: (mutation: Mutation) => Promise<void>;
}

function ProductionOrderDialog({
  id,
  action,
  currency,
  zone,
  onClose,
  onSaved,
  onStale,
}: {
  id: string;
  action: Action;
  currency: string;
  zone: string;
  onClose: () => void;
  onSaved: (order: Order) => void;
  onStale: () => void;
}) {
  const { session } = useAppShell();

  const loader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      orderResources(current, signal, id),
    [id]
  );

  const query = useInventoryQuery(
    "production-order-action:" + id + ":" + action,
    loader,
    0,
    productionRoles
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const missingReported = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (
      !query.pending &&
      query.status === 404 &&
      !missingReported.current
    ) {
      missingReported.current = true;
      onStale();
    }
  }, [query.pending, query.status, onStale]);

  const close = () => {
    if (!lock.current) onClose();
  };

  async function commit(mutation: Mutation) {
    if (!query.data || lock.current || locked) return;

    lock.current = true;
    setBusy(true);
    setError("");

    controller.current = new AbortController();

    try {
      const updated = await saveOrder(
        session,
        controller.current.signal,
        query.data.order,
        mutation
      );

      onSaved(updated);
    } catch (caught) {
      if (controller.current.signal.aborted) return;

      let message = errorText(caught);

      if (caught instanceof ApiError) {
        if (caught.status === 409) {
          message +=
            "\nSe volverá a consultar la orden. Revisa sus datos y su versión antes de confirmar otra vez.";

          query.refresh();
          onStale();
        }

        if (caught.status === 404) {
          setLocked(true);
          onStale();
        }

        if (caught.status === 401 || caught.status === 403) {
          setLocked(true);
        }

        if (caught.status === 0 || caught.status >= 500) {
          setLocked(true);
          query.refresh();
          onStale();

          message +=
            "\nNo pudimos confirmar el resultado. No vuelvas a enviar esta operación sin revisar el estado y los desperdicios registrados.";
        }
      }

      setError(message);
    } finally {
      lock.current = false;

      if (!controller.current?.signal.aborted) {
        setBusy(false);
      }
    }
  }

  if (query.pending || query.error || !query.data) {
    return (
      <Modal title={"Orden OP-" + id} onClose={close}>
        {error && (
          <p
            role="alert"
            className="whitespace-pre-line text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <Notice>
          {query.pending
            ? "Consultando la versión vigente…"
            : query.error || "No hay datos de la orden."}

          {!query.pending && (
            <Button variant="secondary" onClick={query.refresh}>
              Reintentar
            </Button>
          )}
        </Notice>
      </Modal>
    );
  }

  const data = query.data;

  if (!allowedActions(session, data.order).includes(action)) {
    return (
      <Modal title={"Orden OP-" + id} onClose={close}>
        {error && (
          <p role="alert" className="whitespace-pre-line">
            {error}
          </p>
        )}

        <Notice>
          La acción ya no está disponible para el estado actual o para
          tus permisos.
        </Notice>
      </Modal>
    );
  }

  const context: FormContext = {
    data,
    currency,
    zone,
    busy,
    locked,
    error,
    onClose: close,
    commit,
  };

  const key = data.order.id + ":" + data.order.version;

  if (action === "edit") {
    return <EditOrderForm key={key} context={context} />;
  }

  if (action === "complete" || action === "waste") {
    return (
      <ExecutionForm key={key} context={context} action={action} />
    );
  }

  if (
    action === "plan" ||
    action === "start" ||
    action === "cancel"
  ) {
    return (
      <TransitionForm key={key} context={context} action={action} />
    );
  }

  return (
    <Modal
      title={
        (action === "movement"
          ? "Movimiento valorizado · OP-"
          : action === "performance"
            ? "Rendimiento · OP-"
            : "Detalle de producción · OP-") + id
      }
      wide
      onClose={close}
    >
      <ProductionOrderDetail
        data={data}
        currency={currency}
        zone={zone}
        movement={action === "movement"}
      />
    </Modal>
  );
}

function Frame({
  context: c,
  title,
  footer,
  children,
}: {
  context: FormContext;
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Modal
      title={title}
      wide
      busy={c.busy}
      onClose={c.onClose}
      footer={footer}
    >
      <div className="grid min-w-0 gap-5">
        <p className="text-sm text-muted">
          {c.data.order.recipe.code} · {c.data.order.recipe.name} ·{" "}
          {c.data.order.location.name} · Versión{" "}
          {c.data.order.version}
        </p>

        {c.error && (
          <div
            role="alert"
            className="whitespace-pre-line rounded-xl border border-red-500/30 p-3 text-sm text-red-600 dark:text-red-400"
          >
            {c.error}
          </div>
        )}

        <fieldset
          disabled={c.busy || c.locked}
          className="m-0 grid min-w-0 gap-5 border-0 p-0"
        >
          {children}
        </fieldset>
      </div>
    </Modal>
  );
}

function TransitionForm({
  context: c,
  action,
}: {
  context: FormContext;
  action: "plan" | "start" | "cancel";
}) {
  const [reason, setReason] = useState("");
  const order = c.data.order;

  const title =
    action === "plan"
      ? "Planificar"
      : action === "start"
        ? "Iniciar"
        : "Cancelar";

  const invalid =
    action === "plan"
      ? !order.plannedFor
      : action === "cancel"
        ? reason.trim().length < 3
        : false;

  return (
    <Frame
      context={c}
      title={title + " OP-" + order.id}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={c.busy}
            onClick={c.onClose}
          >
            Cerrar
          </Button>

          <Button
            variant={action === "cancel" ? "danger" : "primary"}
            loading={c.busy}
            disabled={c.locked || invalid}
            onClick={() =>
              void c.commit(
                action === "cancel"
                  ? {
                      action,
                      payload: {
                        version: order.version,
                        cancellationReason: reason.trim(),
                      },
                    }
                  : {
                      action,
                      payload: { version: order.version },
                    }
              )
            }
          >
            {title} OP-{order.id}
          </Button>
        </>
      }
    >
      {action === "cancel" ? (
        <>
          <Warning>
            Se cancelará esta orden. No se modificarán las
            existencias.
          </Warning>

          <Field
            label="Motivo obligatorio"
            value={reason}
            onChange={setReason}
            multiline
            maxLength={500}
            placeholder="Explica por qué se cancela la orden"
          />
        </>
      ) : (
        <Notice>
          {action === "plan"
            ? order.plannedFor
              ? "La orden quedará planificada; el inventario no se reserva ni se descuenta todavía."
              : "Edita el borrador y asigna una fecha prevista antes de planificar."
            : "La orden pasará a En proceso. Las existencias se aplicarán al completar."}
        </Notice>
      )}
    </Frame>
  );
}

function EditOrderForm({ context: c }: { context: FormContext }) {
  const order = c.data.order;

  const [recipeId, setRecipe] = useState(order.recipe.id);
  const [locationId, setLocation] = useState(order.location.id);
  const [batch, setBatch] = useState(order.batchQuantity);

  const [day, setDay] = useState(
    order.plannedFor ? dayKey(order.plannedFor, c.zone) : ""
  );

  const [notes, setNotes] = useState(order.notes ?? "");
  const [step, setStep] = useState(1);
  const [validation, setValidation] = useState("");

  const catalogLoader = useCallback(
    async (session: AuthSession, signal: AbortSignal) => {
      const [recipes, plants] = await Promise.all([
        listRecipes(session, signal),
        loadPlants(session, signal),
      ]);

      return { recipes, plants };
    },
    []
  );

  const catalog = useInventoryQuery(
    "production-edit-catalog",
    catalogLoader,
    0,
    productionRoles
  );

  const projectionLoader = useCallback(
    async (session: AuthSession, signal: AbortSignal) => {
      const [recipe, balances] = await Promise.all([
        getRecipe(session, signal, recipeId),
        loadBalances(session, signal, locationId),
      ]);

      return { recipe, balances };
    },
    [recipeId, locationId]
  );

  const projection = useInventoryQuery(
    "production-projection:" + recipeId + ":" + locationId,
    projectionLoader,
    0,
    productionRoles
  );

  const recipe = projection.data?.recipe;
  const batchValid = positiveQuantity.safeParse(batch).success;

  const planned = (value: string) =>
    quantity3(multiply(value, batch));

  const payload = () =>
    editOrderSchema.parse({
      version: order.version,
      recipeId,
      locationId,
      batchQuantity: batch,
      plannedFor: plannedISO(day, c.zone, order.plannedFor),
      notes: notes.trim() || null,
    });

  function next() {
    try {
      payload();

      if (!recipe?.isActive) {
        throw new Error("Selecciona una receta activa.");
      }

      if (
        !catalog.data?.plants.some((plant) => plant.id === locationId)
      ) {
        throw new Error("Selecciona una planta activa.");
      }

      if (
        [...recipe.inputs, ...recipe.outputs].some(
          (line) => fixed(planned(line.quantity)) <= 0n
        )
      ) {
        throw new Error(
          "El lote produce una cantidad demasiado pequeña."
        );
      }

      setValidation("");
      setStep((value) => value + 1);
    } catch (error) {
      setValidation(errorText(error));
    }
  }

  const blocked =
    c.locked ||
    catalog.pending ||
    projection.pending ||
    !!catalog.error ||
    !!projection.error;

  return (
    <Frame
      context={c}
      title="Editar orden en borrador"
      footer={
        <>
          {step > 1 && (
            <Button
              variant="ghost"
              disabled={c.busy}
              onClick={() => setStep((value) => value - 1)}
            >
              Atrás
            </Button>
          )}

          <Button
            variant="secondary"
            disabled={c.busy}
            onClick={c.onClose}
          >
            Cancelar
          </Button>

          <Button
            loading={c.busy}
            disabled={blocked}
            onClick={() => {
              if (step < 3) {
                next();
              } else {
                try {
                  void c.commit({
                    action: "edit",
                    payload: payload(),
                  });
                } catch (error) {
                  setValidation(errorText(error));
                }
              }
            }}
          >
            {step < 3 ? "Continuar" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Paso {step} de 3 ·{" "}
        {["Planificación", "Proyección", "Revisión"][step - 1]}
      </p>

      {validation && (
        <p
          role="alert"
          className="whitespace-pre-line text-red-600 dark:text-red-400"
        >
          {validation}
        </p>
      )}

      {(catalog.pending || projection.pending) && (
        <Notice>Cargando receta y disponibilidad…</Notice>
      )}

      {(catalog.error || projection.error) && (
        <Notice>
          {catalog.error || projection.error}{" "}
          <Button
            variant="secondary"
            onClick={() => {
              catalog.refresh();
              projection.refresh();
            }}
          >
            Reintentar
          </Button>
        </Notice>
      )}

      {step === 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Choice
            label="Planta"
            value={locationId}
            onValueChange={setLocation}
            options={(catalog.data?.plants ?? []).map((plant) => ({
              value: plant.id,
              label: plant.name + " · " + plant.code,
            }))}
          />

          <Choice
            label="Receta"
            value={recipeId}
            onValueChange={setRecipe}
            options={(catalog.data?.recipes ?? [])
              .filter((row) => row.isActive || row.id === recipeId)
              .map((row) => ({
                value: row.id,
                label:
                  row.code +
                  " · " +
                  row.name +
                  (row.isActive ? "" : " · Inactiva"),
              }))}
          />

          <Field
            label="Cantidad de lotes"
            value={batch}
            onChange={setBatch}
            decimal
            placeholder="Ej. 1"
          />

          <DateField
            label="Fecha prevista"
            value={day}
            onValueChange={setDay}
            timeZone={c.zone}
          />
        </div>
      )}

      {recipe &&
        batchValid &&
        !projection.pending &&
        !projection.error && (
          <>
            <div>
              <h3 className="font-semibold">
                {recipe.code} · {recipe.name}
              </h3>

              <p className="text-sm text-muted">
                Rendimiento por lote:{" "}
                {recipe.outputs
                  .map(
                    (line) =>
                      quantity(line.quantity, line.baseUnit) +
                      " " +
                      line.inventoryItemName
                  )
                  .join(" · ")}
              </p>
            </div>

            <Records
              label="Proyección de insumos"
              rows={recipe.inputs.map((line) => {
                const balance = projection.data!.balances.find(
                  (row) =>
                    row.inventoryItemId === line.inventoryItemId
                );

                return {
                  id: line.id,
                  fields: [
                    {
                      label: "Insumo",
                      value: line.inventoryItemName,
                    },
                    {
                      label: "Por lote",
                      value: quantity(line.quantity, line.baseUnit),
                    },
                    { label: "Lotes", value: batch },
                    {
                      label: "Cantidad estimada",
                      value: quantity(
                        planned(line.quantity),
                        line.baseUnit
                      ),
                    },
                    {
                      label: "Disponible",
                      value: balance
                        ? quantity(
                            balance.currentStock,
                            line.baseUnit
                          )
                        : "Sin saldo registrado",
                    },
                    {
                      label: "Disponibilidad",
                      value:
                        balance &&
                        fixed(balance.currentStock) >=
                          fixed(planned(line.quantity))
                          ? "Disponible"
                          : "Insuficiente",
                    },
                  ],
                };
              })}
            />

            {step > 1 && (
              <Records
                label="Resultados esperados"
                rows={recipe.outputs.map((line) => ({
                  id: line.id,
                  fields: [
                    {
                      label: "Producto obtenido",
                      value: line.inventoryItemName,
                    },
                    {
                      label: "Cantidad esperada",
                      value: quantity(
                        planned(line.quantity),
                        line.baseUnit
                      ),
                    },
                    {
                      label: "Asignación del costo",
                      value: percentage(
                        line.costAllocationPercentage
                      ),
                    },
                  ],
                }))}
              />
            )}
          </>
        )}

      {step < 3 ? (
        <Field
          label="Notas"
          value={notes}
          onChange={setNotes}
          multiline
          maxLength={500}
          placeholder="Indicaciones para esta orden"
        />
      ) : (
        <>
          <Notice>
            La orden seguirá en borrador y usará la receta vigente. No
            se aplicarán cambios al inventario.
          </Notice>

          <p>{notes || "Sin notas"}</p>
        </>
      )}
    </Frame>
  );
}

function ExecutionForm({
  context: c,
  action,
}: {
  context: FormContext;
  action: "complete" | "waste";
}) {
  const { session } = useAppShell();
  const order = c.data.order;
  const lines = [...order.inputs, ...order.outputs];

  const [actual, setActual] = useState<Record<string, string>>(
    Object.fromEntries(
      lines.map((line) => [
        line.inventoryItemId,
        line.plannedQuantity,
      ])
    )
  );

  const [waste, setWaste] = useState([
    {
      key: crypto.randomUUID(),
      inventoryItemId: "",
      quantity: "",
      notes: "",
    },
  ]);

  const [reason, setReason] = useState("");
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState("");

  const isWaste = action === "waste";

  const validAmounts = lines.every(
    (line) =>
      positiveQuantity.safeParse(actual[line.inventoryItemId]).success
  );

  const preview =
    !isWaste && validAmounts
      ? estimate(order, c.data.balances, actual)
      : null;

  const wasteCosts = waste.map((line) => {
    const balance = c.data.balances?.find(
      (row) => row.inventoryItemId === line.inventoryItemId
    );

    return balance?.valuationStatus === "VALUED" &&
      balance.averageUnitCost !== null &&
      positiveQuantity.safeParse(line.quantity).success
      ? multiply(line.quantity, balance.averageUnitCost)
      : null;
  });

  const wasteTotal = wasteCosts.some((value) => value === null)
    ? null
    : wasteCosts.reduce<string>(
        (sum, value) => add(sum, value!),
        "0"
      );

  function mutation(): Mutation {
    if (isWaste) {
      return {
        action: "waste",
        payload: wasteInputSchema.parse({
          version: order.version,
          reason,
          lines: waste.map(
            ({ inventoryItemId, quantity: value, notes }) => ({
              inventoryItemId,
              quantity: value,
              notes: notes.trim() || null,
            })
          ),
        }),
      };
    }

    return {
      action: "complete",
      payload: completeOrderSchema.parse({
        version: order.version,
        inputs: order.inputs.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: actual[line.inventoryItemId],
        })),
        outputs: order.outputs.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: actual[line.inventoryItemId],
        })),
      }),
    };
  }

  function next() {
    try {
      mutation();
      setValidation("");
      setConfirmed(false);
      setStep(2);
    } catch (error) {
      setValidation(errorText(error));
    }
  }

  const reviewRows = isWaste
    ? (step === 2 ? waste : []).map((line) => {
        const item = lines.find(
          (item) => item.inventoryItemId === line.inventoryItemId
        )!;

        return {
          id: line.key,
          fields: [
            {
              label: "Artículo",
              value: item.inventoryItemName,
            },
            {
              label: "Cantidad real",
              value: quantity(line.quantity, item.baseUnit),
            },
            {
              label: "Asignación",
              value: "Desperdicio explícito",
            },
          ],
        };
      })
    : lines.map((line) => ({
        id: line.inventoryItemId,
        fields: [
          {
            label: "Artículo",
            value: line.inventoryItemName,
          },
          {
            label: "Cantidad real",
            value: validAmounts
              ? quantity(actual[line.inventoryItemId], line.baseUnit)
              : "—",
          },
          {
            label: "Asignación",
            value:
              "costAllocationPercentage" in line &&
              typeof line.costAllocationPercentage === "string"
                ? percentage(line.costAllocationPercentage)
                : "Consumo",
          },
        ],
      }));

  return (
    <Frame
      context={c}
      title={
        (isWaste ? "Registrar desperdicio · OP-" : "Completar OP-") +
        order.id
      }
      footer={
        <>
          {step === 2 && (
            <Button
              variant="ghost"
              disabled={c.busy}
              onClick={() => {
                setStep(1);
                setConfirmed(false);
              }}
            >
              Atrás
            </Button>
          )}

          <Button
            variant="secondary"
            disabled={c.busy}
            onClick={c.onClose}
          >
            Cancelar
          </Button>

          <Button
            loading={c.busy}
            disabled={c.locked || (step === 2 && !confirmed)}
            onClick={() => {
              if (step === 1) {
                next();
              } else {
                try {
                  void c.commit(mutation());
                } catch (error) {
                  setValidation(errorText(error));
                }
              }
            }}
          >
            {step === 1
              ? "Continuar"
              : isWaste
                ? "Registrar desperdicio"
                : "Completar y aplicar al inventario"}
          </Button>
        </>
      }
    >
      {validation && (
        <p
          role="alert"
          className="whitespace-pre-line text-red-600 dark:text-red-400"
        >
          {validation}
        </p>
      )}

      {isWaste && (
        <Warning>
          Las variaciones de consumo o rendimiento no se registran
          automáticamente como desperdicio. Registra únicamente una
          pérdida física identificada.
        </Warning>
      )}

      {step === 1 &&
        (isWaste ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Desperdicios</h3>

              <Button
                variant="ghost"
                disabled={
                  waste.length >= lines.length || waste.length >= 100
                }
                onClick={() =>
                  setWaste((previous) => [
                    ...previous,
                    {
                      key: crypto.randomUUID(),
                      inventoryItemId: "",
                      quantity: "",
                      notes: "",
                    },
                  ])
                }
              >
                <Plus size={16} />
                Agregar línea
              </Button>
            </div>

            {waste.map((line, index) => {
              const item = lines.find(
                (item) =>
                  item.inventoryItemId === line.inventoryItemId
              );

              const balance = c.data.balances?.find(
                (row) => row.inventoryItemId === line.inventoryItemId
              );

              const update = (patch: Partial<typeof line>) =>
                setWaste((previous) =>
                  previous.map((row, position) =>
                    position === index ? { ...row, ...patch } : row
                  )
                );

              return (
                <div
                  key={line.key}
                  className="grid gap-3 border-b border-outline pb-4"
                >
                  <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
                    <Choice
                      label="Artículo"
                      value={line.inventoryItemId}
                      onValueChange={(inventoryItemId) =>
                        update({ inventoryItemId })
                      }
                      options={lines
                        .filter(
                          (item) =>
                            item.inventoryItemId ===
                              line.inventoryItemId ||
                            !waste.some(
                              (row) =>
                                row.inventoryItemId ===
                                item.inventoryItemId
                            )
                        )
                        .map((item) => ({
                          value: item.inventoryItemId,
                          label:
                            item.inventoryItemName +
                            " · " +
                            (item.inventoryItemSku || "Sin SKU") +
                            " · " +
                            unit(item.baseUnit),
                        }))}
                    />

                    <Field
                      label={
                        "Cantidad" +
                        (item ? " · " + unit(item.baseUnit, "2") : "")
                      }
                      value={line.quantity}
                      onChange={(value) =>
                        update({ quantity: value })
                      }
                      decimal
                      placeholder="Ej. 0.100"
                    />

                    <Button
                      variant="ghost"
                      aria-label={"Eliminar línea " + (index + 1)}
                      disabled={waste.length === 1}
                      onClick={() =>
                        setWaste((previous) =>
                          previous.filter(
                            (row) => row.key !== line.key
                          )
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>

                  {item && (
                    <p className="text-xs text-muted">
                      Disponible:{" "}
                      {balance
                        ? quantity(
                            balance.currentStock,
                            item.baseUnit
                          )
                        : "Se validará al confirmar"}{" "}
                      · Costo estimado:{" "}
                      {cash(wasteCosts[index], c.currency)}
                    </p>
                  )}

                  <Field
                    label="Notas de la línea (opcional)"
                    value={line.notes}
                    onChange={(notes) => update({ notes })}
                    maxLength={500}
                    placeholder="Describe la pérdida"
                  />
                </div>
              );
            })}

            <Field
              label="Motivo obligatorio"
              value={reason}
              onChange={setReason}
              maxLength={500}
              placeholder="Explica qué ocurrió"
              multiline
            />

            <p className="text-xs text-muted">
              Responsable: {session.user.fullName}
            </p>
          </>
        ) : (
          <>
            {(["inputs", "outputs"] as const).map((group) => (
              <section key={group} className="grid gap-4">
                <h3 className="font-semibold">
                  {group === "inputs"
                    ? "Insumos"
                    : "Productos obtenidos"}
                </h3>

                {order[group].map((line) => {
                  const balance = c.data.balances?.find(
                    (row) =>
                      row.inventoryItemId === line.inventoryItemId
                  );

                  const amount = actual[line.inventoryItemId];

                  const valid =
                    positiveQuantity.safeParse(amount).success;

                  const outputCost = preview?.outputs.find(
                    (row) => row.id === line.inventoryItemId
                  );

                  return (
                    <div
                      key={line.inventoryItemId}
                      className="grid gap-3 border-b border-outline pb-4"
                    >
                      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_7rem]">
                        <p>
                          {line.inventoryItemName}
                          <span className="block text-xs text-muted">
                            {line.inventoryItemSku || "Sin SKU"}
                          </span>
                        </p>

                        <Field
                          label={
                            "Cantidad · " + unit(line.baseUnit, "2")
                          }
                          value={amount}
                          onChange={(value) =>
                            setActual((previous) => ({
                              ...previous,
                              [line.inventoryItemId]: value,
                            }))
                          }
                          decimal
                        />

                        {"costAllocationPercentage" in line && (
                          <div>
                            <p className="text-xs text-muted">
                              Costo %
                            </p>
                            <p>
                              {percentage(
                                line.costAllocationPercentage
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      <p className="text-xs leading-6 text-muted">
                        Planificada:{" "}
                        {quantity(
                          line.plannedQuantity,
                          line.baseUnit
                        )}{" "}
                        · Diferencia:{" "}
                        {valid
                          ? quantity(
                              subtract(amount, line.plannedQuantity),
                              line.baseUnit
                            )
                          : "—"}{" "}
                        ·{" "}
                        {group === "inputs"
                          ? "Disponible"
                          : "Existencia actual"}
                        :{" "}
                        {balance
                          ? quantity(
                              balance.currentStock,
                              line.baseUnit
                            )
                          : "Se validará al confirmar"}{" "}
                        · Costo promedio:{" "}
                        {balance
                          ? cost(
                              balance.averageUnitCost,
                              line.baseUnit,
                              c.currency
                            )
                          : "Sin valoración"}
                        {group === "inputs" ? (
                          <>
                            {" "}
                            · Costo consumido estimado:{" "}
                            {cash(
                              preview?.inputs.find(
                                (row) =>
                                  row.id === line.inventoryItemId
                              )?.actual ?? null,
                              c.currency
                            )}
                          </>
                        ) : (
                          <>
                            {" "}
                            · Costo asignado estimado:{" "}
                            {cash(
                              outputCost?.value ?? null,
                              c.currency
                            )}{" "}
                            · Costo unitario resultante estimado:{" "}
                            {cost(
                              outputCost?.unitCost ?? null,
                              line.baseUnit,
                              c.currency
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        ))}

      {step === 2 && (
        <>
          {isWaste && <p>Motivo: {reason}</p>}

          <Records
            label="Revisión antes de confirmar"
            rows={reviewRows}
          />

          <Metrics
            rows={
              isWaste
                ? [
                    {
                      label: "Costo estimado del desperdicio",
                      value: cash(wasteTotal, c.currency),
                    },
                  ]
                : [
                    {
                      label: "Costo estimado de insumos",
                      value: cash(preview?.total ?? null, c.currency),
                    },
                    {
                      label: "Costo esperado al promedio actual",
                      value: cash(
                        preview?.expected ?? null,
                        c.currency
                      ),
                    },
                    {
                      label: "Variación estimada de costo",
                      value: cash(
                        preview?.difference ?? null,
                        c.currency
                      ),
                    },
                    {
                      label: "Desperdicio registrado por separado",
                      value: cash(
                        c.data.performance.summary.declaredWasteCost,
                        c.currency
                      ),
                    },
                    {
                      label:
                        "Valor estimado que ingresa a inventario",
                      value: cash(preview?.total ?? null, c.currency),
                    },
                  ]
            }
          />

          {!isWaste && (
            <Records
              label="Rendimiento por producto"
              rows={order.outputs.map((line) => ({
                id: line.inventoryItemId,
                fields: [
                  {
                    label: "Producto obtenido",
                    value: line.inventoryItemName,
                  },
                  {
                    label: "Rendimiento",
                    value: percentage(
                      divide(
                        multiply(actual[line.inventoryItemId], "100"),
                        line.plannedQuantity
                      )
                    ),
                  },
                ],
              }))}
            />
          )}

          <Notice>
            Los costos mostrados son estimaciones. La API usa el stock
            y el costo vigente al confirmar.
          </Notice>

          <Warning>
            {isWaste
              ? "Este desperdicio afectará inmediatamente las existencias y su valor."
              : "Se descontarán los insumos reales y se ingresarán los productos obtenidos. El desperdicio se registra por separado."}{" "}
            Una vez confirmada, esta operación no se puede deshacer
            desde esta pantalla.
          </Warning>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="size-5 accent-orange-500"
            />
            Confirmo las cantidades y la aplicación al inventario.
          </label>
        </>
      )}
    </Frame>
  );
}

function ProductionOrderDetail({
  data,
  currency,
  zone,
  movement = false,
}: {
  data: OrderResources;
  currency: string;
  zone: string;
  movement?: boolean;
}) {
  const { order, performance, waste } = data;

  const loader = useCallback(
    async (session: AuthSession, signal: AbortSignal) =>
      movement ? getOrderMovement(session, signal, order) : null,
    [movement, order]
  );

  const ledger = useInventoryQuery(
    "order-movement:" + order.id + ":" + movement,
    loader,
    order.version,
    productionRoles
  );

  const metadata = [
    [
      "Responsable",
      order.completedByName ??
        order.startedByName ??
        order.createdByName,
    ],
    ["Fecha prevista", timestamp(order.plannedFor, zone)],
    [
      "Inicio",
      order.startedAt
        ? timestamp(order.startedAt, zone)
        : "No iniciada",
    ],
    [
      "Finalización",
      order.completedAt
        ? timestamp(order.completedAt, zone)
        : "No completada",
    ],
    ["Lotes", order.batchQuantity],
    ["Notas", order.notes || "Sin notas"],
  ];

  const common = (
    line:
      | (typeof performance.inputs)[number]
      | (typeof performance.outputs)[number]
  ) => [
    {
      label: "Artículo / SKU",
      value: (
        <div>
          {line.inventoryItemName}
          <p className="text-xs text-muted">
            {line.inventoryItemSku || "Sin SKU"}
          </p>
        </div>
      ),
    },
    {
      label: "Planificada",
      value: quantity(line.plannedQuantity, line.baseUnit),
    },
    {
      label: "Real",
      value:
        line.actualQuantity === null
          ? "Pendiente"
          : quantity(line.actualQuantity, line.baseUnit),
    },
    {
      label: "Diferencia",
      value:
        line.differenceQuantity === null
          ? "—"
          : quantity(line.differenceQuantity, line.baseUnit),
    },
    {
      label: "Variación",
      value: percentage(line.variationPercentage),
    },
  ];

  return (
    <div className="grid min-w-0 gap-5">
      <p className="text-sm text-muted">
        {order.recipe.code} · {order.recipe.name} · Versión{" "}
        {order.version}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={order.status} />
        <p>
          {order.location.name} · {order.location.code}
        </p>
      </div>

      <dl className="grid gap-4 md:grid-cols-3">
        {metadata.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="m-0 mt-1 text-sm [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {order.status === "CANCELLED" && (
        <Notice>
          Cancelada por {order.cancelledByName || "—"} ·{" "}
          {timestamp(order.cancelledAt, zone)}. Motivo:{" "}
          {order.cancellationReason || "—"}
        </Notice>
      )}

      {movement ? (
        <>
          {ledger.pending && (
            <Notice>Consultando movimiento valorizado…</Notice>
          )}

          {ledger.error && (
            <Notice>
              {ledger.error}{" "}
              <Button variant="secondary" onClick={ledger.refresh}>
                Reintentar
              </Button>
            </Notice>
          )}

          {!ledger.pending && !ledger.error && ledger.data && (
            <>
              <Notice>
                Movimiento M-{ledger.data.id} ·{" "}
                {timestamp(ledger.data.createdAt, zone)} ·{" "}
                {ledger.data.createdByName}
              </Notice>

              <Records
                label="Movimiento valorizado"
                rows={ledger.data.lines.map((line) => ({
                  id: line.id,
                  fields: [
                    {
                      label: "Artículo",
                      value: line.inventoryItemName,
                    },
                    {
                      label: "Dirección",
                      value:
                        line.direction === "IN"
                          ? "Entrada"
                          : "Salida",
                    },
                    {
                      label: "Cantidad",
                      value: quantity(line.quantity, line.baseUnit),
                    },
                    {
                      label: "Costo unitario",
                      value: cost(
                        line.unitCost,
                        line.baseUnit,
                        currency
                      ),
                    },
                    {
                      label: "Valor",
                      value: cash(line.totalCost, currency),
                    },
                    {
                      label: "Saldo anterior",
                      value: quantity(
                        line.balanceBefore,
                        line.baseUnit
                      ),
                    },
                    {
                      label: "Saldo resultante",
                      value: quantity(
                        line.balanceAfter,
                        line.baseUnit
                      ),
                    },
                  ],
                }))}
              />
            </>
          )}
        </>
      ) : (
        <>
          <h3 className="font-semibold">Insumos</h3>

          <Records
            label="Insumos de producción"
            rows={performance.inputs.map((line) => ({
              id: line.inventoryItemId,
              fields: [
                ...common(line),
                {
                  label: "Costo unitario",
                  value: cost(
                    line.actualUnitCost,
                    line.baseUnit,
                    currency
                  ),
                },
                {
                  label: "Costo esperado",
                  value: cash(
                    line.expectedCostAtActualRate,
                    currency
                  ),
                },
                {
                  label: "Costo real",
                  value: cash(line.actualCost, currency),
                },
              ],
            }))}
          />

          <h3 className="font-semibold">Productos obtenidos</h3>

          <Records
            label="Productos obtenidos"
            rows={performance.outputs.map((line) => ({
              id: line.inventoryItemId,
              fields: [
                ...common(line),
                {
                  label: "Rendimiento",
                  value: percentage(line.yieldPercentage),
                },
                {
                  label: "Costo %",
                  value: percentage(line.costAllocationPercentage),
                },
                {
                  label: "Costo unitario resultante",
                  value: cost(
                    line.actualUnitCost,
                    line.baseUnit,
                    currency
                  ),
                },
                {
                  label: "Valor producido",
                  value: cash(line.actualCost, currency),
                },
              ],
            }))}
          />

          <Metrics
            rows={[
              {
                label: "Costo esperado al promedio de ejecución",
                value: cash(
                  performance.summary.expectedInputCostAtActualRate,
                  currency
                ),
              },
              {
                label: "Costo real de insumos",
                value: cash(
                  performance.summary.actualInputCost,
                  currency
                ),
              },
              {
                label: "Variación de costo",
                value: cash(
                  performance.summary.inputCostDifference,
                  currency
                ),
              },
              {
                label: "Desperdicio explícito",
                value: cash(
                  performance.summary.declaredWasteCost,
                  currency
                ),
              },
              {
                label: "Costo total de recursos",
                value: cash(
                  performance.summary.totalResourceCost,
                  currency
                ),
              },
              {
                label: "Valor producido",
                value: cash(
                  performance.summary.producedInventoryValue,
                  currency
                ),
              },
            ]}
          />

          <h3 className="font-semibold">Desperdicios explícitos</h3>

          {!waste.length && (
            <div className="rounded-xl border border-outline p-8 text-center text-muted">
              Sin desperdicios registrados
            </div>
          )}

          <Records
            label="Desperdicios registrados"
            rows={waste.flatMap((record) =>
              record.lines.map((line) => ({
                id: record.id + ":" + line.id,
                fields: [
                  {
                    label: "Artículo / SKU",
                    value:
                      line.inventoryItemName +
                      " · " +
                      (line.inventoryItemSku || "Sin SKU"),
                  },
                  {
                    label: "Cantidad",
                    value: quantity(line.quantity, line.baseUnit),
                  },
                  {
                    label: "Costo",
                    value: cash(line.totalCost, currency),
                  },
                  {
                    label: "Motivo",
                    value: record.reason,
                  },
                  {
                    label: "Notas",
                    value: line.notes || "—",
                  },
                  {
                    label: "Responsable",
                    value: record.recordedByName,
                  },
                  {
                    label: "Fecha",
                    value: timestamp(record.createdAt, zone),
                  },
                  {
                    label: "Movimiento",
                    value: "M-" + record.inventoryMovementId,
                  },
                ],
              }))
            )}
          />

          <section className="grid gap-3 border-t border-outline pt-4 text-sm text-muted">
            <h3 className="font-semibold text-heading">
              Trazabilidad
            </h3>

            <div className="grid gap-3 md:grid-cols-2">
              <p>
                Creada por: {order.createdByName} ·{" "}
                {timestamp(order.createdAt, zone)}
              </p>
              <p>
                Iniciada por: {order.startedByName || "Pendiente"}
              </p>
              <p>
                Completada por: {order.completedByName || "Pendiente"}
              </p>
              <p>
                Movimiento relacionado:{" "}
                {order.inventoryMovementId
                  ? "M-" + order.inventoryMovementId
                  : "Sin aplicar"}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
