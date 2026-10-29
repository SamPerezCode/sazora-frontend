import { Plus, Trash2 } from "lucide-react";

import { Button } from "../InventoryButton";
import { Choice } from "../InventoryLocationUI";

import { fixed, quantity, unit } from "../../utils/inventory-value";

import { positiveQuantity } from "./production.schemas";

import { cash, cost, percentage } from "./production.utils";

import type { ProductionCreateModel } from "./useProductionCreateForm";

export function ProductionQuickLines({
  model,
  currency,
}: {
  model: ProductionCreateModel;
  currency: string;
}) {
  const {
    form,
    pending,
    catalog,
    balances,
    allLines,
    itemFor,
    balanceFor,
    lineCosts,
    outputCosts,
    distribution,
    controlClass,
    addLine,
    removeLine,
    updateLine,
  } = model;

  return (
    <>
      {(["inputs", "outputs"] as const).map((group) => (
        <section key={group} className="grid min-w-0 gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">
              {group === "inputs" ? "Insumos" : "Productos obtenidos"}
            </h3>

            <Button
              size="compact"
              variant="ghost"
              disabled={pending || form[group].length >= 100}
              onClick={() => addLine(group)}
            >
              <Plus size={15} />
              Agregar línea
            </Button>
          </div>

          {form[group].map((line, index) => {
            const item = itemFor(line);
            const balance = balanceFor(line.inventoryItemId);

            const insufficient =
              group === "inputs" &&
              !balances.pending &&
              !balances.error &&
              positiveQuantity.safeParse(line.quantity).success &&
              balance &&
              fixed(line.quantity) > fixed(balance.currentStock);

            return (
              <div
                key={line.key}
                className="grid min-w-0 gap-2 border-b border-outline pb-3"
              >
                <div
                  className={
                    "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 " +
                    (group === "outputs"
                      ? "md:grid-cols-[minmax(0,1fr)_8rem_7rem_2rem]"
                      : "md:grid-cols-[minmax(0,1fr)_8rem_2rem]")
                  }
                >
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <Choice
                      label="Artículo"
                      value={line.inventoryItemId}
                      placeholder="Selecciona un artículo"
                      disabled={catalog.pending}
                      className="[&_.select-field-trigger]:h-9! [&_.select-field-trigger]:min-h-9!"
                      onValueChange={(value) =>
                        updateLine(group, line.key, {
                          inventoryItemId: value,
                        })
                      }
                      options={(catalog.data?.items ?? [])
                        .filter(
                          (row) =>
                            row.id === line.inventoryItemId ||
                            !allLines.some(
                              (other) =>
                                other.inventoryItemId === row.id
                            )
                        )
                        .map((row) => ({
                          value: row.id,
                          label:
                            row.name +
                            " · " +
                            (row.sku || "Sin SKU") +
                            " · " +
                            unit(row.baseUnit),
                        }))}
                    />
                  </div>

                  <label className="grid min-w-0 gap-2">
                    Cantidad
                    {item ? " · " + unit(item.baseUnit, "2") : ""}
                    <input
                      className={controlClass}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(group, line.key, {
                          quantity: event.target.value,
                        })
                      }
                    />
                  </label>

                  {group === "outputs" && (
                    <label className="grid min-w-0 gap-2">
                      Costo %
                      <input
                        className={controlClass}
                        inputMode="decimal"
                        readOnly={form.outputs.length === 1}
                        value={line.costAllocationPercentage}
                        onChange={(event) =>
                          updateLine(group, line.key, {
                            costAllocationPercentage:
                              event.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <Button
                    size="compact"
                    variant="ghost"
                    className="px-2!"
                    disabled={form[group].length === 1}
                    aria-label={
                      "Eliminar " +
                      (group === "inputs"
                        ? "insumo "
                        : "resultado ") +
                      (index + 1)
                    }
                    onClick={() => removeLine(group, line.key)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                {item && (
                  <p className="text-xs leading-5 text-muted">
                    {group === "inputs"
                      ? "Disponible: "
                      : "Existencia actual: "}
                    <strong
                      className={
                        insufficient
                          ? "text-red-600 dark:text-red-400"
                          : "text-heading"
                      }
                    >
                      {balances.pending
                        ? "Consultando…"
                        : balances.error
                          ? "Sin datos"
                          : balance
                            ? quantity(
                                balance.currentStock,
                                item.baseUnit
                              )
                            : "Sin saldo registrado"}
                    </strong>
                    {" · "}Costo promedio:{" "}
                    {balances.pending || balances.error
                      ? "Sin datos"
                      : cost(
                          balance?.averageUnitCost ?? null,
                          item.baseUnit,
                          currency
                        )}
                    {group === "inputs" ? (
                      <>
                        {" · "}Costo consumido estimado:{" "}
                        {cash(lineCosts[index], currency)}
                      </>
                    ) : (
                      <>
                        {" · "}Costo asignado estimado:{" "}
                        {cash(outputCosts[index].value, currency)}
                        {" · "}Costo resultante estimado:{" "}
                        {cost(
                          outputCosts[index].rate,
                          item.baseUnit,
                          currency
                        )}
                      </>
                    )}
                  </p>
                )}

                <label className="grid gap-2 text-xs">
                  Notas de la línea (opcional)
                  <input
                    className={controlClass}
                    maxLength={500}
                    value={line.notes}
                    onChange={(event) =>
                      updateLine(group, line.key, {
                        notes: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            );
          })}
        </section>
      ))}

      <p
        className={
          "text-xs " +
          (distribution !== null &&
          fixed(distribution) === fixed("100")
            ? "text-heading"
            : "text-red-600 dark:text-red-400")
        }
      >
        Distribución:{" "}
        {distribution === null ? "—" : percentage(distribution)} de
        100 %
      </p>
    </>
  );
}
