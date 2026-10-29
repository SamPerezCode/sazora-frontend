import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppShell } from "../../../../app/layout/shell-context";
import {
  multiply,
  add,
  quantity,
  unit,
  subtract,
  divide,
} from "../../utils/inventory-value";
import { Button } from "../InventoryButton";
import { Choice, Field, Notice } from "../InventoryLocationUI";
import { InventoryResponsiveRecords as Records } from "../InventoryResponsiveRecords";
import {
  positiveQuantity,
  wasteInputSchema,
  completeOrderSchema,
} from "./production.schemas";
import {
  estimate,
  errorText,
  percentage,
  cash,
  cost,
} from "./production.utils";
import { Frame, Warning, Metrics } from "./ProductionUI";
import type { FormContext, Mutation } from "./production.types";

export function ExecutionForm({
  context: c,
  action,
}: {
  context: FormContext;
  action: "complete" | "waste";
}) {
  const { session } = useAppShell();
  const order = c.data.order;
  const lines = [...order.inputs, ...order.outputs];

  const [actual, setActual] = useState<Record<string, string>>(
    Object.fromEntries(
      lines.map((line) => [
        line.inventoryItemId,
        line.plannedQuantity,
      ])
    )
  );
  const [waste, setWaste] = useState([
    {
      key: crypto.randomUUID(),
      inventoryItemId: "",
      quantity: "",
      notes: "",
    },
  ]);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState("");

  const isWaste = action === "waste";
  const validAmounts = lines.every(
    (line) =>
      positiveQuantity.safeParse(actual[line.inventoryItemId]).success
  );
  const preview =
    !isWaste && validAmounts
      ? estimate(order, c.data.balances, actual)
      : null;

  const wasteCosts = waste.map((line) => {
    const balance = c.data.balances?.find(
      (row) => row.inventoryItemId === line.inventoryItemId
    );
    return balance?.valuationStatus === "VALUED" &&
      balance.averageUnitCost !== null &&
      positiveQuantity.safeParse(line.quantity).success
      ? multiply(line.quantity, balance.averageUnitCost)
      : null;
  });

  const wasteTotal = wasteCosts.some((value) => value === null)
    ? null
    : wasteCosts.reduce<string>(
        (sum, value) => add(sum, value!),
        "0"
      );

  function mutation(): Mutation {
    if (isWaste) {
      return {
        action: "waste",
        payload: wasteInputSchema.parse({
          version: order.version,
          reason,
          lines: waste.map(
            ({ inventoryItemId, quantity: value, notes }) => ({
              inventoryItemId,
              quantity: value,
              notes: notes.trim() || null,
            })
          ),
        }),
      };
    }

    return {
      action: "complete",
      payload: completeOrderSchema.parse({
        version: order.version,
        inputs: order.inputs.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: actual[line.inventoryItemId],
        })),
        outputs: order.outputs.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: actual[line.inventoryItemId],
        })),
      }),
    };
  }

  function next() {
    try {
      mutation();
      setValidation("");
      setConfirmed(false);
      setStep(2);
    } catch (error) {
      setValidation(errorText(error));
    }
  }

  const reviewRows = isWaste
    ? (step === 2 ? waste : []).map((line) => {
        const item = lines.find(
          (item) => item.inventoryItemId === line.inventoryItemId
        )!;
        return {
          id: line.key,
          fields: [
            { label: "Artículo", value: item.inventoryItemName },
            {
              label: "Cantidad real",
              value: quantity(line.quantity, item.baseUnit),
            },
            { label: "Asignación", value: "Desperdicio explícito" },
          ],
        };
      })
    : lines.map((line) => ({
        id: line.inventoryItemId,
        fields: [
          { label: "Artículo", value: line.inventoryItemName },
          {
            label: "Cantidad real",
            value: validAmounts
              ? quantity(actual[line.inventoryItemId], line.baseUnit)
              : "—",
          },
          {
            label: "Asignación",
            value:
              "costAllocationPercentage" in line &&
              typeof line.costAllocationPercentage === "string"
                ? percentage(line.costAllocationPercentage)
                : "Consumo",
          },
        ],
      }));

  return (
    <Frame
      context={c}
      title={
        (isWaste ? "Registrar desperdicio · OP-" : "Completar OP-") +
        order.id
      }
      footer={
        <>
          {step === 2 && (
            <Button
              variant="ghost"
              disabled={c.busy}
              onClick={() => {
                setStep(1);
                setConfirmed(false);
              }}
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
            disabled={c.locked || (step === 2 && !confirmed)}
            onClick={() => {
              if (step === 1) {
                next();
              } else {
                try {
                  void c.commit(mutation());
                } catch (error) {
                  setValidation(errorText(error));
                }
              }
            }}
          >
            {step === 1
              ? "Continuar"
              : isWaste
                ? "Registrar desperdicio"
                : "Completar y aplicar al inventario"}
          </Button>
        </>
      }
    >
      {validation && (
        <p
          role="alert"
          className="whitespace-pre-line text-red-600 dark:text-red-400"
        >
          {validation}
        </p>
      )}

      {isWaste && (
        <Warning>
          Las variaciones de consumo o rendimiento no se registran
          automáticamente como desperdicio. Registra únicamente una
          pérdida física identificada.
        </Warning>
      )}

      {step === 1 &&
        (isWaste ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Desperdicios</h3>
              <Button
                variant="ghost"
                disabled={
                  waste.length >= lines.length || waste.length >= 100
                }
                onClick={() =>
                  setWaste((previous) => [
                    ...previous,
                    {
                      key: crypto.randomUUID(),
                      inventoryItemId: "",
                      quantity: "",
                      notes: "",
                    },
                  ])
                }
              >
                <Plus size={16} />
                Agregar línea
              </Button>
            </div>

            {waste.map((line, index) => {
              const item = lines.find(
                (item) =>
                  item.inventoryItemId === line.inventoryItemId
              );
              const balance = c.data.balances?.find(
                (row) => row.inventoryItemId === line.inventoryItemId
              );
              const update = (patch: Partial<typeof line>) =>
                setWaste((previous) =>
                  previous.map((row, position) =>
                    position === index ? { ...row, ...patch } : row
                  )
                );

              return (
                <div
                  key={line.key}
                  className="grid gap-3 border-b border-outline pb-4"
                >
                  <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
                    <Choice
                      label="Artículo"
                      value={line.inventoryItemId}
                      onValueChange={(inventoryItemId) =>
                        update({ inventoryItemId })
                      }
                      options={lines
                        .filter(
                          (item) =>
                            item.inventoryItemId ===
                              line.inventoryItemId ||
                            !waste.some(
                              (row) =>
                                row.inventoryItemId ===
                                item.inventoryItemId
                            )
                        )
                        .map((item) => ({
                          value: item.inventoryItemId,
                          label:
                            item.inventoryItemName +
                            " · " +
                            (item.inventoryItemSku || "Sin SKU") +
                            " · " +
                            unit(item.baseUnit),
                        }))}
                    />
                    <Field
                      label={
                        "Cantidad" +
                        (item ? " · " + unit(item.baseUnit, "2") : "")
                      }
                      value={line.quantity}
                      onChange={(value) =>
                        update({ quantity: value })
                      }
                      decimal
                      placeholder="Ej. 0.100"
                    />
                    <Button
                      variant="ghost"
                      aria-label={"Eliminar línea " + (index + 1)}
                      disabled={waste.length === 1}
                      onClick={() =>
                        setWaste((previous) =>
                          previous.filter(
                            (row) => row.key !== line.key
                          )
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>

                  {item && (
                    <p className="text-xs text-muted">
                      Disponible:{" "}
                      {balance
                        ? quantity(
                            balance.currentStock,
                            item.baseUnit
                          )
                        : "Se validará al confirmar"}
                      {" · "}Costo estimado:{" "}
                      {cash(wasteCosts[index], c.currency)}
                    </p>
                  )}

                  <Field
                    label="Notas de la línea (opcional)"
                    value={line.notes}
                    onChange={(notes) => update({ notes })}
                    maxLength={500}
                    placeholder="Describe la pérdida"
                  />
                </div>
              );
            })}

            <Field
              label="Motivo obligatorio"
              value={reason}
              onChange={setReason}
              maxLength={500}
              placeholder="Explica qué ocurrió"
              multiline
            />
            <p className="text-xs text-muted">
              Responsable: {session.user.fullName}
            </p>
          </>
        ) : (
          <>
            {(["inputs", "outputs"] as const).map((group) => (
              <section key={group} className="grid gap-4">
                <h3 className="font-semibold">
                  {group === "inputs"
                    ? "Insumos"
                    : "Productos obtenidos"}
                </h3>

                {order[group].map((line) => {
                  const balance = c.data.balances?.find(
                    (row) =>
                      row.inventoryItemId === line.inventoryItemId
                  );
                  const amount = actual[line.inventoryItemId];
                  const valid =
                    positiveQuantity.safeParse(amount).success;
                  const outputCost = preview?.outputs.find(
                    (row) => row.id === line.inventoryItemId
                  );

                  return (
                    <div
                      key={line.inventoryItemId}
                      className="grid gap-3 border-b border-outline pb-4"
                    >
                      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_10rem_7rem]">
                        <p>
                          {line.inventoryItemName}
                          <span className="block text-xs text-muted">
                            {line.inventoryItemSku || "Sin SKU"}
                          </span>
                        </p>
                        <Field
                          label={
                            "Cantidad · " + unit(line.baseUnit, "2")
                          }
                          value={amount}
                          onChange={(value) =>
                            setActual((previous) => ({
                              ...previous,
                              [line.inventoryItemId]: value,
                            }))
                          }
                          decimal
                        />
                        {"costAllocationPercentage" in line && (
                          <div>
                            <p className="text-xs text-muted">
                              Costo %
                            </p>
                            <p>
                              {percentage(
                                line.costAllocationPercentage
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      <p className="text-xs leading-6 text-muted">
                        Planificada:{" "}
                        {quantity(
                          line.plannedQuantity,
                          line.baseUnit
                        )}
                        {" · "}Diferencia:{" "}
                        {valid
                          ? quantity(
                              subtract(amount, line.plannedQuantity),
                              line.baseUnit
                            )
                          : "—"}
                        {" · "}
                        {group === "inputs"
                          ? "Disponible"
                          : "Existencia actual"}
                        :{" "}
                        {balance
                          ? quantity(
                              balance.currentStock,
                              line.baseUnit
                            )
                          : "Se validará al confirmar"}
                        {" · "}Costo promedio:{" "}
                        {balance
                          ? cost(
                              balance.averageUnitCost,
                              line.baseUnit,
                              c.currency
                            )
                          : "Sin valoración"}
                        {group === "inputs" ? (
                          <>
                            {" · "}Costo consumido estimado:{" "}
                            {cash(
                              preview?.inputs.find(
                                (row) =>
                                  row.id === line.inventoryItemId
                              )?.actual ?? null,
                              c.currency
                            )}
                          </>
                        ) : (
                          <>
                            {" · "}Costo asignado estimado:{" "}
                            {cash(
                              outputCost?.value ?? null,
                              c.currency
                            )}
                            {" · "}Costo unitario resultante estimado:{" "}
                            {cost(
                              outputCost?.unitCost ?? null,
                              line.baseUnit,
                              c.currency
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        ))}

      {step === 2 && (
        <>
          {isWaste && <p>Motivo: {reason}</p>}
          <Records
            label="Revisión antes de confirmar"
            rows={reviewRows}
          />

          <Metrics
            rows={
              isWaste
                ? [
                    {
                      label: "Costo estimado del desperdicio",
                      value: cash(wasteTotal, c.currency),
                    },
                  ]
                : [
                    {
                      label: "Costo estimado de insumos",
                      value: cash(preview?.total ?? null, c.currency),
                    },
                    {
                      label: "Costo esperado al promedio actual",
                      value: cash(
                        preview?.expected ?? null,
                        c.currency
                      ),
                    },
                    {
                      label: "Variación estimada de costo",
                      value: cash(
                        preview?.difference ?? null,
                        c.currency
                      ),
                    },
                    {
                      label: "Desperdicio registrado por separado",
                      value: cash(
                        c.data.performance.summary.declaredWasteCost,
                        c.currency
                      ),
                    },
                    {
                      label:
                        "Valor estimado que ingresa a inventario",
                      value: cash(preview?.total ?? null, c.currency),
                    },
                  ]
            }
          />

          {!isWaste && (
            <Records
              label="Rendimiento por producto"
              rows={order.outputs.map((line) => ({
                id: line.inventoryItemId,
                fields: [
                  {
                    label: "Producto obtenido",
                    value: line.inventoryItemName,
                  },
                  {
                    label: "Rendimiento",
                    value: percentage(
                      divide(
                        multiply(actual[line.inventoryItemId], "100"),
                        line.plannedQuantity
                      )
                    ),
                  },
                ],
              }))}
            />
          )}

          <Notice>
            Los costos mostrados son estimaciones. La API usa el stock
            y el costo vigente al confirmar.
          </Notice>

          <Warning>
            {isWaste
              ? "Este desperdicio afectará inmediatamente las existencias y su valor."
              : "Se descontarán los insumos reales y se ingresarán los productos obtenidos. El desperdicio se registra por separado."}{" "}
            Una vez confirmada, esta operación no se puede deshacer
            desde esta pantalla.
          </Warning>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="size-5 accent-orange-500"
            />
            Confirmo las cantidades y la aplicación al inventario.
          </label>
        </>
      )}
    </Frame>
  );
}
