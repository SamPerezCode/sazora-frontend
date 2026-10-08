import { useState } from "react";
import { Info, Pencil, Power, SlidersHorizontal } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import type { InventoryItem } from "../schemas/inventory.schema";
import {
  formatQuantity,
  itemTypeLabels,
  stockLabels,
  unitLabels,
} from "../utils/inventory-format";
import { editSchema, units } from "../services/inventory-operations";
import type {
  InventoryLink,
  ItemEdit,
} from "../services/inventory-operations";

export function InventoryItemDetail({
  item,
  links,
  linksError,
  timezone,
  onAction,
}: {
  item: InventoryItem;
  links: InventoryLink[];
  linksError: string;
  timezone: string | null;
  onAction: (action: "edit" | "movement" | "status") => void;
}) {
  const stock = units(item.currentStock) ?? 0n;
  const minimum = units(item.minimumStock) ?? 0n;
  const largest = stock > minimum ? stock : minimum;

  const scale = ((largest > 0n ? largest : 1n) * 5n) / 4n + 1n;

  // Solo convierte el porcentaje visual, no las existencias.
  const percent = (n: bigint) =>
    Number(((n > 0n ? n : 0n) * 10000n) / scale) / 100;

  const date = (value: string) =>
    timezone
      ? new Intl.DateTimeFormat("es-CO", {
          timeZone: timezone,
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(value))
      : new Date(value)
          .toISOString()
          .replace("T", " ")
          .replace(".000Z", " UTC");

  return (
    <>
      <div className="inv-dialog-body">
        <p className="inv-muted">
          {item.sku || "Sin SKU"}
          {" · "}
          {itemTypeLabels[item.itemType]}
          {" · "}
          {unitLabels[item.baseUnit]}
        </p>

        <span className="inv-status">
          {item.isActive ? stockLabels[item.stockStatus] : "Inactivo"}
        </span>

        <h3>Resumen</h3>

        <dl className="inv-summary">
          <div>
            <dt>Stock actual</dt>
            <dd>{formatQuantity(item.currentStock)}</dd>
          </div>

          <div>
            <dt>Stock mínimo</dt>
            <dd>{formatQuantity(item.minimumStock)}</dd>
          </div>
        </dl>

        <div className="inv-stock-meter" aria-hidden="true">
          <span
            style={{ width: percent(stock) + "%" }}
            data-state={item.stockStatus}
          />
          <i style={{ left: percent(minimum) + "%" }} />
        </div>

        <p className="inv-muted">
          La línea marca el mínimo. Unidad:{" "}
          {unitLabels[item.baseUnit]}.
        </p>

        <dl className="inv-summary inv-dates">
          <div>
            <dt>Creado</dt>
            <dd>{date(item.createdAt)}</dd>
          </div>

          <div>
            <dt>Última actualización</dt>
            <dd>{date(item.updatedAt)}</dd>
          </div>
        </dl>

        <h3>Productos relacionados</h3>

        {linksError ? (
          <p className="inv-error" role="alert">
            {linksError}
          </p>
        ) : links.length ? (
          <ul className="inv-related">
            {links.map((link) => (
              <li key={link.id}>
                <strong>{link.productName}</strong>

                <span>
                  {formatQuantity(link.quantityPerProduct)}{" "}
                  {unitLabels[link.baseUnit]} por unidad vendida
                </span>

                <small>
                  {link.isActive
                    ? "Relación activa"
                    : "Relación inactiva"}
                  {" · "}
                  {link.autoDeduct
                    ? "Descuento automático"
                    : "Sin descuento automático"}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inv-muted">
            No hay productos vinculados a este artículo.
          </p>
        )}

        <h3>Movimientos recientes</h3>

        <p className="inv-note">
          El historial por artículo estará disponible próximamente.
        </p>
      </div>

      <footer className="inv-dialog-footer">
        <Button
          size="sm"
          onClick={() => onAction("movement")}
          disabled={!item.isActive}
        >
          <SlidersHorizontal size={16} />
          Registrar movimiento
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAction("edit")}
        >
          <Pencil size={16} />
          Editar información
        </Button>

        <Button
          size="sm"
          variant={item.isActive ? "danger" : "secondary"}
          onClick={() => onAction("status")}
        >
          <Power size={16} />
          {item.isActive ? "Desactivar" : "Activar"}
        </Button>
      </footer>
    </>
  );
}

export function InventoryItemEditor({
  item,
  busy,
  onDirty,
  onCancel,
  onSave,
}: {
  item: InventoryItem;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (body: ItemEdit) => void;
}) {
  const initial = {
    name: item.name,
    sku: item.sku ?? "",
    itemType: item.itemType,
    baseUnit: item.baseUnit,
    minimumStock: item.minimumStock,
  };

  const [draft, setDraft] = useState(initial);
  const result = editSchema.safeParse(draft);

  function update(patch: Partial<typeof draft>) {
    const next = { ...draft, ...patch };

    setDraft(next);

    onDirty(JSON.stringify(next) !== JSON.stringify(initial));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (result.success && !busy) {
          onSave(result.data);
        }
      }}
    >
      <fieldset disabled={busy} className="inv-dialog-body">
        <div className="inv-fields">
          <label className="inv-wide">
            Nombre *
            <input
              value={draft.name}
              maxLength={150}
              required
              onChange={(event) =>
                update({ name: event.target.value })
              }
            />
          </label>

          <label>
            SKU (opcional)
            <input
              value={draft.sku}
              maxLength={50}
              onChange={(event) =>
                update({ sku: event.target.value })
              }
            />
          </label>

          <SelectField
            label="Tipo de artículo"
            value={draft.itemType}
            options={Object.entries(itemTypeLabels).map(
              ([value, label]) => ({ value, label })
            )}
            onValueChange={(value) =>
              update({
                itemType: value as typeof draft.itemType,
              })
            }
          />

          <SelectField
            label="Unidad base"
            value={draft.baseUnit}
            options={Object.entries(unitLabels).map(
              ([value, label]) => ({ value, label })
            )}
            onValueChange={(value) =>
              update({
                baseUnit: value as typeof draft.baseUnit,
              })
            }
          />

          <label>
            Stock actual
            <input
              value={formatQuantity(item.currentStock)}
              disabled
            />
          </label>

          <label>
            Existencia mínima *
            <input
              inputMode="decimal"
              value={draft.minimumStock}
              required
              onChange={(event) =>
                update({
                  minimumStock: event.target.value,
                })
              }
            />
          </label>
        </div>

        {!result.success && (
          <p className="inv-error">
            {result.error.issues[0]?.message}
          </p>
        )}

        <p className="inv-note">
          <Info size={16} />
          Para modificar las existencias utiliza un movimiento de
          ajuste.
        </p>
      </fieldset>

      <footer className="inv-dialog-footer">
        <Button
          variant="cancel"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          size="sm"
          loading={busy}
          disabled={!result.success}
        >
          Guardar cambios
        </Button>
      </footer>
    </form>
  );
}
