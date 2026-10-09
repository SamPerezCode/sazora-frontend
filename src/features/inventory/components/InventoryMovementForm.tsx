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
  mode,
  initialItemId,
  initialType,
  busy,
  onDirty,
  onCancel,
  onSave,
}: {
  items: InventoryItem[];
  mode: "individual" | "general";
  initialItemId?: string;
  initialType?: ManualType;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (body: MovementInput) => void;
}) {
  const individual = mode === "individual";

  const fixedItem = items.find((item) => item.id === initialItemId);

  const nextKey = useRef(1);

  const [step, setStep] = useState(initialType ? 2 : 1);

  const [type, setType] = useState<ManualType>(
    initialType ?? "PURCHASE"
  );

  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState("");

  const [lines, setLines] = useState<Line[]>(() => [
    {
      key: 0,
      inventoryItemId: individual
        ? (initialItemId ?? "")
        : (items.find(
            (item) => item.id === initialItemId && item.isActive
          )?.id ?? ""),
      quantity: "",
      direction: initialType === "WASTE" ? "OUT" : "IN",
      notes: "",
    },
  ]);

  const active = items.filter((item) => item.isActive);

  const scopeValid =
    !individual ||
    (!!initialItemId &&
      lines.length === 1 &&
      lines[0].inventoryItemId === initialItemId);

  const available = lines.every((line) =>
    active.some((item) => item.id === line.inventoryItemId)
  );

  const parsed = movementInputSchema.safeParse({
    movementType: type,
    notes,

    // En modo individual se utiliza únicamente la nota general.
    lines: individual
      ? lines.map((line) => ({
          ...line,
          notes: "",
        }))
      : lines,
  });

  const valid = parsed.success && available && scopeValid;

  const fixedUnavailable =
    individual && (!fixedItem || !fixedItem.isActive);

  function touch() {
    onDirty(true);
    setValidation("");
  }

  function changeLine(
    key: number,
    patch: Partial<Omit<Line, "key">>
  ) {
    if (busy) return;

    if (
      individual &&
      patch.inventoryItemId !== undefined &&
      patch.inventoryItemId !== initialItemId
    ) {
      return;
    }

    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, ...patch } : line
      )
    );

    touch();
  }

  function addLine() {
    if (busy || individual || lines.length >= 100) {
      return;
    }

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

    touch();
  }

  function removeLine(key: number) {
    if (busy || individual || lines.length <= 1) {
      return;
    }

    setLines((previous) =>
      previous.filter((line) => line.key !== key)
    );

    touch();
  }

  function selectType(value: ManualType) {
    if (busy) return;

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

    touch();
    setStep(2);
  }

  function validationMessage() {
    if (!scopeValid) {
      return "Este movimiento debe contener únicamente el artículo seleccionado.";
    }

    if (fixedUnavailable) {
      return "El artículo no está disponible o está inactivo.";
    }

    if (!parsed.success) {
      return parsed.error.issues[0]?.message ?? "Revisa las líneas.";
    }

    if (!available) {
      return "Selecciona artículos activos.";
    }

    return "";
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (busy || step === 1) return;

        if (!valid || !parsed.success) {
          setValidation(validationMessage());
          return;
        }

        setValidation("");

        if (step === 2) {
          setStep(3);
        } else {
          onSave(parsed.data);
        }
      }}
    >
      <div className="inv-dialog-subtitle">
        Paso {step} de 3 ·{" "}
        {step === 1
          ? "Elige el tipo de movimiento."
          : movementLabels[type]}
        {individual && fixedItem && (
          <p>
            Artículo: <strong>{fixedItem.name}</strong>
          </p>
        )}
      </div>

      <fieldset
        disabled={busy || fixedUnavailable}
        className="inv-dialog-body"
      >
        {fixedUnavailable ? (
          <p className="inv-error" role="alert">
            El artículo no está disponible o está inactivo. Cierra el
            modal y actualiza el listado.
          </p>
        ) : step === 1 ? (
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

                {individual
                  ? "Indica si el ajuste es una entrada o una salida y explica el motivo."
                  : "Indica si cada línea es entrada o salida y explica el motivo en las notas."}
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
                      aria-label={
                        individual
                          ? "Artículo del movimiento"
                          : `Línea ${index + 1}`
                      }
                    >
                      <div className="inv-line-fields">
                        {individual ? (
                          <div className="inv-fixed-item">
                            <strong>{fixedItem?.name}</strong>

                            <span>{fixedItem?.sku || "Sin SKU"}</span>
                          </div>
                        ) : (
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
                        )}

                        <label className="inv-quantity">
                          <span className="sr-only">
                            {individual
                              ? "Cantidad"
                              : `Cantidad de la línea ${index + 1}`}
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
                            label={
                              individual
                                ? "Dirección"
                                : `Dirección de la línea ${index + 1}`
                            }
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

                        {!individual && (
                          <button
                            type="button"
                            className="inv-remove"
                            aria-label={`Retirar línea ${index + 1}`}
                            disabled={lines.length <= 1}
                            onClick={() => removeLine(line.key)}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
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

                      {!individual && (
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
                      )}
                    </section>
                  );
                })}

                {!individual && (
                  <div className="inv-inline">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={lines.length >= 100}
                      onClick={addLine}
                    >
                      <Plus size={16} />
                      Agregar línea
                    </Button>

                    <span className="inv-muted">
                      {lines.length} de 100 líneas
                    </span>
                  </div>
                )}

                {!individual && !active.length && (
                  <p className="inv-warning">
                    No hay artículos activos disponibles.
                  </p>
                )}

                <label>
                  {type === "ADJUSTMENT"
                    ? "Motivo del ajuste *"
                    : individual
                      ? "Notas (opcional)"
                      : "Notas generales"}

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
                      touch();
                    }}
                  />
                </label>
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
                  );

                  if (!item) {
                    return (
                      <p className="inv-error" key={line.key}>
                        El artículo ya no está disponible.
                      </p>
                    );
                  }

                  const after = estimate(
                    item.currentStock,
                    line.quantity,
                    line.direction
                  );

                  const quantity = parsed.success
                    ? (parsed.data.lines.find(
                        (value) => value.inventoryItemId === item.id
                      )?.quantity ?? line.quantity)
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
                        {after ? formatQuantity(after) : "—"}
                      </p>

                      {after && units(after)! < 0n && (
                        <p className="inv-warning">
                          El saldo estimado es negativo.
                        </p>
                      )}

                      {!individual && line.notes.trim() && (
                        <p className="inv-muted">{line.notes}</p>
                      )}
                    </div>
                  );
                })}

                <p>
                  <strong>
                    {type === "ADJUSTMENT" ? "Motivo:" : "Notas:"}
                  </strong>{" "}
                  {notes.trim() || "Sin notas"}
                </p>
              </>
            )}
          </>
        )}

        {validation && (
          <p className="inv-error" role="alert">
            {validation}
          </p>
        )}
      </fieldset>

      <footer className="inv-dialog-footer">
        {step > 1 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setValidation("");
              setStep(step === 3 ? 2 : 1);
            }}
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
          <Button
            type="submit"
            size="sm"
            disabled={busy || fixedUnavailable}
          >
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
