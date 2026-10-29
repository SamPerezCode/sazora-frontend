import { z } from "zod";
import type { AuthSession } from "../../../auth/types/auth.types";
import { getLocations } from "../../../business/services/organization.service";
import { ApiError } from "../../../../lib/http/client";
import {
  id,
  balancesSchema,
} from "../../schemas/inventory-location.schema";
import {
  assertProduction,
  isAdmin,
  assignedPlant,
  usablePlant,
  plantScope,
} from "./production.access";
import {
  recipeSummarySchema,
  recipeSchema,
  productionItemSchema,
} from "./production.schemas";
import { api } from "./production.api";
import type { CreationKind } from "./production.types";

export async function loadPlants(
  session: AuthSession,
  signal: AbortSignal
) {
  assertProduction(session);

  if (!isAdmin(session)) return [assignedPlant(session)!];

  return (await getLocations(session, signal)).filter(usablePlant);
}

export async function listRecipes(
  session: AuthSession,
  signal: AbortSignal
) {
  const { recipes } = await api(
    session,
    signal,
    "/production-recipes",
    z.object({ recipes: z.array(recipeSummarySchema) })
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

export async function getRecipe(
  session: AuthSession,
  signal: AbortSignal,
  recipeId: string
) {
  const { recipe } = await api(
    session,
    signal,
    "/production-recipes/" + id.parse(recipeId),
    z.object({ recipe: recipeSchema })
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

export async function productionBalances(
  session: AuthSession,
  signal: AbortSignal,
  locationId: string
) {
  const location = plantScope(session, locationId);

  if (!location) throw new Error("Selecciona una planta.");

  const result = await api(
    session,
    signal,
    "/inventory-items/location-balances?locationId=" +
      id.parse(location),
    balancesSchema
  );

  if (result.balances.some((row) => row.location.id !== location)) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Los saldos no corresponden a la planta."
    );
  }

  return result.balances;
}

export async function loadCreationCatalog(
  session: AuthSession,
  signal: AbortSignal,
  kind: CreationKind
) {
  if (kind === "order" && !isAdmin(session)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Solo ADMIN puede crear órdenes."
    );
  }

  const [plants, recipes, result] = await Promise.all([
    loadPlants(session, signal),
    kind === "order"
      ? listRecipes(session, signal)
      : Promise.resolve([]),
    kind === "quick"
      ? api(
          session,
          signal,
          "/inventory-items",
          z.object({ items: z.array(productionItemSchema) })
        )
      : Promise.resolve({ items: [] }),
  ]);

  if (
    result.items.some(
      (item) => item.businessId !== session.business.id
    )
  ) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "El catálogo no corresponde al negocio."
    );
  }

  return {
    plants,
    recipes: recipes.filter((recipe) => recipe.isActive),
    items: result.items.filter((item) => item.isActive),
  };
}
