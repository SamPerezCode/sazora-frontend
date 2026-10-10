import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import type { Product } from "../schemas/product.schema";
import type { ComboComponent } from "../schemas/product-action.schema";
import { formatProductPrice } from "../utils/product-list";

interface ComboComponentsEditorProps {
  products: readonly Product[];
  value: ComboComponent[];
  disabled: boolean;
  ownId?: string;
  onChange: (value: ComboComponent[]) => void;
}

export function ComboComponentsEditor({
  products,
  value,
  disabled,
  ownId,
  onChange,
}: ComboComponentsEditorProps) {
  const [selected, setSelected] = useState("");

  const available = products.filter(
    (product) =>
      product.canBeComboComponent === true && product.id !== ownId
  );

  const chosen = available.find((product) => product.id === selected);

  const selectedComponent = value.find(
    (item) => item.productId === selected
  );

  const canAdd =
    !!chosen &&
    (selectedComponent
      ? Number.isInteger(selectedComponent.quantity) &&
        selectedComponent.quantity >= 1 &&
        selectedComponent.quantity < 10_000
      : value.length < 100);

  function addComponent() {
    if (disabled || !chosen || !canAdd) return;

    const previous = value.find(
      (item) => item.productId === chosen.id
    );

    onChange(
      previous
        ? value.map((item) =>
            item.productId === chosen.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...value, { productId: chosen.id, quantity: 1 }]
    );
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-outline/60 p-3"
      aria-label="Componentes del combo"
    >
      <p className="text-sm font-semibold text-heading">
        Componentes del combo
      </p>

      <SelectField
        label="Producto"
        value={selected}
        disabled={disabled}
        onValueChange={setSelected}
        options={available.map((product) => ({
          value: product.id,
          label: product.name,
        }))}
      />

      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || !canAdd}
        onClick={addComponent}
      >
        <Plus size={16} />
        Agregar componente
      </Button>

      <p className="text-xs text-muted">
        Este combo consume el inventario de sus componentes.
        Selecciona entre 2 y 100 productos diferentes.
      </p>

      {!available.length && (
        <p role="status" className="text-xs text-muted">
          No hay productos habilitados como componentes. Revisa su
          estado y configuración de inventario.
        </p>
      )}

      {value.map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.productId
        );

        const eligible =
          product?.canBeComboComponent === true &&
          item.productId !== ownId;

        const validQuantity =
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 10_000;

        return (
          <div
            key={item.productId}
            className="space-y-2 border-t border-outline/60 pt-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-heading">
                  {product?.name ??
                    "Producto no disponible en el catálogo"}
                </p>

                {product && (
                  <p className="text-xs text-muted">
                    {formatProductPrice(product.currentPrice)} por
                    unidad
                  </p>
                )}
              </div>

              <Button
                size="sm"
                variant="danger"
                disabled={disabled}
                aria-label={`Quitar ${product?.name ?? item.productId}`}
                onClick={() =>
                  onChange(
                    value.filter(
                      (candidate) =>
                        candidate.productId !== item.productId
                    )
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>

            {!eligible && (
              <p role="alert" className="text-xs text-danger">
                Este producto ya no puede ser componente. Retíralo o
                corrige su configuración antes de guardar.
              </p>
            )}

            <TextField
              label="Cantidad"
              type="number"
              min="1"
              max="10000"
              step="1"
              value={item.quantity || ""}
              disabled={disabled}
              required
              error={
                validQuantity
                  ? undefined
                  : "Usa un entero entre 1 y 10.000."
              }
              onChange={(event) =>
                onChange(
                  value.map((candidate) =>
                    candidate.productId === item.productId
                      ? {
                          ...candidate,
                          quantity: Number(event.target.value),
                        }
                      : candidate
                  )
                )
              }
            />
          </div>
        );
      })}
    </section>
  );
}
