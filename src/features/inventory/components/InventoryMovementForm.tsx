import { useRef, useState } from "react";
import {
  Plus,
  RotateCcw,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import type { InventoryItem } from "../schemas/inventory.schema";
import {
  formatQuantity,
  unitLabels,
} from "../utils/inventory-format";
import {
  estimate,
  manualTypes,
  movementInputSchema,
  movementLabels,
  units,
} from "../services/inventory-operations";
import type {
  Direction,
  ManualType,
  MovementInput,
  SavedMovement,
} from "../services/inventory-operations";

const choices = {
  PURCHASE: {
    Icon: ShoppingBasket,
    description: "Solo entradas. No es una orden de compra.",
  },
  ADJUSTMENT: {
    Icon: SlidersHorizontal,
    description: "Entrada o salida. Requiere explicación.",
  },
  WASTE: {
    Icon: Trash2,
    description: "Solo salidas por pérdida o daño.",
  },
  RETURN: {
    Icon: RotateCcw,
    description: "Solo entradas por devolución.",
  },
};

interface Line {
  key: number;
  inventoryItemId: string;
  quantity: string;
  direction: Direction;
  notes: string;
}

export function InventoryMovementForm({
  items,
  initialItemId,
  initialType,
  busy,
  onDirty,
  onCancel,
  onSave,
}: {
  items: InventoryItem[];
  initialItemId?: string;
  initialType?: ManualType;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (body: MovementInput) => void;
}) {
  const nextKey = useRef(1);

  const [step, setStep] = useState(initialType ? 2 : 1);
  const [type, setType] = useState<ManualType>(
    initialType ?? "PURCHASE"
  );
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState("");

  const [lines, setLines] = useState<Line[]>([
    {
      key: 0,
      inventoryItemId: items.some(
        (item) => item.id === initialItemId && item.isActive
      )
        ? initialItemId!
        : "",
      quantity: "",
      direction: "IN",
      notes: "",
    },
  ]);

  const active = items.filter((item) => item.isActive);

  const parsed = movementInputSchema.safeParse({
    movementType: type,
    notes,
    lines,
  });

  const available = lines.every((line) =>
    active.some((item) => item.id === line.inventoryItemId)
  );

  const valid = parsed.success && available;

  function changeLine(key: number, patch: Partial<Line>) {
    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, ...patch } : line
      )
    );

    onDirty(true);
    setValidation("");
  }

  function selectType(value: ManualType) {
    setType(value);

    setLines((previous) =>
      previous.map((line) => ({
        ...line,
        direction:
          value === "WASTE"
            ? "OUT"
            : value === "ADJUSTMENT"
              ? line.direction
              : "IN",
      }))
    );

    onDirty(true);
    setStep(2);
    setValidation("");
  }

  function review() {
    if (!valid) {
      setValidation(
        !parsed.success
          ? (parsed.error.issues[0]?.message ?? "Revisa las líneas.")
          : "Selecciona artículos activos."
      );

      return;
    }

    setValidation("");
    setStep(3);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (busy) return;

        if (step === 2) {
          review();
        } else if (step === 3 && valid && parsed.success) {
          onSave(parsed.data);
        }
      }}
    >
      <div className="inv-dialog-subtitle">
        Paso {step} de 3 ·{" "}
        {step === 1
          ? "Elige el tipo de movimiento."
          : movementLabels[type]}
      </div>

      <fieldset disabled={busy} className="inv-dialog-body">
        {step === 1 ? (
          <div className="inv-movement-types">
            {manualTypes.map((value) => {
              const { Icon, description } = choices[value];

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectType(value)}
                >
                  <span data-danger={value === "WASTE" || undefined}>
                    <Icon size={20} />
                  </span>

                  <div>
                    <strong>{movementLabels[value]}</strong>
                    <p>{description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {type === "ADJUSTMENT" && (
              <p className="inv-note">
                <TriangleAlert size={17} />
                Indica si cada línea es entrada o salida y explica el
                motivo en las notas.
              </p>
            )}

            {type === "WASTE" && (
              <p className="inv-note inv-warning">
                <TriangleAlert size={17} />
                Este movimiento descontará existencias y quedará
                registrado.
              </p>
            )}

            {step === 2 ? (
              <>
                {lines.map((line, index) => {
                  const item = items.find(
                    (value) => value.id === line.inventoryItemId
                  );

                  const after = item
                    ? estimate(
                        item.currentStock,
                        line.quantity,
                        line.direction
                      )
                    : null;

                  const duplicateIds = new Set(
                    lines
                      .filter((value) => value.key !== line.key)
                      .map((value) => value.inventoryItemId)
                  );

                  return (
                    <section
                      className="inv-line"
                      key={line.key}
                      aria-label={`Línea ${index + 1}`}
                    >
                      <div className="inv-line-fields">
                        <SelectField
                          label={`Artículo de la línea ${index + 1}`}
                          hideLabel
                          value={line.inventoryItemId}
                          placeholder="Selecciona un artículo"
                          options={active.map((value) => ({
                            value: value.id,
                            label:
                              value.name +
                              (value.sku ? " · " + value.sku : ""),
                            disabled: duplicateIds.has(value.id),
                          }))}
                          onValueChange={(value) =>
                            changeLine(line.key, {
                              inventoryItemId: value,
                            })
                          }
                        />

                        <label className="inv-quantity">
                          <span className="sr-only">
                            Cantidad de la línea {index + 1}
                          </span>

                          <input
                            inputMode="decimal"
                            placeholder="0.000"
                            value={line.quantity}
                            onChange={(event) =>
                              changeLine(line.key, {
                                quantity: event.target.value,
                              })
                            }
                          />
                        </label>

                        {type === "ADJUSTMENT" && (
                          <SelectField
                            label={`Dirección de la línea ${index + 1}`}
                            hideLabel
                            value={line.direction}
                            options={[
                              {
                                value: "IN",
                                label: "Entrada",
                              },
                              {
                                value: "OUT",
                                label: "Salida",
                              },
                            ]}
                            onValueChange={(value) =>
                              changeLine(line.key, {
                                direction: value as Direction,
                              })
                            }
                          />
                        )}

                        <button
                          type="button"
                          className="inv-remove"
                          aria-label={`Retirar línea ${index + 1}`}
                          onClick={() => {
                            setLines((previous) =>
                              previous.filter(
                                (value) => value.key !== line.key
                              )
                            );
                            onDirty(true);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <p className="inv-line-summary">
                        <strong data-direction={line.direction}>
                          {line.direction === "IN"
                            ? "↙ Entrada"
                            : "↗ Salida"}
                        </strong>

                        <span>
                          Stock actual:{" "}
                          <b>
                            {item
                              ? formatQuantity(item.currentStock)
                              : "—"}
                          </b>
                        </span>

                        <span>
                          Stock estimado:{" "}
                          <b>{after ? formatQuantity(after) : "—"}</b>
                        </span>

                        <span>
                          Unidad:{" "}
                          <b>
                            {item ? unitLabels[item.baseUnit] : "—"}
                          </b>
                        </span>
                      </p>

                      {after && units(after)! < 0n && (
                        <p className="inv-warning">
                          La existencia estimada quedará negativa.
                        </p>
                      )}

                      <label>
                        <span className="sr-only">
                          Nota de la línea {index + 1}
                        </span>

                        <input
                          placeholder="Nota de la línea (opcional)"
                          value={line.notes}
                          maxLength={500}
                          onChange={(event) =>
                            changeLine(line.key, {
                              notes: event.target.value,
                            })
                          }
                        />
                      </label>
                    </section>
                  );
                })}

                <div className="inv-inline">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={lines.length >= 100}
                    onClick={() => {
                      const key = nextKey.current++;

                      setLines((previous) => [
                        ...previous,
                        {
                          key,
                          inventoryItemId: "",
                          quantity: "",
                          notes: "",
                          direction: type === "WASTE" ? "OUT" : "IN",
                        },
                      ]);

                      onDirty(true);
                    }}
                  >
                    <Plus size={16} />
                    Agregar línea
                  </Button>

                  <span className="inv-muted">
                    {lines.length} de 100 líneas
                  </span>
                </div>

                {!active.length && (
                  <p className="inv-warning">
                    No hay artículos activos disponibles.
                  </p>
                )}

                <label>
                  Notas generales{" "}
                  {type === "ADJUSTMENT"
                    ? "* (motivo del ajuste)"
                    : ""}
                  <textarea
                    value={notes}
                    maxLength={500}
                    placeholder={
                      type === "ADJUSTMENT"
                        ? "Ej. Conteo de cierre con diferencia"
                        : "Opcional"
                    }
                    onChange={(event) => {
                      setNotes(event.target.value);
                      onDirty(true);
                    }}
                  />
                </label>

                {validation && (
                  <p className="inv-error" role="alert">
                    {validation}
                  </p>
                )}
              </>
            ) : (
              <>
                <h3>Revisar movimiento</h3>

                <p className="inv-note">
                  Estos saldos son estimados. El servidor calculará
                  las existencias definitivas al registrar.
                </p>

                {lines.map((line) => {
                  const item = items.find(
                    (value) => value.id === line.inventoryItemId
                  )!;

                  const after = estimate(
                    item.currentStock,
                    line.quantity,
                    line.direction
                  )!;

                  const quantity = parsed.success
                    ? parsed.data.lines.find(
                        (value) => value.inventoryItemId === item.id
                      )!.quantity
                    : line.quantity;

                  return (
                    <div className="inv-line" key={line.key}>
                      <strong>{item.name}</strong>

                      <p data-direction={line.direction}>
                        {line.direction === "IN"
                          ? "Entrada"
                          : "Salida"}
                        {" · "}
                        {formatQuantity(quantity)}{" "}
                        {unitLabels[item.baseUnit]}
                      </p>

                      <p>
                        Stock anterior:{" "}
                        {formatQuantity(item.currentStock)}
                        {" → Estimado: "}
                        {formatQuantity(after)}
                      </p>

                      {units(after)! < 0n && (
                        <p className="inv-warning">
                          El saldo estimado es negativo.
                        </p>
                      )}

                      {line.notes.trim() && (
                        <p className="inv-muted">{line.notes}</p>
                      )}
                    </div>
                  );
                })}

                <p>
                  <strong>Notas:</strong>{" "}
                  {notes.trim() || "Sin notas"}
                </p>
              </>
            )}
          </>
        )}
      </fieldset>

      <footer className="inv-dialog-footer">
        {step > 1 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setStep(step === 3 ? 2 : 1)}
          >
            {step === 3 ? "Volver a editar" : "Cambiar tipo"}
          </Button>
        )}

        <Button
          size="sm"
          variant="cancel"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>

        {step === 2 && (
          <Button type="submit" size="sm">
            Revisar movimiento
          </Button>
        )}

        {step === 3 && (
          <Button
            type="submit"
            size="sm"
            loading={busy}
            disabled={!valid}
          >
            Registrar movimiento
          </Button>
        )}
      </footer>
    </form>
  );
}

export function InventoryMovementReceipt({
  movement,
}: {
  movement: SavedMovement;
}) {
  return (
    <div className="inv-dialog-body">
      <p>
        Movimiento #{movement.id}
        {" · "}
        {movementLabels[movement.movementType]}
      </p>

      <p className="inv-muted">
        Registrado por {movement.createdByName}
      </p>

      {movement.lines.map((line) => (
        <div className="inv-line" key={line.id}>
          <strong>{line.inventoryItemName}</strong>

          <p data-direction={line.direction}>
            {line.direction === "IN" ? "Entrada" : "Salida"}
            {" · "}
            {formatQuantity(line.quantity)}{" "}
            {unitLabels[line.baseUnit]}
          </p>

          <p>
            {formatQuantity(line.balanceBefore)}
            {" → "}
            <strong>{formatQuantity(line.balanceAfter)}</strong>
          </p>

          {line.notes && <p className="inv-muted">{line.notes}</p>}
        </div>
      ))}

      {movement.notes && <p>{movement.notes}</p>}
    </div>
  );
}
