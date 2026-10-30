import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Button } from "../../../InventoryButton";
import { useRecipeForm } from "../../hooks/useRecipeForm";
import type { Recipe } from "../../schemas/recipe.schemas";
import { ProductionListState } from "../shared/ProductionListState";
import { RecipeModal } from "./RecipeModal";
import { RecipeContents } from "./RecipeContents";
import { RecipeLines } from "./RecipeLines";

const control =
  "h-9 w-full min-w-0 rounded-xl border border-outline bg-surface px-3 text-sm text-heading shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function RecipeForm(props: {
  recipe?: Recipe;
  locationId: string;
  currency: string;
  onSaved: (recipe: Recipe) => void;
  onClose: () => void;
}) {
  const m = useRecipeForm(props);
  const { busy, locked, error } = m.mutation;
  const title = props.recipe ? "Editar receta" : "Nueva receta";

  return (
    <RecipeModal
      title={title}
      subtitle="Insumos y rendimientos estándar"
      busy={busy}
      onClose={m.close}
      footer={
        m.discard ? (
          <>
            <Button
              size="compact"
              variant="secondary"
              onClick={() => m.setDiscard(false)}
            >
              Seguir editando
            </Button>

            <Button
              size="compact"
              variant="danger"
              onClick={props.onClose}
            >
              Descartar cambios
            </Button>
          </>
        ) : (
          <>
            {m.review && (
              <Button
                size="compact"
                variant="ghost"
                disabled={busy || locked}
                onClick={() => {
                  m.setReview(null);
                  m.mutation.setError("");
                }}
              >
                <ArrowLeft size={16} aria-hidden />
                Atrás
              </Button>
            )}

            <Button
              size="compact"
              variant="secondary"
              disabled={busy}
              onClick={m.close}
            >
              {locked ? "Cerrar" : "Cancelar"}
            </Button>

            <Button
              size="compact"
              loading={busy}
              disabled={
                locked || m.catalog.pending || !!m.catalog.error
              }
              onClick={() => (m.review ? void m.submit() : m.next())}
            >
              {m.review ? (
                <>
                  <Save size={16} aria-hidden />
                  Guardar receta
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight size={16} aria-hidden />
                </>
              )}
            </Button>
          </>
        )
      }
    >
      {m.discard ? (
        <p>Los cambios sin guardar se perderán.</p>
      ) : (
        <div className="grid min-w-0 gap-5">
          {error && (
            <ProductionListState state="error" message={error} />
          )}

          {m.catalog.pending ? (
            <ProductionListState
              state="loading"
              message="Cargando artículos…"
            />
          ) : m.catalog.error ? (
            <ProductionListState
              state="error"
              message={m.catalog.error}
              onRetry={m.catalog.refresh}
            />
          ) : (
            <fieldset
              disabled={busy || locked}
              className="m-0 grid min-w-0 gap-5 border-0 p-0"
            >
              {m.review ? (
                <>
                  <p className="font-semibold">
                    {m.review.body.code} · {m.review.body.name}
                  </p>

                  <RecipeContents recipe={m.review.recipe} />

                  <p className="rounded-xl border border-outline bg-secondary/30 p-3 text-sm text-muted">
                    Guardar esta receta no modifica las existencias ni
                    las órdenes históricas.
                  </p>
                </>
              ) : (
                <>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <label className="grid min-w-0 gap-2 text-xs">
                      Código
                      <input
                        className={control}
                        maxLength={50}
                        value={m.form.code}
                        onChange={(event) =>
                          m.update({ code: event.target.value })
                        }
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 text-xs">
                      Nombre
                      <input
                        className={control}
                        maxLength={150}
                        value={m.form.name}
                        onChange={(event) =>
                          m.update({ name: event.target.value })
                        }
                      />
                    </label>
                  </div>

                  {m.balances.error && (
                    <ProductionListState
                      state="error"
                      message={
                        "No pudimos consultar saldos y costos. Puedes guardar la receta.\n" +
                        m.balances.error
                      }
                      onRetry={m.balances.refresh}
                    />
                  )}

                  <RecipeLines
                    model={m}
                    currency={props.currency}
                    locationId={props.locationId}
                  />

                  <label className="grid min-w-0 gap-2 text-xs">
                    Notas
                    <input
                      className={control}
                      maxLength={500}
                      value={m.form.notes}
                      onChange={(event) =>
                        m.update({ notes: event.target.value })
                      }
                    />
                  </label>
                </>
              )}
            </fieldset>
          )}
        </div>
      )}
    </RecipeModal>
  );
}
