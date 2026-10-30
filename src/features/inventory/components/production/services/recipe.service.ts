import { z } from "zod";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { ApiError } from "../../../../../lib/http/client";
import { id } from "../../../schemas/inventory-location.schema";
import { isAdmin } from "../utils/production.access";
import { productionItemSchema } from "../schemas/production.schemas";
import {
  managedRecipeSchema,
  managedRecipeSummarySchema,
  recipePayloadSchema,
  type Recipe,
} from "../schemas/recipe.schemas";
import { api } from "./production.api";

function check<T extends { id: string; businessId: string }>(
  session: AuthSession,
  row: T,
  expectedId?: string
): T {
  if (
    row.businessId !== session.business.id ||
    (expectedId && row.id !== expectedId)
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "La receta recibida no corresponde a la consulta."
    );
  }

  return row;
}

function requireAdmin(session: AuthSession) {
  if (!isAdmin(session)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Solo ADMIN puede modificar recetas."
    );
  }
}

export async function listManagedRecipes(
  session: AuthSession,
  signal: AbortSignal
) {
  const { recipes } = await api(
    session,
    signal,
    "/production-recipes",
    z.object({
      recipes: z.array(managedRecipeSummarySchema),
    })
  );

  return recipes.map((row) => check(session, row));
}

export async function getManagedRecipe(
  session: AuthSession,
  signal: AbortSignal,
  recipeId: string
) {
  const { recipe } = await api(
    session,
    signal,
    "/production-recipes/" + id.parse(recipeId),
    z.object({ recipe: managedRecipeSchema })
  );

  return check(session, recipe, recipeId);
}

export async function loadRecipePage(
  session: AuthSession,
  signal: AbortSignal,
  ids: string[]
) {
  const rows: Recipe[] = [];

  for (let offset = 0; offset < ids.length; offset += 4) {
    signal.throwIfAborted();

    rows.push(
      ...(await Promise.all(
        ids
          .slice(offset, offset + 4)
          .map((recipeId) =>
            getManagedRecipe(session, signal, recipeId)
          )
      ))
    );
  }

  return rows;
}

export async function loadRecipeItems(
  session: AuthSession,
  signal: AbortSignal
) {
  requireAdmin(session);

  const { items } = await api(
    session,
    signal,
    "/inventory-items",
    z.object({ items: z.array(productionItemSchema) })
  );

  if (items.some((item) => item.businessId !== session.business.id)) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El catálogo no corresponde al negocio."
    );
  }

  return items;
}

export async function saveRecipe(
  session: AuthSession,
  signal: AbortSignal,
  recipeId: string | null,
  raw: unknown
) {
  requireAdmin(session);

  const body = recipePayloadSchema.parse(raw);

  const { recipe } = await api(
    session,
    signal,
    "/production-recipes" +
      (recipeId ? "/" + id.parse(recipeId) : ""),
    z.object({ recipe: managedRecipeSchema }),
    recipeId ? "PUT" : "POST",
    body
  );

  return check(session, recipe, recipeId ?? undefined);
}

export async function setRecipeActive(
  session: AuthSession,
  signal: AbortSignal,
  recipeId: string,
  isActive: boolean
) {
  requireAdmin(session);

  const { recipe } = await api(
    session,
    signal,
    "/production-recipes/" + id.parse(recipeId) + "/status",
    z.object({ recipe: managedRecipeSchema }),
    "PATCH",
    { isActive }
  );

  return check(session, recipe, recipeId);
}
