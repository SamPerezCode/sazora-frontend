import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  decimal,
  movementSchema,
  units,
} from "./inventory-operations";

const notes = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres.")
  .transform((value) => value || null);

const lineSchema = z.object({
  inventoryItemId: z
    .string()
    .regex(/^[1-9]\d*$/, "Selecciona un artículo."),

  quantity: z
    .string()
    .refine((value) => {
      const quantity = units(value);

      return quantity !== null && quantity > 0n;
    }, "Usa una cantidad mayor que cero, con máximo tres decimales.")
    .transform((value) => decimal(units(value)!)),

  notes,
});

export const productionInputSchema = z
  .object({
    notes,
    inputs: z.array(lineSchema).min(1).max(100),
    outputs: z.array(lineSchema).min(1).max(100),
  })
  .superRefine((data, context) => {
    const ids = new Set<string>();

    for (const group of ["inputs", "outputs"] as const) {
      data[group].forEach((line, index) => {
        if (ids.has(line.inventoryItemId)) {
          context.addIssue({
            code: "custom",
            path: [group, index, "inventoryItemId"],
            message:
              "Un artículo no puede repetirse ni ser insumo y resultado a la vez.",
          });
        }

        ids.add(line.inventoryItemId);
      });
    }
  });

const productionSchema = movementSchema.extend({
  movementType: z.literal("PRODUCTION"),
});

const summarySchema = productionSchema.omit({ lines: true }).extend({
  lineCount: z.number().int().nonnegative(),
});

export type Production = z.infer<typeof productionSchema>;
export type ProductionDraft = z.input<typeof productionInputSchema>;
export type ProductionSummary = z.infer<typeof summarySchema>;

function options(session: AuthSession, signal: AbortSignal) {
  if (!session.authorization.roles.includes("ADMIN")) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes acceso a producción."
    );
  }

  return {
    accessToken: session.accessToken,
    signal,
  };
}

function checked<T extends { businessId: string }>(
  data: T,
  session: AuthSession
) {
  if (data.businessId !== session.business.id) {
    throw new ApiError(
      502,
      "BUSINESS_MISMATCH",
      "La respuesta no corresponde al negocio."
    );
  }

  return data;
}

const responseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    production: productionSchema,
  }),
});

export async function listProduction(
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/production",
    z.object({
      status: z.literal("success"),
      data: z.object({
        production: z.array(summarySchema),
      }),
    }),
    options(session, signal)
  );

  return response.data.production.map((row) => checked(row, session));
}

export async function getProduction(
  id: string,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request(
    "/production/" + encodeURIComponent(id),
    responseSchema,
    options(session, signal)
  );

  const result = checked(response.data.production, session);

  if (result.id !== id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Producción inesperada."
    );
  }

  return result;
}

export async function getProductionPage(
  ids: string[],
  session: AuthSession,
  signal: AbortSignal
) {
  const result: Production[] = [];

  // Solo los detalles de la página visible.
  // Máximo cuatro consultas simultáneas.
  for (let offset = 0; offset < ids.length; offset += 4) {
    signal.throwIfAborted();

    result.push(
      ...(await Promise.all(
        ids
          .slice(offset, offset + 4)
          .map((id) => getProduction(id, session, signal))
      ))
    );
  }

  return result;
}

export async function createProduction(
  draft: ProductionDraft,
  session: AuthSession,
  signal: AbortSignal
) {
  const response = await request("/production", responseSchema, {
    ...options(session, signal),
    method: "POST",
    body: productionInputSchema.parse(draft),
  });

  return checked(response.data.production, session);
}
