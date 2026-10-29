import { useState, useCallback } from "react";
import { DateField } from "../../../../components/forms/DateField";
import type { AuthSession } from "../../../auth/types/auth.types";
import { useInventoryQuery } from "../../hooks/useInventoryQuery";
import { loadBalances } from "../../services/inventory-location.service";
import { dayKey } from "../../utils/inventory-format";
import {
  quantity3,
  multiply,
  fixed,
  quantity,
} from "../../utils/inventory-value";
import { Button } from "../InventoryButton";
import { Notice, Choice, Field } from "../InventoryLocationUI";
import { InventoryResponsiveRecords as Records } from "../InventoryResponsiveRecords";
import {
  listRecipes,
  loadPlants,
  getRecipe,
} from "./production.catalog";
import { productionRoles } from "./production.access";
import {
  positiveQuantity,
  editOrderSchema,
} from "./production.schemas";
import {
  plannedISO,
  errorText,
  percentage,
} from "./production.utils";
import { Frame } from "./ProductionUI";
import type { FormContext } from "./production.types";

export function EditOrderForm({
  context: c,
}: {
  context: FormContext;
}) {
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
