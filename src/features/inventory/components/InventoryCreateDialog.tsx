import { useState } from "react";
import { Info } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { InventoryWriteDialog } from "./InventoryWriteDialog";
import {
  createItem,
  newItemSchema,
} from "../services/inventory-workspace";
import {
  itemTypeLabels,
  unitLabels,
} from "../utils/inventory-format";

const initial = {
  name: "",
  sku: "",
  itemType: "",
  baseUnit: "",
  openingQuantity: "0",
  minimumStock: "0",
};

export function InventoryCreateDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAppShell();

  const [draft, setDraft] = useState(initial);

  const validation = newItemSchema.safeParse(draft);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const update = (patch: Partial<typeof initial>) =>
    setDraft((previous) => ({
      ...previous,
      ...patch,
    }));

  return (
    <InventoryWriteDialog
      title="Nuevo artículo"
      description="Materia prima, semielaborado, producto terminado o de reventa."
      submitLabel="Crear artículo"
      dirty={dirty}
      valid={validation.success}
      onClose={onClose}
      onSaved={onSaved}
      onSave={(signal) => {
        if (!validation.success) {
          throw new Error("Revisa los campos del artículo.");
        }

        return createItem(
          {
            ...draft,
            itemType: validation.data.itemType,
            baseUnit: validation.data.baseUnit,
          },
          session,
          signal
        );
      }}
    >
      <div className="inv-fields">
        <label className="inv-wide">
          Nombre *
          <input
            required
            maxLength={150}
            value={draft.name}
            placeholder="Ej. Café Huila"
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>

        <label>
          SKU (opcional)
          <input
            maxLength={50}
            value={draft.sku}
            placeholder="CAFE-HUILA"
            onChange={(event) => update({ sku: event.target.value })}
          />
        </label>

        <SelectField
          label="Tipo de artículo *"
          required
          value={draft.itemType}
          options={Object.entries(itemTypeLabels).map(
            ([value, label]) => ({ value, label })
          )}
          onValueChange={(itemType) => update({ itemType })}
        />

        <SelectField
          label="Unidad base *"
          required
          value={draft.baseUnit}
          options={Object.entries(unitLabels).map(
            ([value, label]) => ({ value, label })
          )}
          onValueChange={(baseUnit) => update({ baseUnit })}
        />

        <label>
          Existencia inicial *
          <input
            required
            inputMode="decimal"
            value={draft.openingQuantity}
            onChange={(event) =>
              update({
                openingQuantity: event.target.value,
              })
            }
          />
        </label>

        <label>
          Existencia mínima *
          <input
            required
            inputMode="decimal"
            value={draft.minimumStock}
            onChange={(event) =>
              update({
                minimumStock: event.target.value,
              })
            }
          />
        </label>
      </div>

      {dirty && !validation.success && (
        <p className="inv-error">
          {validation.error.issues[0]?.message}
        </p>
      )}

      <p className="inv-note">
        <Info size={17} />
        La existencia inicial se registra como movimiento de apertura.
        Después de guardar, utiliza movimientos de inventario para
        modificar el stock.
      </p>
    </InventoryWriteDialog>
  );
}
