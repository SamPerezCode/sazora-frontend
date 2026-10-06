import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import type { Product } from "../schemas/product.schema";
import type { ComboComponent } from "../schemas/product-action.schema";
import { formatProductPrice } from "../utils/product-list";

export function ComboComponentsEditor({ products, value, onChange, disabled, ownId }: {
  products: readonly Product[]; value: ComboComponent[]; onChange: (v: ComboComponent[]) => void;
  disabled: boolean; ownId?: string;
}) {
  const [selected, setSelected] = useState("");
  const available = products.filter(p => p.id !== ownId);
  const chosen = available.find(p => p.id === selected);
  return <section className="space-y-3 rounded-xl border border-outline/60 p-3" aria-label="Componentes del combo">
    <p className="text-sm font-semibold text-heading">Componentes del combo</p>
    <SelectField label="Producto" value={selected} disabled={disabled}
      onValueChange={setSelected} options={available.map(p => ({
        value: p.id, label: p.name + (p.isActive ? "" : " · Inactivo"),
      }))} />
    <Button size="sm" variant="secondary" disabled={disabled || !chosen} onClick={() => {
      if (!chosen) return;
      const previous = value.find(i => i.productId === chosen.id);
      onChange(previous
        ? value.map(i => i.productId === chosen.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...value, { productId: chosen.id, quantity: 1 }]);
    }}><Plus size={16} />Agregar componente</Button>
    {!value.length && <p className="text-xs text-muted">Selecciona al menos un producto.</p>}
    {value.map(item => {
      const product = products.find(p => p.id === item.productId);
      return <div key={item.productId} className="space-y-2 border-t border-outline/60 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-heading">{product?.name ?? "Producto no disponible en el catálogo"}</p>
            {product && <p className="text-xs text-muted">{formatProductPrice(product.currentPrice)} por unidad</p>}
          </div>
          <Button size="sm" variant="danger" disabled={disabled}
            aria-label={`Quitar ${product?.name ?? item.productId}`}
            onClick={() => onChange(value.filter(i => i.productId !== item.productId))}>
            <Trash2 size={16} />
          </Button>
        </div>
        <TextField label="Cantidad" type="number" min="0" step="any" value={item.quantity || ""}
          disabled={disabled} required error={item.quantity > 0 ? undefined : "Debe ser mayor que cero."}
          onChange={e => onChange(value.map(i => i.productId === item.productId
            ? { ...i, quantity: Number(e.target.value) } : i))} />
      </div>;
    })}
  </section>;
}
