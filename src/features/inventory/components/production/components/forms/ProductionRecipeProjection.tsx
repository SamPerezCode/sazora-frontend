import { InventoryResponsiveRecords as Records } from "../../../InventoryResponsiveRecords";

import { formatQuantity } from "../../../../utils/inventory-format";

import { fixed, quantity } from "../../../../utils/inventory-value";

import { percentage } from "../../utils/production.utils";

import type { ProductionCreateModel } from "../../hooks/useProductionCreateForm";

export function ProductionRecipeProjection({
  model,
}: {
  model: ProductionCreateModel;
}) {
  const {
    recipe,
    recipeQuery,
    batchValid,
    form,
    step,
    balances,
    balanceFor,
    planned,
  } = model;

  if (
    !recipe ||
    !batchValid ||
    recipeQuery.pending ||
    recipeQuery.error
  ) {
    return null;
  }

  return (
    <>
      <div className="border-b border-outline pb-3">
        <h3 className="font-semibold">
          {recipe.code} · {recipe.name}
        </h3>

        <p className="mt-1 text-xs text-muted">
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
          const balance = balanceFor(line.inventoryItemId);

          const available =
            !balances.pending && !balances.error && !!balance;

          const enough =
            available &&
            fixed(balance.currentStock) >=
              fixed(planned(line.quantity));

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
              {
                label: "Lotes",
                value: formatQuantity(form.batch),
              },
              {
                label: "Cantidad estimada",
                value: quantity(
                  planned(line.quantity),
                  line.baseUnit
                ),
              },
              {
                label: "Disponible",
                value: balances.pending
                  ? "Consultando…"
                  : balances.error
                    ? "Sin datos"
                    : balance
                      ? quantity(balance.currentStock, line.baseUnit)
                      : "Sin saldo registrado",
              },
              {
                label: "Disponibilidad",
                value: !available ? (
                  "Sin datos"
                ) : (
                  <span
                    className={
                      enough
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-orange-700 dark:text-orange-400"
                    }
                  >
                    {enough ? "Disponible" : "Insuficiente"}
                  </span>
                ),
              },
            ],
          };
        })}
      />

      {step > 1 && (
        <Records
          label="Productos esperados"
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
                value: percentage(line.costAllocationPercentage),
              },
            ],
          }))}
        />
      )}
    </>
  );
}
