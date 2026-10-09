import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  estimate,
  readItems,
  units,
} from "../services/inventory-operations";
import {
  createProduction,
  productionInputSchema,
} from "../services/production.service";
import type { Production } from "../services/production.service";
import {
  formatQuantity,
  unitLabels,
} from "../utils/inventory-format";
import { InventoryWriteDialog } from "./InventoryWriteDialog";
import { InventoryLoadError } from "./InventoryStates";
import { ProductionLines } from "./ProductionLines";

function blankLine() {
  return {
    key: crypto.randomUUID(),
    inventoryItemId: "",
    quantity: "",
    notes: "",
  };
}

type Line = ReturnType<typeof blankLine>;
type Group = "inputs" | "outputs";

export function ProductionForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAppShell();

  const resource = useInventoryQuery("production-items", readItems);

  const [draft, setDraft] = useState(() => ({
    notes: "",
    inputs: [blankLine()],
    outputs: [blankLine()],
  }));

  const [review, setReview] = useState(false);
  const [dirty, setDirty] = useState(false);

  const items = resource.data ?? [];
  const validation = productionInputSchema.safeParse(draft);

  const selected = [...draft.inputs, ...draft.outputs];

  const unavailable = selected.some(
    (line) =>
      line.inventoryItemId &&
      !items.some(
        (item) => item.id === line.inventoryItemId && item.isActive
      )
  );

  const insufficient = draft.inputs.some((line) => {
    const item = items.find(
      (value) => value.id === line.inventoryItemId
    );

    const quantity = units(line.quantity);
    const stock = item ? units(item.currentStock) : null;

    return quantity !== null && stock !== null && quantity > stock;
  });

  const valid =
    validation.success &&
    !!resource.data &&
    !resource.pending &&
    !resource.error &&
    !unavailable &&
    !insufficient;

  function update(group: Group, key: string, patch: Partial<Line>) {
    setDirty(true);

    setDraft((previous) => ({
      ...previous,
      [group]: previous[group].map((line) =>
        line.key === key ? { ...line, ...patch } : line
      ),
    }));
  }

  function add(group: Group) {
    if (draft[group].length >= 100) return;

    const line = blankLine();

    setDirty(true);

    setDraft((previous) => ({
      ...previous,
      [group]: [...previous[group], line],
    }));
  }

  function remove(group: Group, key: string) {
    if (draft[group].length <= 1) return;

    setDirty(true);

    setDraft((previous) => ({
      ...previous,
      [group]: previous[group].filter((line) => line.key !== key),
    }));
  }

  const preview: Production["lines"] = [];

  if (validation.success) {
    for (const group of ["inputs", "outputs"] as const) {
      validation.data[group].forEach((line, index) => {
        const item = items.find(
          (value) => value.id === line.inventoryItemId
        );

        const direction = group === "inputs" ? "OUT" : "IN";

        const after =
          item &&
          estimate(item.currentStock, line.quantity, direction);

        if (item && after) {
          preview.push({
            id: group + index,
            inventoryItemId: item.id,
            inventoryItemName: item.name,
            baseUnit: item.baseUnit,
            direction,
            quantity: line.quantity,
            balanceBefore: item.currentStock,
            balanceAfter: after,
            notes: line.notes,
          });
        }
      });
    }
  }

  return (
    <InventoryWriteDialog
      title={review ? "Revisar producción" : "Registrar producción"}
      description="Transforma insumos en productos: salen materias primas y entran los artículos obtenidos."
      className="inv-production-dialog"
      submitLabel={
        review ? "Registrar producción" : "Revisar producción"
      }
      dirty={dirty}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onBack={review ? () => setReview(false) : undefined}
      onBeforeSave={() => {
        if (!review) {
          setReview(true);
          return false;
        }

        return true;
      }}
      onSave={(signal) => createProduction(draft, session, signal)}
    >
      {resource.loading ? (
        <p role="status">Cargando artículos…</p>
      ) : resource.error ? (
        <InventoryLoadError
          message={resource.error}
          status={resource.status}
          busy={resource.pending}
          onRetry={resource.refresh}
        />
      ) : review ? (
        <>
          <p className="inv-note">
            Los saldos son estimados. El servidor verificará las
            existencias al registrar.
          </p>

          <ProductionLines lines={preview} />

          <p>
            <strong>Notas generales:</strong>{" "}
            {draft.notes.trim() || "Sin notas"}
          </p>
        </>
      ) : (
        <>
          <div className="production-columns">
            {(["inputs", "outputs"] as const).map((group) => {
              const direction = group === "inputs" ? "OUT" : "IN";

              return (
                <section
                  className="production-group"
                  data-direction={direction}
                  key={group}
                >
                  <h3>
                    {group === "inputs"
                      ? "↗ Insumos consumidos"
                      : "↙ Productos obtenidos"}
                  </h3>

                  {draft[group].map((line) => {
                    const item = items.find(
                      (value) => value.id === line.inventoryItemId
                    );

                    const after =
                      item &&
                      estimate(
                        item.currentStock,
                        line.quantity,
                        direction
                      );

                    return (
                      <div className="inv-line" key={line.key}>
                        <div className="production-line-fields">
                          <SelectField
                            label={
                              group === "inputs"
                                ? "Insumo"
                                : "Producto obtenido"
                            }
                            hideLabel
                            value={line.inventoryItemId}
                            options={items
                              .filter((value) => value.isActive)
                              .map((value) => ({
                                value: value.id,
                                label: value.name,
                                disabled: selected.some(
                                  (other) =>
                                    other.key !== line.key &&
                                    other.inventoryItemId === value.id
                                ),
                              }))}
                            onValueChange={(inventoryItemId) =>
                              update(group, line.key, {
                                inventoryItemId,
                              })
                            }
                          />

                          <label>
                            <span className="sr-only">Cantidad</span>

                            <input
                              required
                              inputMode="decimal"
                              placeholder="0,000"
                              value={line.quantity}
                              aria-label={
                                "Cantidad de " +
                                (item?.name ?? "artículo")
                              }
                              onChange={(event) =>
                                update(group, line.key, {
                                  quantity: event.target.value,
                                })
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="production-remove"
                            aria-label={
                              "Eliminar línea de " +
                              (item?.name ?? "artículo")
                            }
                            disabled={draft[group].length === 1}
                            onClick={() => remove(group, line.key)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <p className="inv-muted">
                          <span data-direction={direction}>
                            {direction === "OUT"
                              ? "↗ Salida"
                              : "↙ Entrada"}
                          </span>

                          {item ? (
                            <>
                              {" · Stock: "}
                              <strong>
                                {formatQuantity(item.currentStock)}
                              </strong>

                              {" · Resultante: "}
                              <strong>
                                {after ? formatQuantity(after) : "—"}
                              </strong>

                              {" · "}
                              {unitLabels[item.baseUnit]}
                            </>
                          ) : (
                            " · Selecciona un artículo para ver su stock y unidad."
                          )}
                        </p>

                        <label>
                          <span className="sr-only">
                            Nota de la línea
                          </span>

                          <input
                            maxLength={500}
                            value={line.notes}
                            placeholder="Nota de la línea (opcional)"
                            onChange={(event) =>
                              update(group, line.key, {
                                notes: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })}

                  <div className="inventory-buttons">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={draft[group].length >= 100}
                      onClick={() => add(group)}
                    >
                      <Plus size={16} />
                      Agregar línea
                    </Button>

                    <span className="inv-muted">
                      {draft[group].length} de 100 líneas
                    </span>
                  </div>
                </section>
              );
            })}
          </div>

          <label>
            Notas generales
            <textarea
              maxLength={500}
              value={draft.notes}
              placeholder="Opcional"
              onChange={(event) => {
                setDirty(true);

                setDraft((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }));
              }}
            />
          </label>
        </>
      )}

      {dirty && !validation.success && (
        <p className="inv-error" role="alert">
          {validation.error.issues[0]?.message}
        </p>
      )}

      {insufficient && (
        <p className="inv-error" role="alert">
          Un insumo no tiene existencias suficientes para la cantidad
          indicada.
        </p>
      )}

      {unavailable && (
        <p className="inv-error" role="alert">
          Hay artículos inactivos o que ya no están disponibles.
        </p>
      )}
    </InventoryWriteDialog>
  );
}
