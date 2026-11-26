import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { ApiError } from "../../../lib/http/client";

import { Toggle } from "../../../components/forms/Toggle";
import { TextField } from "../../../components/forms/TextField";

import { hasPermission } from "../../auth/utils/permissions";

import type { InventoryWorkspace } from "../services/inventory-location.service";

import type {
  ConsumptionLink,
  loadProducts,
} from "../services/inventory-workspace";

import { compositionSchema } from "../schemas/inventory-composition.schema";
import type { CompositionInput } from "../schemas/inventory-composition.schema";

import { saveComposition } from "../services/inventory-composition.service";
import { unitLabels } from "../utils/inventory-format";

import { Button } from "./InventoryButton";
import { Choice, Notice } from "./InventoryLocationUI";
import { InventoryWriteDialog } from "./InventoryWriteDialog";

type Row = CompositionInput["items"][number] & {
  key: string;
};

type Props = {
  productId?: string;
  initialProductId: string;
  products: Awaited<ReturnType<typeof loadProducts>>;
  links: ConsumptionLink[];
  items: InventoryWorkspace["items"];
  ready: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function InventoryCompositionDialog({
  productId,
  initialProductId,
  products,
  links,
  items,
  ready,
  onClose,
  onSaved,
}: Props) {
  const { session } = useAppShell();

  function rowsFor(id: string): Row[] {
    return links
      .filter((link) => link.productId === id && link.isActive)
      .map((link) => ({
        key: crypto.randomUUID(),
        inventoryItemId: link.inventoryItemId,
        quantityPerProduct: link.quantityPerProduct,
        autoDeduct: link.autoDeduct,
      }));
  }

  const [initial] = useState(() => {
    const id = productId ?? initialProductId;

    return {
      productId: id,
      rows: rowsFor(id),
    };
  });

  const [draft, setDraft] = useState(initial);
  const [confirmedEmpty, setConfirmedEmpty] = useState(false);

  const [serverErrors, setServerErrors] = useState<
    Record<string, string>
  >({});

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const product = products.find(
    (value) => value.id === draft.productId
  );

  const parsed = compositionSchema.safeParse({
    items: draft.rows,
  });

  const errors: Record<string, string> = {
    ...serverErrors,
  };

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".")] ??= issue.message;
    }
  }

  const available = draft.rows.every((row) =>
    items.some(
      (item) => item.id === row.inventoryItemId && item.isActive
    )
  );

  const valid =
    ready &&
    hasPermission(session, "inventory.links.manage") &&
    !!product?.isActive &&
    !product.isCombo &&
    parsed.success &&
    available &&
    (draft.rows.length > 0 || confirmedEmpty);

  function updateRows(rows: Row[]) {
    setDraft((previous) => ({
      ...previous,
      rows,
    }));

    setServerErrors({});
    setConfirmedEmpty(false);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    updateRows(
      draft.rows.map((row) =>
        row.key === key ? { ...row, ...patch } : row
      )
    );
  }

  const productOptions = products
    .filter((value) => value.isActive && !value.isCombo)
    .map((value) => ({
      value: value.id,
      label: value.name,
    }));

  if (
    product &&
    !productOptions.some((value) => value.value === product.id)
  ) {
    productOptions.push({
      value: product.id,
      label: product.name + " (no disponible)",
    });
  }

  return (
    <InventoryWriteDialog
      title="Configurar consumo del producto"
      description="Define los insumos que consume cada unidad del producto. Las cantidades se expresan en la unidad base de cada artículo."
      submitLabel="Guardar configuración"
      className="inv-composition-dialog"
      dirty={dirty}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onSave={async (signal) => {
        if (!valid) {
          throw new Error("Revisa la composición antes de guardar.");
        }

        setServerErrors({});

        try {
          await saveComposition(
            draft.productId,
            { items: draft.rows },
            session,
            signal
          );
        } catch (cause) {
          if (cause instanceof ApiError) {
            const next: Record<string, string> = {};

            for (const issue of cause.errors) {
              const path = issue.field
                .replace(/\[(\d+)\]/g, ".$1")
                .replace(/^body\./, "");

              next[path] = issue.message;
            }

            setServerErrors(next);
          }

          throw cause;
        }
      }}
    >
      <Choice
        label="Producto *"
        value={draft.productId}
        disabled={productId !== undefined || !ready}
        options={productOptions}
        placeholder="Selecciona un producto"
        error={errors.productId}
        onValueChange={(id) => {
          if (id === draft.productId) return;

          if (
            dirty &&
            !window.confirm(
              "Cambiar de producto descartará el borrador actual. ¿Continuar?"
            )
          ) {
            return;
          }

          setDraft({
            productId: id,
            rows: rowsFor(id),
          });

          setServerErrors({});
          setConfirmedEmpty(false);
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <strong>Insumos</strong>

        <span className="text-sm text-muted">
          {draft.rows.length} / 100
        </span>
      </div>

      {draft.rows.map((row, index) => {
        const item = items.find(
          (value) => value.id === row.inventoryItemId
        );

        const previous = links.find(
          (value) =>
            value.productId === draft.productId &&
            value.inventoryItemId === row.inventoryItemId
        );

        const baseUnit = item?.baseUnit ?? previous?.baseUnit;

        const itemOptions = items
          .filter((value) => value.isActive)
          .map((value) => ({
            value: value.id,
            label: value.name,
            disabled: draft.rows.some(
              (other) =>
                other.key !== row.key &&
                other.inventoryItemId === value.id
            ),
          }));

        if (
          row.inventoryItemId &&
          !itemOptions.some(
            (value) => value.value === row.inventoryItemId
          )
        ) {
          itemOptions.push({
            value: row.inventoryItemId,
            label:
              (item?.name ??
                previous?.inventoryItemName ??
                "Artículo #" + row.inventoryItemId) +
              " (no disponible)",
            disabled: true,
          });
        }

        return (
          <div key={row.key} className="inv-composition-row">
            <Choice
              label="Artículo de inventario *"
              value={row.inventoryItemId}
              options={itemOptions}
              disabled={!ready}
              error={errors["items." + index + ".inventoryItemId"]}
              onValueChange={(inventoryItemId) => {
                updateRow(row.key, { inventoryItemId });
              }}
            />

            <div className="inv-composition-unit">
              <span>Unidad base</span>

              <strong>{baseUnit ? unitLabels[baseUnit] : "—"}</strong>
            </div>

            <TextField
              label="Cantidad por unidad *"
              inputMode="decimal"
              value={row.quantityPerProduct}
              disabled={!ready}
              error={errors["items." + index + ".quantityPerProduct"]}
              onChange={(event) => {
                updateRow(row.key, {
                  quantityPerProduct: event.target.value,
                });
              }}
            />

            <div>
              <Toggle
                label="Descuento automático"
                checked={row.autoDeduct}
                disabled={!ready}
                onChange={(event) => {
                  updateRow(row.key, {
                    autoDeduct: event.target.checked,
                  });
                }}
              />

              {errors["items." + index + ".autoDeduct"] && (
                <p className="inv-error">
                  {errors["items." + index + ".autoDeduct"]}
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              disabled={!ready}
              aria-label={"Quitar insumo " + (index + 1)}
              onClick={() => {
                updateRows(
                  draft.rows.filter((value) => value.key !== row.key)
                );
              }}
            >
              <Trash2 size={18} aria-hidden />
            </Button>

            {row.inventoryItemId && !item?.isActive && (
              <p className="inv-composition-row-warning" role="alert">
                Este artículo no está disponible. Retíralo o
                reactívalo en Inventario antes de guardar.
              </p>
            )}
          </div>
        );
      })}

      <Button
        variant="secondary"
        disabled={
          !ready ||
          !product?.isActive ||
          product.isCombo ||
          draft.rows.length >= 100
        }
        onClick={() => {
          updateRows([
            ...draft.rows,
            {
              key: crypto.randomUUID(),
              inventoryItemId: "",
              quantityPerProduct: "",
              autoDeduct: true,
            },
          ]);
        }}
      >
        <Plus size={16} aria-hidden />
        Agregar insumo
      </Button>

      <p className="inv-note">
        Si la unidad base es gramo, escribe 50 para 50 gramos, no
        0.050.
      </p>

      {draft.productId && (!product?.isActive || product.isCombo) && (
        <Notice>
          El producto no está disponible para este editor. Los combos
          consumen sus componentes.
        </Notice>
      )}

      {!draft.rows.length && (
        <label className="flex items-start gap-2 text-sm">
          <input
            className="mt-0.5 size-4 min-h-0! w-4! shrink-0 p-0!"
            type="checkbox"
            checked={confirmedEmpty}
            disabled={!ready}
            onChange={(event) => {
              setConfirmedEmpty(event.target.checked);
            }}
          />
          Confirmo que quiero guardar sin insumos y desactivar todas
          las relaciones de este producto.
        </label>
      )}

      {errors.items && (
        <p role="alert" className="inv-error">
          {errors.items}
        </p>
      )}

      {!ready && (
        <Notice>Actualizando datos. Espera antes de guardar.</Notice>
      )}

      <Notice>
        La composición se configura para todo el negocio. El
        inventario se descuenta de la ubicación de la orden cuando
        esta se confirma.
      </Notice>
    </InventoryWriteDialog>
  );
}
