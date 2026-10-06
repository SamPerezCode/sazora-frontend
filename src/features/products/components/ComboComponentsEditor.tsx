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
    (product) => product.id !== ownId
  );

  const chosen = available.find((product) => product.id === selected);

  function addComponent() {
    if (!chosen) return;

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
          label:
            product.name + (product.isActive ? "" : " · Inactivo"),
        }))}
      />

      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || !chosen}
        onClick={addComponent}
      >
        <Plus size={16} />
        Agregar componente
      </Button>

      {!value.length && (
        <p className="text-xs text-muted">
          Selecciona al menos un producto.
        </p>
      )}

      {value.map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.productId
        );

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
                aria-label={`Quitar ${
                  product?.name ?? item.productId
                }`}
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

            <TextField
              label="Cantidad"
              type="number"
              min="0"
              step="any"
              value={item.quantity || ""}
              disabled={disabled}
              required
              error={
                item.quantity > 0
                  ? undefined
                  : "Debe ser mayor que cero."
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
