import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../../InventoryButton";
import { Choice } from "../../../InventoryLocationUI";
import {
  fixed,
  quantity,
  unit,
} from "../../../../utils/inventory-value";
import { cash, cost, percentage } from "../../utils/production.utils";
import type { RecipeFormModel } from "../../hooks/useRecipeForm";

const control =
  "h-9 w-full min-w-0 rounded-xl border border-outline bg-surface px-3 text-sm text-heading shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 read-only:opacity-60";

export function RecipeLines({
  model: m,
  currency,
  locationId,
}: {
  model: RecipeFormModel;
  currency: string;
  locationId: string;
}) {
  return (
    <>
      {(["inputs", "outputs"] as const).map((group) => (
        <section key={group} className="grid min-w-0 gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {group === "inputs" ? "Insumos" : "Productos obtenidos"}
            </h3>

            <Button
              size="compact"
              variant="ghost"
              disabled={m.form[group].length >= 100}
              onClick={() => m.addLine(group)}
            >
              <Plus size={16} aria-hidden />
              Agregar línea
            </Button>
          </div>

          {m.form[group].map((line, index) => {
            const item = m.itemFor(line);
            const balance = m.balanceFor(line);

            const available =
              !!locationId &&
              !m.balances.pending &&
              !m.balances.error;

            const rate =
              available && balance?.valuationStatus === "VALUED"
                ? balance.averageUnitCost
                : null;

            return (
              <div
                key={line.key}
                className="grid min-w-0 gap-2 border-b border-outline pb-3"
              >
                <div
                  className={
                    "grid items-end gap-3 " +
                    (group === "outputs"
                      ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] md:grid-cols-[minmax(0,1fr)_8rem_7rem_2rem]"
                      : "grid-cols-[minmax(0,1fr)_2rem] md:grid-cols-[minmax(0,1fr)_8rem_2rem]")
                  }
                >
                  <div className="col-span-full min-w-0 md:col-span-1">
                    <Choice
                      label="Artículo"
                      value={line.inventoryItemId}
                      placeholder="Selecciona un artículo"
                      className="[&_.select-field-label]:text-xs! [&_.select-field-trigger]:h-9! [&_.select-field-trigger]:min-h-9!"
                      onValueChange={(value) =>
                        m.updateLine(group, line.key, {
                          inventoryItemId: value,
                        })
                      }
                      options={m.items
                        .filter(
                          (row) =>
                            row.id === line.inventoryItemId ||
                            (row.isActive &&
                              !m.allLines.some(
                                (other) =>
                                  other.inventoryItemId === row.id
                              ))
                        )
                        .map((row) => ({
                          value: row.id,
                          label:
                            row.name +
                            (row.isActive ? "" : " · No disponible"),
                          disabled: !row.isActive,
                        }))}
                    />
                  </div>

                  <label className="grid min-w-0 gap-2 text-xs">
                    Cantidad
                    {item ? " · " + unit(item.baseUnit, "2") : ""}
                    <input
                      className={control}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) =>
                        m.updateLine(group, line.key, {
                          quantity: event.target.value.replace(
                            ",",
                            "."
                          ),
                        })
                      }
                    />
                  </label>

                  {group === "outputs" && (
                    <label className="grid min-w-0 gap-2 text-xs">
                      Costo %
                      <input
                        className={control}
                        inputMode="decimal"
                        value={line.costAllocationPercentage}
                        readOnly={m.form.outputs.length === 1}
                        onChange={(event) =>
                          m.updateLine(group, line.key, {
                            costAllocationPercentage:
                              event.target.value.replace(",", "."),
                          })
                        }
                      />
                    </label>
                  )}

                  <Button
                    size="compact"
                    variant="ghost"
                    className="px-1!"
                    disabled={m.form[group].length === 1}
                    aria-label={
                      "Eliminar " +
                      (group === "inputs"
                        ? "insumo "
                        : "resultado ") +
                      (index + 1)
                    }
                    onClick={() => m.removeLine(group, line.key)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </Button>
                </div>

                {item && (
                  <p className="text-xs leading-5 text-muted">
                    {group === "inputs"
                      ? "Disponible: "
                      : "Existencia actual: "}
                    <strong className="text-heading">
                      {!locationId
                        ? "Selecciona una planta"
                        : m.balances.pending
                          ? "Consultando…"
                          : !available
                            ? "Sin datos"
                            : balance
                              ? quantity(
                                  balance.currentStock,
                                  item.baseUnit
                                )
                              : "Sin saldo registrado"}
                    </strong>
                    {" · "}Costo promedio:{" "}
                    {cost(rate, item.baseUnit, currency)}
                    {group === "inputs" ? (
                      <>
                        {" · "}Costo consumido estimado:{" "}
                        {cash(m.inputCosts[index], currency)}
                      </>
                    ) : (
                      <>
                        {" · "}Costo asignado estimado:{" "}
                        {cash(m.outputCosts[index].value, currency)}
                        {" · "}Costo unitario estimado del lote:{" "}
                        {cost(
                          m.outputCosts[index].rate,
                          item.baseUnit,
                          currency
                        )}
                      </>
                    )}
                  </p>
                )}

                <label className="grid min-w-0 gap-2 text-xs">
                  Notas de la línea (opcional)
                  <input
                    className={control}
                    maxLength={500}
                    value={line.notes}
                    placeholder="Notas de la línea (opcional)"
                    onChange={(event) =>
                      m.updateLine(group, line.key, {
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
          (m.distribution !== null &&
          fixed(m.distribution) === fixed("100")
            ? "text-heading"
            : "text-red-600 dark:text-red-400")
        }
      >
        Distribución:{" "}
        {m.distribution === null ? "—" : percentage(m.distribution)}{" "}
        de 100 %
      </p>
    </>
  );
}
