import { ArrowLeft, ArrowRight } from "lucide-react";

import { BottomSheet } from "../../../../../../components/layout/BottomSheet";
import { DateField } from "../../../../../../components/forms/DateField";

import { Button } from "../../../InventoryButton";
import { Choice, Notice } from "../../../InventoryLocationUI";
import { InventoryResponsiveRecords as Records } from "../../../InventoryResponsiveRecords";

import { isAdmin } from "../../utils/production.access";
import { cash } from "../../utils/production.utils";

import { Metrics, Warning } from "../shared/ProductionUI";
import { ProductionQuickLines } from "./ProductionQuickLines";
import { ProductionRecipeProjection } from "./ProductionRecipeProjection";
import { useProductionCreateForm } from "../../hooks/useProductionCreateForm";

import type { ProductionCreateProps } from "../../types/production.types";

export function ProductionCreateDialog(props: ProductionCreateProps) {
  const model = useProductionCreateForm(props);

  const {
    session,
    dialogId,
    quick,
    form,
    step,
    discard,
    confirmed,
    busy,
    locked,
    error,
    scroll,
    catalog,
    balances,
    recipeQuery,
    pending,
    readError,
    totalCost,
    update,
    close,
    next,
    submit,
    last,
    controlClass,
    reviewRows,
    top,
    setStep,
    setDiscard,
    setConfirmed,
    setError,
  } = model;

  return (
    <BottomSheet
      id={dialogId}
      open
      variant="modal"
      busy={busy}
      title={
        quick
          ? "Registrar producción rápida"
          : "Nueva orden de producción"
      }
      onClose={close}
      className="w-[calc(100%_-_2rem)]! max-w-[1000px]! max-h-[calc(100dvh_-_2rem)]! overflow-hidden! p-0! [&[open]]:flex [&[open]]:flex-col [&>.bottom-sheet-heading]:m-0 [&>.bottom-sheet-heading]:shrink-0 [&>.bottom-sheet-heading]:px-5 [&>.bottom-sheet-heading]:pt-4 [&>.bottom-sheet-heading]:pb-2 [&>.bottom-sheet-heading_h2]:text-base"
    >
      <p className="shrink-0 border-b border-outline px-5 pb-5 text-xs text-muted">
        {quick
          ? "Transformación inmediata de inventario sin receta"
          : "Paso " +
            step +
            " de 3 · " +
            ["Planificación", "Proyección", "Revisión"][step - 1]}
      </p>

      <div
        ref={scroll}
        className="min-h-0 overflow-y-auto overscroll-contain p-5 text-sm"
      >
        {discard ? (
          <Warning>
            <p>Tienes cambios sin guardar.</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="compact"
                variant="secondary"
                onClick={() => setDiscard(false)}
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
            </div>
          </Warning>
        ) : (
          <div className="grid min-w-0 gap-5">
            {error && (
              <div
                role="alert"
                className="whitespace-pre-line rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </div>
            )}

            {pending && <Notice>Cargando información…</Notice>}

            {readError && (
              <Notice>
                {readError}{" "}
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() => {
                    catalog.refresh();
                    balances.refresh();
                    recipeQuery.refresh();
                  }}
                >
                  Reintentar
                </Button>
              </Notice>
            )}

            <fieldset
              disabled={busy || locked}
              className="m-0 grid min-w-0 gap-5 border-0 p-0"
            >
              {step === 1 && (
                <div
                  className={
                    quick
                      ? "md:w-1/2 md:pr-2"
                      : "grid gap-3 md:grid-cols-2"
                  }
                >
                  <Choice
                    label="Planta"
                    value={form.locationId}
                    disabled={!isAdmin(session) || catalog.pending}
                    placeholder="Selecciona una planta"
                    className="[&_.select-field-trigger]:h-9! [&_.select-field-trigger]:min-h-9!"
                    onValueChange={(value) =>
                      update({ locationId: value })
                    }
                    options={(catalog.data?.plants ?? []).map(
                      (plant) => ({
                        value: plant.id,
                        label: plant.name + " · " + plant.code,
                      })
                    )}
                  />

                  {!quick && (
                    <>
                      <Choice
                        label="Receta"
                        value={form.recipeId}
                        placeholder="Selecciona una receta"
                        className="[&_.select-field-trigger]:h-9! [&_.select-field-trigger]:min-h-9!"
                        onValueChange={(value) =>
                          update({ recipeId: value })
                        }
                        options={(catalog.data?.recipes ?? []).map(
                          (row) => ({
                            value: row.id,
                            label: row.code + " · " + row.name,
                          })
                        )}
                      />

                      <label className="grid gap-2">
                        Cantidad de lotes
                        <input
                          className={controlClass}
                          inputMode="decimal"
                          value={form.batch}
                          onChange={(event) =>
                            update({
                              batch: event.target.value,
                            })
                          }
                        />
                      </label>

                      <DateField
                        label="Fecha prevista"
                        value={form.day}
                        timeZone={props.zone}
                        className="[&_.date-field-trigger]:h-9! [&_.date-field-trigger]:min-h-9!"
                        onValueChange={(value) =>
                          update({ day: value })
                        }
                      />
                    </>
                  )}
                </div>
              )}

              {quick && step === 1 && (
                <ProductionQuickLines
                  model={model}
                  currency={props.currency}
                />
              )}

              {!quick && <ProductionRecipeProjection model={model} />}

              {!quick && step === 3 && (
                <Notice>
                  Planta:{" "}
                  {
                    catalog.data?.plants.find(
                      (plant) => plant.id === form.locationId
                    )?.name
                  }
                  {" · "}Fecha prevista: {form.day || "Sin fecha"}
                  <p>
                    La orden quedará en borrador. No se aplicarán
                    cambios al inventario.
                  </p>
                </Notice>
              )}

              {quick && step === 2 && (
                <>
                  <Records
                    label="Revisión de producción rápida"
                    rows={reviewRows}
                  />

                  <Metrics
                    rows={[
                      {
                        label: "Costo estimado de insumos",
                        value: cash(totalCost, props.currency),
                      },
                      {
                        label:
                          "Valor estimado que ingresa a inventario",
                        value: cash(totalCost, props.currency),
                      },
                    ]}
                  />
                </>
              )}

              <label className="grid gap-2">
                Notas
                <input
                  className={controlClass}
                  maxLength={500}
                  value={form.notes}
                  onChange={(event) =>
                    update({ notes: event.target.value })
                  }
                />
              </label>

              {quick && step === 2 && (
                <>
                  <Warning>
                    Esta producción se aplicará inmediatamente al
                    inventario y no generará una orden de producción.
                    <p>
                      El costo definitivo se calculará al confirmar.
                      Esta operación no puede deshacerse desde esta
                      pantalla.
                    </p>
                  </Warning>

                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-orange-500"
                      checked={confirmed}
                      onChange={(event) =>
                        setConfirmed(event.target.checked)
                      }
                    />
                    Confirmo las cantidades y la aplicación al
                    inventario.
                  </label>
                </>
              )}
            </fieldset>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-outline bg-background px-5 py-3">
        {step > 1 && (
          <Button
            size="compact"
            variant="ghost"
            disabled={busy || discard || locked}
            onClick={() => {
              setStep((value) => value - 1);
              setConfirmed(false);
              setError("");
              top();
            }}
          >
            <ArrowLeft size={16} />
            Atrás
          </Button>
        )}

        <Button
          size="compact"
          variant="secondary"
          disabled={busy}
          onClick={close}
        >
          {locked ? "Cerrar" : "Cancelar"}
        </Button>

        <Button
          size="compact"
          loading={busy}
          disabled={
            discard ||
            locked ||
            pending ||
            !!readError ||
            (quick && last && !confirmed)
          }
          onClick={() => (last ? void submit() : next())}
        >
          {!last ? (
            <>
              Continuar
              <ArrowRight size={16} />
            </>
          ) : quick ? (
            "Confirmar producción rápida"
          ) : (
            "Crear orden en borrador"
          )}
        </Button>
      </footer>
    </BottomSheet>
  );
}
