import { useRef, useState } from "react";
import { Save } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import type { Category } from "../../categories/schemas/category.schema";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import type { Product } from "../schemas/product.schema";
import { componentsSchema, productEditSchema } from "../schemas/product-action.schema";
import type { CatalogDetail, ComboComponent, ProductEditInput, ProductMutation } from "../schemas/product-action.schema";
import { ComboComponentsEditor } from "./ComboComponentsEditor";
import { ProductImageField } from "./ProductImageField";
import { formatProductPrice } from "../utils/product-list";

export function ProductForm({ original, isCombo: originalIsCombo = false, products, categories, areas, busy, onSave, onCancel }: {
  original?: CatalogDetail; isCombo?: boolean; products: readonly Product[];
  categories: readonly Category[]; areas: readonly PreparationArea[]; busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>; onCancel: () => void;
}) {
  const [isCombo, setIsCombo] = useState(originalIsCombo);
  const [draft, setDraft] = useState({
    name: original?.name ?? "", sku: original?.sku ?? "",
    description: original?.description ?? "", currentPrice: original?.currentPrice ?? "",
    categoryId: original?.categoryId ?? "", preparationAreaId: original?.preparationAreaId ?? "",
    fulfillmentMode: original?.fulfillmentMode ?? "",
  });
  const [components, setComponents] = useState<ComboComponent[]>(
    original?.components?.map(({ productId, quantity }) => ({ productId, quantity })) ?? []
  );
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = useRef(false);
  const parsed = productEditSchema.safeParse(draft);
  const compositionValid = !isCombo || (
    componentsSchema.safeParse(components).success &&
    components.every(c => c.productId !== original?.id && products.some(p => p.id === c.productId))
  );
  const setupValid =
    categories.some(c => c.id === draft.categoryId && (c.isActive || original?.categoryId === c.id)) &&
    areas.some(a => a.id === draft.preparationAreaId && (a.isActive || original?.preparationAreaId === a.id));
  const valid = parsed.success && compositionValid && setupValid;
  function change(key: keyof typeof draft, value: string) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: "" }));
    setMessage("");
  }
  async function submit() {
    if (busy || saving.current || !valid || !parsed.success) return;
    saving.current = true;
    setMessage("");
    setErrors({});
    try {
      if (!original) {
        await onSave({
          kind: "create", isCombo, input: parsed.data,
          ...(isCombo ? { components } : {}),
          ...(file ? { file } : {}),
        });
      } else {
        const input = Object.fromEntries(Object.entries(parsed.data).filter(([key, value]) => {
          const previous = original[key as keyof ProductEditInput];
          return key === "currentPrice"
            ? formatProductPrice(String(value)) !== formatProductPrice(String(previous))
            : value !== previous;
        })) as Partial<ProductEditInput>;
        const normalized = (items: ComboComponent[]) => JSON.stringify(
          [...items].sort((a, b) => a.productId.localeCompare(b.productId))
        );
        const previous = original.components?.map(({ productId, quantity }) => ({ productId, quantity })) ?? [];
        const changed = isCombo && normalized(previous) !== normalized(components);
        if (!Object.keys(input).length && !changed) { onCancel(); return; }
        await onSave({
          kind: "edit", id: original.id, isCombo, input,
          ...(changed ? { components } : {}),
        });
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrors(Object.fromEntries(cause.errors.map(e => [e.field, e.message])));
        if (cause.code === "PRODUCT_SKU_CONFLICT") {
          setErrors(previous => ({ ...previous, sku: cause.message }));
        }
      }
      setMessage(cause instanceof Error ? cause.message : "No pudimos guardar el producto.");
    } finally { saving.current = false; }
  }
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
    {!original && <SelectField label="Tipo de producto" value={isCombo ? "combo" : "normal"}
      onValueChange={v => setIsCombo(v === "combo")} disabled={busy}
      options={[{ value: "normal", label: "Producto normal" }, { value: "combo", label: "Producto combo" }]} />}
    <TextField label="Nombre" placeholder="Ej. Combo desayuno" required maxLength={150}
      value={draft.name} disabled={busy} error={errors.name} onChange={e => change("name", e.target.value)} />
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="SKU (opcional)" placeholder="Ej. DESAYUNO-01" maxLength={50}
        value={draft.sku} disabled={busy} error={errors.sku} onChange={e => change("sku", e.target.value)} />
      <TextField label="Precio" placeholder="Ej. 15000.00" inputMode="decimal" required
        value={draft.currentPrice} disabled={busy} error={errors.currentPrice}
        onChange={e => change("currentPrice", e.target.value)} />
      <SelectField label="Categoría" value={draft.categoryId} required disabled={busy}
        error={errors.categoryId} onValueChange={v => change("categoryId", v)}
        options={categories.filter(c => c.isActive || c.id === original?.categoryId).map(c => ({
          value: c.id, label: c.name + (c.isActive ? "" : " · Inactiva"), disabled: !c.isActive,
        }))} />
      <SelectField label="Área de preparación" value={draft.preparationAreaId} required disabled={busy}
        error={errors.preparationAreaId} onValueChange={v => change("preparationAreaId", v)}
        options={areas.filter(a => a.isActive || a.id === original?.preparationAreaId).map(a => ({
          value: a.id, label: a.name + (a.isActive ? "" : " · Inactiva"), disabled: !a.isActive,
        }))} />
    </div>
    <SelectField label="¿Cómo se atiende este producto?" value={draft.fulfillmentMode}
      required disabled={busy} error={errors.fulfillmentMode}
      onValueChange={v => change("fulfillmentMode", v)}
      options={[
        { value: "PREPARE_TO_ORDER", label: "Preparar después de recibir el pedido" },
        { value: "READY_TO_SERVE", label: "Ya está listo para entregar" },
      ]} />
    <p className="text-xs text-muted">Esta opción define la preparación y entrega. El control de inventario es opcional y se configura después, desde Inventario.</p>
    <TextAreaField label="Descripción (opcional)" placeholder="Describe el producto o la oferta"
      value={draft.description} maxLength={500} disabled={busy} error={errors.description}
      onChange={e => change("description", e.target.value)} />
    {isCombo && <ComboComponentsEditor products={products} value={components}
      ownId={original?.id} onChange={setComponents} disabled={busy} />}
    {!compositionValid && <p className="text-xs text-danger">Agrega componentes existentes con cantidades mayores que cero. El combo no puede incluirse a sí mismo.</p>}
    {!original && <ProductImageField file={file} name={draft.name} disabled={busy} onChange={setFile} />}
    {message && <Alert><p>{message}</p>{Object.entries(errors).filter(([key]) => key.startsWith("components")).map(([key, text]) => <p key={key}>{text}</p>)}</Alert>}
    {!categories.some(c => c.isActive) && <Alert>Necesitas una categoría activa para crear productos.</Alert>}
    {!areas.some(a => a.isActive) && <Alert>Necesitas un área de preparación activa para crear productos.</Alert>}
    <div className="grid grid-cols-2 gap-2 border-t border-outline/60 pt-4">
      <Button size="sm" variant="secondary" disabled={busy} onClick={onCancel}>Cancelar</Button>
      <Button size="sm" type="submit" loading={busy} disabled={!valid || busy}>
        <Save size={16} />Guardar
      </Button>
    </div>
  </form>;
}
