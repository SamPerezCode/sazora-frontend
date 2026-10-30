import { useCallback } from "react";
import { Power, PowerOff } from "lucide-react";
import { useAppShell } from "../../../../../../app/layout/shell-context";
import type { AuthSession } from "../../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../../hooks/useInventoryQuery";
import { Button } from "../../../InventoryButton";
import {
  productionRoles,
  isAdmin,
} from "../../utils/production.access";
import {
  getManagedRecipe,
  setRecipeActive,
} from "../../services/recipe.service";
import { useRecipeMutation } from "../../hooks/useRecipeMutation";
import type {
  Recipe,
  RecipeAction,
} from "../../schemas/recipe.schemas";
import { ProductionListState } from "../shared/ProductionListState";
import { RecipeContents } from "./RecipeContents";
import { RecipeForm } from "./RecipeForm";
import { RecipeModal } from "./RecipeModal";

export function RecipeActionDialog({
  id,
  action,
  locationId,
  currency,
  onClose,
  onSaved,
}: {
  id: string;
  action: RecipeAction;
  locationId: string;
  currency: string;
  onClose: () => void;
  onSaved: (recipe: Recipe) => void;
}) {
  const { session } = useAppShell();

  const loader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      getManagedRecipe(current, signal, id),
    [id]
  );

  const query = useInventoryQuery(
    "recipe-detail:" + id,
    loader,
    0,
    productionRoles
  );

  const mutation = useRecipeMutation(onSaved);
  const recipe = query.data;
  const denied = action !== "detail" && !isAdmin(session);

  const ready = !query.pending && !query.error && recipe && !denied;

  const close = () => {
    if (!mutation.busy) onClose();
  };

  if (ready && action === "edit") {
    return (
      <RecipeForm
        recipe={recipe}
        locationId={locationId}
        currency={currency}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  const title =
    action === "status"
      ? recipe?.isActive
        ? "Desactivar receta"
        : "Activar receta"
      : recipe
        ? recipe.code + " · " + recipe.name
        : "Detalle de receta";

  return (
    <RecipeModal
      title={title}
      subtitle={
        action === "status"
          ? "Disponibilidad para nuevas órdenes"
          : recipe
            ? recipe.isActive
              ? "Receta activa"
              : "Receta inactiva"
            : "Insumos y rendimientos estándar"
      }
      busy={mutation.busy}
      onClose={close}
      footer={
        <>
          <Button
            size="compact"
            variant="secondary"
            disabled={mutation.busy}
            onClick={close}
          >
            {action === "status" && !mutation.locked
              ? "Cancelar"
              : "Cerrar"}
          </Button>

          {ready && action === "status" && (
            <Button
              size="compact"
              variant={recipe.isActive ? "danger" : "primary"}
              disabled={mutation.locked}
              loading={mutation.busy}
              onClick={() =>
                void mutation.run((signal) =>
                  setRecipeActive(
                    session,
                    signal,
                    recipe.id,
                    !recipe.isActive
                  )
                )
              }
            >
              {recipe.isActive ? (
                <PowerOff size={16} aria-hidden />
              ) : (
                <Power size={16} aria-hidden />
              )}

              {recipe.isActive
                ? "Desactivar receta"
                : "Activar receta"}
            </Button>
          )}
        </>
      }
    >
      {denied ? (
        <ProductionListState
          state="error"
          message="No tienes permiso para modificar recetas."
        />
      ) : query.pending ? (
        <ProductionListState
          state="loading"
          message="Cargando receta…"
        />
      ) : query.error ? (
        <ProductionListState
          state="error"
          message={query.error}
          onRetry={query.refresh}
        />
      ) : (
        recipe && (
          <div className="grid min-w-0 gap-4">
            {mutation.error && (
              <ProductionListState
                state="error"
                message={mutation.error}
              />
            )}

            {action === "status" ? (
              <>
                <p className="font-semibold">
                  {recipe.code} · {recipe.name}
                </p>

                <p className="text-muted">
                  {recipe.isActive
                    ? "No podrá usarse para nuevas órdenes. Esta acción no modifica órdenes históricas."
                    : "Volverá a estar disponible para nuevas órdenes. Las órdenes históricas no se modificarán."}
                </p>
              </>
            ) : (
              <RecipeContents recipe={recipe} />
            )}
          </div>
        )
      )}
    </RecipeModal>
  );
}
