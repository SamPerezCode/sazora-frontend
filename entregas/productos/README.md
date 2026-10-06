# Productos: código para aplicar

Los archivos de `src` no se modificaron. Esta entrega contiene 9 archivos nuevos, 8 existentes actualizados y 3 componentes reemplazados para retirar.

## Aplicación

Desde la raíz del proyecto:

```powershell
git apply --check entregas/productos/cambios.patch
git apply entregas/productos/cambios.patch
npm run typecheck
npm run lint
```

Ejecuta el segundo comando solamente si el primero no reporta conflictos.
No apliques el parche además de copiar manualmente los archivos.

Alternativa manual: copia los archivos completos de `archivos/` a sus rutas de destino y retira los tres componentes indicados al final.

## Decisiones de integración

- Productos administra información comercial, cumplimiento e imágenes.
- Normales y combos comparten ProductForm.
- Los combos envían components con JSON.stringify en multipart al crear; no dependemos del soporte JSON opcional.
- Editar composición utiliza PATCH JSON con la composición completa. Las imágenes se cambian mediante su endpoint específico.
- Las mutaciones actualizan detalle y listado. Los filtros y página se mantienen cuando se actualizan los datos.
- Inventario no se configura aquí: desaparecen el formulario y las llamadas a inventory-setup.
- La navegación a Inventario queda preparada con productId e intent. Como el módulo sigue planned y no existe ruta real, se muestra un aviso; no se navega a una ruta inexistente.
- ADMIN se verifica en la página y en el hook. El cliente HTTP compartido envía Bearer y conserva los errores de la API.
- El catálogo carga todas las páginas entregadas por el servidor y reutiliza el paginador local.

## Contrato pendiente de comprobar en la API real

El detalle de combos usa tu último contrato: `data.product.components`, con `productName` y `quantity` numérica.
La versión anterior esperaba `data.combo`. No se recibió todavía la respuesta real solicitada para confirmar el cambio.

Las fechas del detalle son opcionales porque no aparecen en el ejemplo de detalle del combo. Las fechas del listado siguen siendo obligatorias.
Los metadatos operativos de disponibilidad se muestran cuando la API los entrega; no se inventan cuando faltan.

## Estructura de archivos afectados

```text
src/features/products/
├── components/
│   ├── ComboComponentsEditor.tsx      nuevo
│   ├── ProductActions.tsx             existente
│   ├── ProductBadges.tsx              nuevo
│   ├── ProductDetail.tsx              nuevo
│   ├── ProductEditor.tsx              nuevo
│   ├── ProductForm.tsx                nuevo
│   ├── ProductImageField.tsx          nuevo
│   ├── ProductList.tsx                existente
│   ├── ProductStatus.tsx              existente
│   └── ProductStatusConfirmDialog.tsx nuevo
├── hooks/
│   ├── useProductDetail.ts            nuevo
│   └── useProducts.ts                 existente
├── pages/
│   └── ProductsPage.tsx               existente
├── schemas/
│   ├── product-action.schema.ts       existente
│   └── product.schema.ts              existente
├── services/
│   └── product.service.ts             existente
└── utils/
    └── product-inventory.ts           nuevo
```

Se conservan ProductImageForm, los estilos, el paginador y los componentes compartidos.

## Código y cambios por archivo

Cada archivo incluye nombre exacto, ruta de destino, estado y código completo.
Para los existentes, sustituye su contenido completo por la versión indicada.

### ComboComponentsEditor.tsx — Nuevo

Ruta de destino: `src/features/products/components/ComboComponentsEditor.tsx`.

[ComboComponentsEditor.tsx](archivos/src/features/products/components/ComboComponentsEditor.tsx) · [ComboComponentsEditor.tsx:1](archivos/src/features/products/components/ComboComponentsEditor.tsx:1)

```tsx
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

```

### ProductActions.tsx — Existente

Ruta de destino: `src/features/products/components/ProductActions.tsx`.

[ProductActions.tsx](archivos/src/features/products/components/ProductActions.tsx) · [ProductActions.tsx:1](archivos/src/features/products/components/ProductActions.tsx:1)

Agrega Ver detalle, retirada de imagen y navegación a Inventario; mantiene edición y estado. Reemplazo completo:

```tsx
import { Boxes, Eye, ImagePlus, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind } from "../schemas/product-action.schema";

export function ProductActions({ product, disabled, onAction }: {
  product: Product; disabled?: boolean;
  onAction: (kind: ProductActionKind, product: Product) => void;
}) {
  const actions = [
    { id: "detail", label: "Ver detalle", icon: <Eye size={16} />, onSelect: () => onAction("detail", product) },
    { id: "edit", label: "Editar", icon: <Pencil size={16} />, onSelect: () => onAction("edit", product) },
    { id: "image", label: "Cambiar imagen", icon: <ImagePlus size={16} />, onSelect: () => onAction("image", product) },
    ...(product.imageUrl ? [{
      id: "remove-image", label: "Retirar imagen", icon: <Trash2 size={16} />, onSelect: () => onAction("remove-image", product),
    }] : []),
    { id: "inventory", label: product.hasInventory ? "Gestionar en Inventario" : "Configurar en Inventario",
      icon: <Boxes size={16} />, onSelect: () => onAction("inventory", product) },
    { id: "status", label: product.isActive ? "Desactivar" : "Activar",
      icon: product.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />,
      onSelect: () => onAction("status", product) },
  ];
  return <ActionMenu label={`Acciones de ${product.name}`} disabled={disabled} actions={actions} />;
}

```

### ProductBadges.tsx — Nuevo

Ruta de destino: `src/features/products/components/ProductBadges.tsx`.

[ProductBadges.tsx](archivos/src/features/products/components/ProductBadges.tsx) · [ProductBadges.tsx:1](archivos/src/features/products/components/ProductBadges.tsx:1)

```tsx
import type { Product } from "../schemas/product.schema";

const fulfillment = {
  PREPARE_TO_ORDER: "Preparado al momento",
  READY_TO_SERVE: "Listo para entregar",
};
const tracking = {
  NONE: "Sin control de inventario",
  RESALE: "Inventario · Reventa",
  PRODUCTION: "Inventario · Producción",
  COMBO: "Inventario · Combo",
  CUSTOM: "Inventario · Configuración avanzada",
};
const style = "inline-flex rounded-lg bg-secondary/60 px-2 py-1 text-[0.6875rem] text-muted";
export function ProductTypeBadge({ isCombo }: { isCombo: boolean }) {
  return <span className={style}>{isCombo ? "Combo" : "Normal"}</span>;
}
export function FulfillmentModeBadge({ value }: { value: Product["fulfillmentMode"] }) {
  return <span className={style}>{fulfillment[value]}</span>;
}
export function InventoryTrackingBadge({ product }: { product: Product }) {
  return <span className={style}>{product.hasInventory
    ? tracking[product.inventoryTrackingType] : "Sin inventario configurado"}</span>;
}
export function ProductBadges({ product }: { product: Product }) {
  return <div className="mt-2 flex flex-wrap gap-1">
    <ProductTypeBadge isCombo={product.isCombo} />
    <FulfillmentModeBadge value={product.fulfillmentMode} />
    <InventoryTrackingBadge product={product} />
  </div>;
}

```

### ProductDetail.tsx — Nuevo

Ruta de destino: `src/features/products/components/ProductDetail.tsx`.

[ProductDetail.tsx](archivos/src/features/products/components/ProductDetail.tsx) · [ProductDetail.tsx:1](archivos/src/features/products/components/ProductDetail.tsx:1)

```tsx
import { Avatar } from "../../../components/ui/Avatar";
import { resolveFileUrl } from "../../../lib/files";
import type { Product } from "../schemas/product.schema";
import type { CatalogDetail, ProductActionKind } from "../schemas/product-action.schema";
import { ProductBadges } from "./ProductBadges";
import { ProductActions } from "./ProductActions";
import { formatProductPrice } from "../utils/product-list";

export function ProductDetail({ detail, summary, busy, onAction }: {
  detail: CatalogDetail; summary: Product; busy: boolean;
  onAction: (kind: ProductActionKind, product: Product) => void;
}) {
  const product = { ...summary, ...detail };
  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <Avatar name={detail.name} src={resolveFileUrl(detail.imageUrl)} size="xl" />
      <ProductActions product={product} disabled={busy} onAction={onAction} />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-heading">{detail.name}</h3>
      <p className="text-sm text-muted">{detail.sku || "Sin código"}</p>
      <ProductBadges product={product} />
    </div>
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div><dt className="text-muted">Precio</dt><dd className="font-semibold text-heading">{formatProductPrice(detail.currentPrice)}</dd></div>
      <div><dt className="text-muted">Estado</dt><dd>{detail.isActive ? "Activo" : "Inactivo"}</dd></div>
      <div><dt className="text-muted">Categoría</dt><dd>{summary.categoryName}</dd></div>
      <div><dt className="text-muted">Área</dt><dd>{summary.preparationAreaName}</dd></div>
    </dl>
    <p className="whitespace-pre-wrap text-sm text-muted">{detail.description || "Sin descripción."}</p>
    {detail.components && <section className="space-y-2">
      <h4 className="font-semibold text-heading">Componentes guardados</h4>
      <ul className="divide-y divide-outline/40">
        {detail.components.map(item => <li key={item.productId} className="flex justify-between gap-3 py-2 text-sm">
          <span>{item.productName}</span><span>× {item.quantity}</span>
        </li>)}
      </ul>
    </section>}
    <p className="text-xs text-muted">El inventario es opcional. Sus existencias y configuración se administran desde Inventario.</p>
  </section>;
}

```

### ProductEditor.tsx — Nuevo

Ruta de destino: `src/features/products/components/ProductEditor.tsx`.

[ProductEditor.tsx](archivos/src/features/products/components/ProductEditor.tsx) · [ProductEditor.tsx:1](archivos/src/features/products/components/ProductEditor.tsx:1)

```tsx
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind, ProductMutation } from "../schemas/product-action.schema";
import type { Category } from "../../categories/schemas/category.schema";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import { useProductDetail } from "../hooks/useProductDetail";
import { ProductDetail } from "./ProductDetail";
import { ProductForm } from "./ProductForm";

export function ProductEditor({ product, editing, token, products, categories, areas, busy, onSave, onCancel, onAction }: {
  product: Product; editing: boolean; token: string; products: readonly Product[];
  categories: readonly Category[]; areas: readonly PreparationArea[]; busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>; onCancel: () => void;
  onAction: (kind: ProductActionKind, product: Product) => void;
}) {
  const detail = useProductDetail(product.id, product.isCombo, product.businessId, token);
  if (detail.error) return <Alert><p>{detail.error}</p><Button size="sm" variant="secondary" onClick={detail.retry}>Reintentar detalle</Button></Alert>;
  if (!detail.data) return <LoadingState message="Cargando detalle…" />;
  return editing ? <ProductForm original={detail.data} isCombo={product.isCombo}
    products={products} categories={categories} areas={areas} busy={busy} onSave={onSave} onCancel={onCancel} />
    : <ProductDetail detail={detail.data} summary={product} busy={busy} onAction={onAction} />;
}

```

### ProductForm.tsx — Nuevo

Ruta de destino: `src/features/products/components/ProductForm.tsx`.

[ProductForm.tsx](archivos/src/features/products/components/ProductForm.tsx) · [ProductForm.tsx:1](archivos/src/features/products/components/ProductForm.tsx:1)

```tsx
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

```

### ProductImageField.tsx — Nuevo

Ruta de destino: `src/features/products/components/ProductImageField.tsx`.

[ProductImageField.tsx](archivos/src/features/products/components/ProductImageField.tsx) · [ProductImageField.tsx:1](archivos/src/features/products/components/ProductImageField.tsx:1)

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { validateProductImage } from "../services/product.service";

export function ProductImageField({ file, onChange, disabled, name }: {
  file: File | null; onChange: (file: File | null) => void; disabled: boolean; name: string;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);
  return <div className="space-y-2">
    {file && <Avatar name={name} src={preview} size="xl" />}
    <label htmlFor={id} className="block text-sm font-medium text-heading">Imagen opcional</label>
    <div className="relative rounded-xl border border-input-border bg-secondary/30 p-4 focus-within:ring-2 focus-within:ring-accent">
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
        aria-describedby={id + "-help"} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={e => {
          const next = e.currentTarget.files?.[0];
          if (!next) return;
          const message = validateProductImage(next);
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = message ? null : URL.createObjectURL(next);
          setPreview(objectUrl.current);
          setError(message ?? "");
          onChange(message ? null : next);
          if (message) e.currentTarget.value = "";
        }} />
      <div className="flex items-center gap-3 text-sm text-heading">
        <Upload size={20} className="shrink-0 text-accent" />
        <span className="min-w-0 break-words">{file?.name ?? "Seleccionar archivo"}</span>
      </div>
    </div>
    <p id={id + "-help"} className="text-xs text-muted">JPEG, PNG o WebP. Máximo 5 MB.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}

```

### ProductList.tsx — Existente

Ruta de destino: `src/features/products/components/ProductList.tsx`.

[ProductList.tsx](archivos/src/features/products/components/ProductList.tsx) · [ProductList.tsx:1](archivos/src/features/products/components/ProductList.tsx:1)

Agrega badges de tipo, cumplimiento e inventario a la identidad compartida por desktop y móvil, conservando búsqueda, filtros y paginador. Reemplazo completo:

```tsx
import { useId, useState } from "react";
import { Plus, Search } from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { resolveFileUrl } from "../../../lib/files";
import type { Category } from "../../categories/schemas/category.schema";
import type { Product } from "../schemas/product.schema";
import { SelectField } from "../../../components/forms/SelectField";
import { ProductActions } from "./ProductActions";
import type { ProductActionKind } from "../schemas/product-action.schema";
import {
  filterProducts,
  formatProductPrice,
} from "../utils/product-list";
import { ProductStatus } from "./ProductStatus";
import { ProductBadges } from "./ProductBadges";

interface ProductListProps {
  products: readonly Product[];
  categories: readonly Category[];
  disabled: boolean;
  onCreate: () => void;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

function ProductIdentity({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        name={product.name}
        src={resolveFileUrl(product.imageUrl)}
        size="list"
      />

      <div className="min-w-0">
        <p className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
          {product.name}
        </p>

        <p className="mt-1 text-[0.6875rem] text-muted [overflow-wrap:anywhere]">
          {product.sku || "Sin código"}
          
        </p>
        <ProductBadges product={product} />
      </div>
    </div>
  );
}

export function ProductList({
  products,
  categories,
  disabled,
  onCreate,
  onAction,
}: ProductListProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listId = useId();
  const resultId = useId();

  const filtered = filterProducts(products, query, categoryId);

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const hasFilters = query.trim() !== "" || categoryId !== "";

  function clearFilters() {
    setQuery("");
    setCategoryId("");
    setRequestedPage(1);
  }

  return (
    <section className="space-y-4" aria-label="Listado de productos">
      <div className="w-full min-w-0">
        {" "}
        <div className="products-toolbar">
          <div className="products-toolbar-category">
            <SelectField
              label="Categoría"
              value={categoryId}
              describedBy={resultId}
              onValueChange={(value) => {
                setCategoryId(value);
                setRequestedPage(1);
              }}
              options={[
                { value: "", label: "Todas las categorías" },
                ...categories.map((category) => ({
                  value: category.id,
                  label:
                    category.name +
                    (category.isActive ? "" : " (inactiva)"),
                })),
              ]}
            />
          </div>

          <div className="products-toolbar-search">
            <TextField
              type="search"
              label="Buscar productos"
              placeholder="Nombre, código, categoría o área"
              icon={Search}
              value={query}
              aria-controls={listId}
              aria-describedby={resultId}
              onChange={(event) => {
                setQuery(event.target.value);
                setRequestedPage(1);
              }}
            />
          </div>

          <Button
            className="products-toolbar-create whitespace-nowrap"
            disabled={disabled}
            onClick={onCreate}
          >
            <Plus aria-hidden="true" size={14} className="shrink-0" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <p
        id={resultId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-xs text-muted"
      >
        {hasFilters
          ? `${filtered.length} de ${products.length} productos`
          : `${products.length} ${
              products.length === 1 ? "producto" : "productos"
            } · ${categories.length} ${
              categories.length === 1 ? "categoría" : "categorías"
            }`}
      </p>

      <div
        id={listId}
        className="rounded-xl border border-outline/60 bg-surface/50"
      >
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted">
              {products.length === 0
                ? "Todavía no tienes productos registrados."
                : "No encontramos productos con estos filtros."}
            </p>

            {hasFilters && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-4"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Tabla de desktop */}
            <div className="hidden overflow-hidden rounded-xl lg:block">
              <table className="w-full table-fixed text-left">
                <caption className="sr-only">
                  Productos del negocio
                </caption>

                <colgroup>
                  <col className="w-[28%]" />
                  <col />
                  <col />
                  <col className="w-32" />
                  <col className="w-36" />
                  <col className="w-24" />
                </colgroup>

                <thead className="border-b border-outline/60 bg-secondary/30">
                  <tr className="text-[0.6875rem] uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Producto
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Categoría
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Área
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Precio
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-center font-medium"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline/40">
                  {visible.map((product) => (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-secondary/30"
                    >
                      <th
                        scope="row"
                        className="px-4 py-4 font-normal"
                      >
                        <ProductIdentity product={product} />
                      </th>

                      <td className="px-4 py-4 text-xs text-muted [overflow-wrap:anywhere]">
                        {product.categoryName}
                      </td>

                      <td className="px-4 py-4 text-xs text-muted [overflow-wrap:anywhere]">
                        {product.preparationAreaName}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-heading [overflow-wrap:anywhere]">
                        {formatProductPrice(product.currentPrice)}
                      </td>

                      <td className="px-4 py-4">
                        <ProductStatus product={product} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          <ProductActions
                            product={product}
                            disabled={disabled}
                            onAction={onAction}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas de móvil */}
            <ul className="divide-y divide-outline/40 px-3 lg:hidden">
              {visible.map((product) => (
                <li key={product.id} className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <ProductIdentity product={product} />
                    </div>

                    <ProductActions
                      product={product}
                      disabled={disabled}
                      onAction={onAction}
                    />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[0.625rem] uppercase tracking-wide text-muted">
                        Categoría
                      </dt>
                      <dd className="mt-1 text-heading [overflow-wrap:anywhere]">
                        {product.categoryName}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-[0.625rem] uppercase tracking-wide text-muted">
                        Área
                      </dt>
                      <dd className="mt-1 text-heading [overflow-wrap:anywhere]">
                        {product.preparationAreaName}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold tabular-nums text-heading [overflow-wrap:anywhere]">
                      <span className="sr-only">Precio: </span>
                      {formatProductPrice(product.currentPrice)}
                    </p>

                    <ProductStatus product={product} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {products.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={filtered.length === 1 ? "producto" : "productos"}
          controlsId={listId}
          onPageChange={setRequestedPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setRequestedPage(1);
          }}
        />
      )}
    </section>
  );
}

```

### ProductStatus.tsx — Existente

Ruta de destino: `src/features/products/components/ProductStatus.tsx`.

[ProductStatus.tsx](archivos/src/features/products/components/ProductStatus.tsx) · [ProductStatus.tsx:1](archivos/src/features/products/components/ProductStatus.tsx:1)

Distingue Activo de Disponible cuando la API omite disponibilidad; no supone categorías inactivas por ausencia de metadatos. Reemplazo completo:

```tsx
import { CircleCheck, CircleSlash } from "lucide-react";
import type { Product } from "../schemas/product.schema";

export function ProductStatus({ product }: { product: Product }) {
  const label = !product.isActive
    ? "Inactivo"
    : product.isAvailable === undefined
      ? "Activo"
      : product.isAvailable
      ? "Disponible"
      : "No disponible";

  const reason = !product.isActive
    ? "Producto desactivado."
    : [
        product.categoryIsActive === false ? "Categoría desactivada." : "",
        product.preparationAreaIsActive === false ? "Área desactivada." : "",
      ]
        .filter(Boolean)
        .join(" ");

  const Icon = product.isAvailable ? CircleCheck : CircleSlash;

  return (
    <span
      title={reason || label}
      aria-label={reason ? `${label}. ${reason}` : label}
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2 py-1 text-[0.6875rem] font-medium"
    >
      <Icon
        aria-hidden="true"
        size={14}
        className={`shrink-0 ${
          product.isAvailable ? "text-accent" : "text-muted"
        }`}
      />

      <span
        className={
          product.isAvailable ? "text-heading" : "text-muted"
        }
      >
        {label}
      </span>
    </span>
  );
}

```

### ProductStatusConfirmDialog.tsx — Nuevo

Ruta de destino: `src/features/products/components/ProductStatusConfirmDialog.tsx`.

[ProductStatusConfirmDialog.tsx](archivos/src/features/products/components/ProductStatusConfirmDialog.tsx) · [ProductStatusConfirmDialog.tsx:1](archivos/src/features/products/components/ProductStatusConfirmDialog.tsx:1)

```tsx
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import type { Product } from "../schemas/product.schema";
import type { ProductMutation } from "../schemas/product-action.schema";

export function ProductStatusConfirmDialog({ product, kind, busy, onSave, onCancel }: {
  product: Product; kind: "status" | "remove-image"; busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>; onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const removing = kind === "remove-image";
  return <div className="space-y-4">
    <p className="text-sm text-muted">{removing
      ? "Se retirará únicamente la imagen. El producto y su información se conservarán."
      : product.isActive
        ? "Este producto dejará de estar disponible para nuevas órdenes. Su información histórica se conservará."
        : "Se reactivará el producto. Su disponibilidad también depende de su categoría y área."}</p>
    {error && <Alert>{error}</Alert>}
    <div className="grid grid-cols-2 gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={onCancel}>Volver</Button>
      <Button size="sm" variant={removing || product.isActive ? "danger" : "primary"} loading={busy}
        disabled={busy} onClick={() => {
          setError("");
          void onSave(removing ? { kind, id: product.id } : {
            kind: "status", id: product.id, isActive: !product.isActive,
          }).catch(cause => setError(cause instanceof Error ? cause.message : "No pudimos guardar el cambio."));
        }}>
        {removing ? "Retirar imagen" : product.isActive ? "Desactivar" : "Activar"}
      </Button>
    </div>
  </div>;
}

```

### useProductDetail.ts — Nuevo

Ruta de destino: `src/features/products/hooks/useProductDetail.ts`.

[useProductDetail.ts](archivos/src/features/products/hooks/useProductDetail.ts) · [useProductDetail.ts:1](archivos/src/features/products/hooks/useProductDetail.ts:1)

```ts
import { useEffect, useState } from "react";
import { getProductDetail } from "../services/product.service";
import type { CatalogDetail } from "../schemas/product-action.schema";

export function useProductDetail(id: string, isCombo: boolean, businessId: string, token: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: CatalogDetail; error?: string } | null>(null);
  const key = `${businessId}:${id}:${isCombo}:${token}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    void getProductDetail(id, isCombo, token, controller.signal).then(data => {
      if (data.id !== id || data.businessId !== businessId) throw new Error("No pudimos verificar el producto.");
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(cause => {
      if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : "No pudimos cargar el detalle." });
    });
    return () => controller.abort();
  }, [id, isCombo, businessId, token, key]);
  return { data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    retry: () => setAttempt(v => v + 1) };
}

```

### useProducts.ts — Existente

Ruta de destino: `src/features/products/hooks/useProducts.ts`.

[useProducts.ts](archivos/src/features/products/hooks/useProducts.ts) · [useProducts.ts:1](archivos/src/features/products/hooks/useProducts.ts:1)

Actualiza detalle y listado después de cada mutación; mantiene datos ante errores de actualización para conservar filtros y página. Reemplazo completo:

```ts
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { ProductMutation } from "../schemas/product-action.schema";
import { getProductCatalog, getProductDetail, saveProduct } from "../services/product.service";

type Catalog = Awaited<ReturnType<typeof getProductCatalog>>;
type Snapshot = { scope: string; data: Catalog | null; error: string | null };
function verify(data: Catalog, businessId: string) {
  if ([...data.products, ...data.categories, ...data.areas].some(i => i.businessId !== businessId)) {
    throw new ApiError(502, "BUSINESS_MISMATCH", "No pudimos verificar el catálogo.");
  }
  return data;
}
export function useProducts(session: AuthSession) {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const write = useRef<AbortController | null>(null);
  const read = useRef<AbortController | null>(null);
  const { accessToken } = session;
  const businessId = session.business.id;
  const allowed = session.authorization.roles.includes("ADMIN");
  const scope = `${businessId}:${session.membership.id}:${accessToken}`;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    read.current = controller;
    void getProductCatalog(accessToken, controller.signal).then(data => {
      const checked = verify(data, businessId);
      if (!controller.signal.aborted) setSnapshot({ scope, data: checked, error: null });
    }).catch(cause => {
      if (!controller.signal.aborted) setSnapshot(previous => ({
        scope, data: previous?.scope === scope ? previous.data : null,
        error: cause instanceof Error ? cause.message : "No pudimos cargar los productos.",
      }));
    });
    return () => controller.abort();
  }, [accessToken, businessId, allowed, scope, attempt]);
  useEffect(() => () => { write.current?.abort(); write.current = null; }, [scope]);
  const current = snapshot?.scope === scope ? snapshot : null;
  async function mutate(action: ProductMutation): Promise<string | null> {
    if (!allowed) throw new ApiError(403, "FORBIDDEN", "No tienes acceso.");
    if (write.current || !current?.data) throw new ApiError(409, "BUSY", "Espera a que termine la solicitud actual.");
    const controller = new AbortController();
    write.current = controller;
    read.current?.abort();
    setBusy(true);
    try {
      await saveProduct(action, accessToken, controller.signal);
      controller.signal.throwIfAborted();
      const existing = action.kind === "create" ? undefined : current.data.products.find(p => p.id === action.id);
      const [catalog, detail] = await Promise.allSettled([
        getProductCatalog(accessToken, controller.signal).then(data => verify(data, businessId)),
        existing ? getProductDetail(existing.id, existing.isCombo, accessToken, controller.signal) : Promise.resolve(null),
      ]);
      controller.signal.throwIfAborted();
      let next = catalog.status === "fulfilled" ? catalog.value : current.data;
      let detailError = "";
      if (detail.status === "fulfilled" && detail.value && existing) {
        if (detail.value.id !== existing.id || detail.value.businessId !== businessId) {
          detailError = "No pudimos verificar el detalle actualizado.";
        } else {
          const updated = detail.value;
          next = { ...next, products: next.products.map(p => p.id === updated.id ? { ...p, ...updated } : p) };
        }
      } else if (detail.status === "rejected") {
        detailError = detail.reason instanceof Error ? detail.reason.message : "No pudimos actualizar el detalle.";
      }
      // La eliminación de imagen confirmada no depende de que la lectura posterior funcione.
      if (action.kind === "remove-image") {
        next = { ...next, products: next.products.map(p => p.id === action.id ? { ...p, imageUrl: null } : p) };
      }
      const listError = catalog.status === "rejected"
        ? (catalog.reason instanceof Error ? catalog.reason.message : "No pudimos actualizar el listado.") : "";
      const warning = [listError, detailError].filter(Boolean).join(" ");
      setSnapshot({ scope, data: next, error: warning ? "El cambio se guardó. " + warning : null });
      return warning ? "El cambio se guardó. " + warning + " Reintenta la consulta, no el guardado." : null;
    } finally {
      if (write.current === controller) { write.current = null; setBusy(false); }
    }
  }
  return {
    data: allowed ? current?.data ?? null : null,
    loading: allowed && current === null,
    error: allowed ? current?.error ?? null : "No tienes acceso a los productos.",
    busy, mutate, retry: () => { if (!write.current) setAttempt(v => v + 1); },
  };
}

```

### ProductsPage.tsx — Existente

Ruta de destino: `src/features/products/pages/ProductsPage.tsx`.

[ProductsPage.tsx](archivos/src/features/products/pages/ProductsPage.tsx) · [ProductsPage.tsx:1](archivos/src/features/products/pages/ProductsPage.tsx:1)

Integra el formulario compartido, detalle independiente, edición, confirmaciones, imagen y navegación preparada a Inventario. Reemplazo completo:

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useAppShell } from "../../../app/layout/shell-context";
import type { AuthSession } from "../../auth/types/auth.types";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind, ProductMutation } from "../schemas/product-action.schema";
import { ProductList } from "../components/ProductList";
import { ProductForm } from "../components/ProductForm";
import { ProductEditor } from "../components/ProductEditor";
import { ProductImageForm } from "../components/ProductImageForm";
import { ProductStatusConfirmDialog } from "../components/ProductStatusConfirmDialog";
import { productInventoryPath } from "../utils/product-inventory";
import { useProducts } from "../hooks/useProducts";

type Editor = { kind: "create" } | { kind: Exclude<ProductActionKind, "inventory">; id: string };
export function ProductsPage() {
  const { session } = useAppShell();
  if (!session.authorization.roles.includes("ADMIN")) return <Alert>No tienes acceso a Productos.</Alert>;
  return <ProductsContent key={`${session.business.id}:${session.membership.id}:${session.accessToken}`} session={session} />;
}
function ProductsContent({ session }: { session: AuthSession }) {
  const resource = useProducts(session);
  const navigate = useNavigate();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const alive = useRef(false);
  const modalId = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function save(action: ProductMutation) {
    const warning = await resource.mutate(action);
    if (!alive.current) return;
    setRevision(v => v + 1);
    setEditor(action.kind === "create" ? null : { kind: "detail", id: action.id });
    setNotice({
      error: !!warning,
      message: warning ?? (action.kind === "create"
        ? "Producto creado. El control de inventario es opcional y se configura desde Inventario."
        : "Cambios guardados."),
    });
  }
  function onAction(kind: ProductActionKind, product: Product) {
    if (resource.busy) return;
    setNotice(null);
    if (kind === "inventory") {
      setEditor(null);
      const path = productInventoryPath(product.id, product.hasInventory);
      if (path) navigate(path);
      else setNotice({ error: false, message: "Inventario todavía no está disponible. La configuración se realizará en ese módulo." });
      return;
    }
    setEditor({ kind, id: product.id });
  }
  const product = editor && editor.kind !== "create"
    ? resource.data?.products.find(p => p.id === editor.id) : undefined;
  const title = !editor ? "" : editor.kind === "create" ? "Nuevo producto"
    : editor.kind === "detail" ? "Detalle del producto"
    : editor.kind === "edit" ? "Editar producto"
    : editor.kind === "image" ? "Imagen del producto"
    : editor.kind === "remove-image" ? "Retirar imagen"
    : product?.isActive ? "Desactivar producto" : "Activar producto";
  return <div className="products-page">
    {resource.loading && <LoadingState message="Cargando productos…" />}
    {resource.error && <Alert><p>{resource.error}</p>
      <Button size="sm" variant="secondary" disabled={resource.busy} onClick={resource.retry}>Reintentar consulta</Button>
    </Alert>}
    {resource.data && <ProductList products={resource.data.products} categories={resource.data.categories}
      disabled={resource.busy || !!editor} onAction={onAction} onCreate={() => { setNotice(null); setEditor({ kind: "create" }); }} />}
    {notice && <div className="fixed inset-x-4 bottom-24 z-40 sm:bottom-6 sm:left-auto sm:w-96">
      <Alert variant={notice.error ? "error" : "success"}>{notice.message}</Alert>
    </div>}
    {editor && resource.data && <BottomSheet id={modalId} open variant="modal" title={title}
      busy={resource.busy} className="products-page" onClose={() => setEditor(null)}>
      {editor.kind === "create"
        ? <ProductForm products={resource.data.products} categories={resource.data.categories} areas={resource.data.areas}
            busy={resource.busy} onSave={save} onCancel={() => setEditor(null)} />
        : !product ? <Alert>Este producto ya no aparece en el listado. Actualiza la consulta.</Alert>
        : editor.kind === "image" ? <ProductImageForm key={product.id} product={product} busy={resource.busy} onSave={save} onCancel={() => setEditor(null)} />
        : editor.kind === "status" || editor.kind === "remove-image"
          ? <ProductStatusConfirmDialog key={`${product.id}:${editor.kind}`} product={product} kind={editor.kind}
              busy={resource.busy} onSave={save} onCancel={() => setEditor(null)} />
          : <ProductEditor key={`${product.id}:${editor.kind}:${revision}`} product={product} editing={editor.kind === "edit"}
              token={session.accessToken} products={resource.data.products} categories={resource.data.categories} areas={resource.data.areas}
              busy={resource.busy} onSave={save} onCancel={() => setEditor(null)} onAction={onAction} />}
    </BottomSheet>}
  </div>;
}

```

### product-action.schema.ts — Existente

Ruta de destino: `src/features/products/schemas/product-action.schema.ts`.

[product-action.schema.ts](archivos/src/features/products/schemas/product-action.schema.ts) · [product-action.schema.ts:1](archivos/src/features/products/schemas/product-action.schema.ts:1)

Define contratos comerciales y componentes; elimina los validadores y tipos de configuración de inventario. Reemplazo completo:

```ts
import { z } from "zod";
import { fulfillmentModeSchema, productDetailSchema, productIdSchema } from "./product.schema";

const optionalText = (max: number) => z.string().trim().max(max).nullable().transform(v => v || null);
export const productEditSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre.").max(150),
  sku: optionalText(50),
  description: optionalText(500),
  currentPrice: z.string().trim().transform(v => v.replace(",", "."))
    .pipe(z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Usa un importe con máximo dos decimales.")),
  categoryId: productIdSchema,
  preparationAreaId: productIdSchema,
  fulfillmentMode: fulfillmentModeSchema,
});
export const componentsSchema = z.array(z.object({
  productId: productIdSchema,
  quantity: z.number().finite().positive("La cantidad debe ser mayor que cero."),
})).min(1, "Agrega al menos un componente.").superRefine((items, ctx) => {
  if (new Set(items.map(i => i.productId)).size !== items.length) {
    ctx.addIssue({ code: "custom", message: "No repitas componentes." });
  }
});

export const comboResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    product: productDetailSchema.extend({
      isCombo: z.literal(true),
      components: z.array(z.object({
        productId: productIdSchema,
        productName: z.string(),
        quantity: z.number().finite().positive(),
      })),
    }),
  }),
});
export type ProductEditInput = z.output<typeof productEditSchema>;
export type ComboComponent = z.infer<typeof componentsSchema>[number];
export type CatalogDetail = z.infer<typeof productDetailSchema> & {
  components?: { productId: string; productName: string; quantity: number }[];
};
export type ProductActionKind = "detail" | "edit" | "image" | "remove-image" | "status" | "inventory";
export type ProductMutation =
  | { kind: "create"; isCombo: boolean; input: ProductEditInput; components?: ComboComponent[]; file?: File }
  | { kind: "edit"; id: string; isCombo: boolean; input: Partial<ProductEditInput>; components?: ComboComponent[] }
  | { kind: "status"; id: string; isActive: boolean }
  | { kind: "image"; id: string; file: File }
  | { kind: "remove-image"; id: string };

```

### product.schema.ts — Existente

Ruta de destino: `src/features/products/schemas/product.schema.ts`.

[product.schema.ts](archivos/src/features/products/schemas/product.schema.ts) · [product.schema.ts:1](archivos/src/features/products/schemas/product.schema.ts:1)

Separa detalle y listado; añade paginación y admite los metadatos operativos opcionales. Reemplazo completo:

```ts
import { z } from "zod";

export const productIdSchema = z.string().regex(/^[1-9]\d*$/);
export const fulfillmentModeSchema = z.enum(["PREPARE_TO_ORDER", "READY_TO_SERVE"]);
export const inventoryTrackingSchema = z.enum(["NONE", "RESALE", "PRODUCTION", "COMBO", "CUSTOM"]);

export const productDetailSchema = z.object({
  id: productIdSchema,
  businessId: productIdSchema,
  categoryId: productIdSchema,
  preparationAreaId: productIdSchema,
  fulfillmentMode: fulfillmentModeSchema,
  sku: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currentPrice: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const productSchema = productDetailSchema.extend({
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  categoryName: z.string(),
  preparationAreaName: z.string(),
  categoryIsActive: z.boolean().optional(),
  preparationAreaIsActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isCombo: z.boolean(),
  hasInventory: z.boolean(),
  inventoryTrackingType: inventoryTrackingSchema,
});

export const productListSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    products: z.array(productSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }).optional(),
  }),
});

export const productDetailResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ product: productDetailSchema }),
});

export type Product = z.infer<typeof productSchema>;
export type ProductDetailData = z.infer<typeof productDetailSchema>;

```

### product.service.ts — Existente

Ruta de destino: `src/features/products/services/product.service.ts`.

[product.service.ts](archivos/src/features/products/services/product.service.ts) · [product.service.ts:1](archivos/src/features/products/services/product.service.ts:1)

Carga el catálogo paginado y conecta detalle normal/combo, creación de combos y composición editable. Elimina inventory-setup. Reemplazo completo:

```ts
import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import { getCategories } from "../../categories/services/category.service";
import { getPreparationAreas } from "../../preparation-areas/services/preparation-area.service";
import { productIdSchema, productListSchema, productDetailResponseSchema } from "../schemas/product.schema";
import { comboResponseSchema, componentsSchema, productEditSchema } from "../schemas/product-action.schema";
import type { CatalogDetail, ProductMutation } from "../schemas/product-action.schema";

const savedSchema = z.object({ status: z.literal("success") });
export async function getProductCatalog(accessToken: string, signal: AbortSignal) {
  const [products, categories, areas] = await Promise.all([
    getAllProducts(accessToken, signal),
    getCategories(accessToken, signal),
    getPreparationAreas(accessToken, signal),
  ]);
  return { products, categories, areas };
}
async function getAllProducts(accessToken: string, signal: AbortSignal) {
  const first = await request("/products", productListSchema, { accessToken, signal });
  const products = [...first.data.products];
  const pagination = first.data.pagination;
  if (pagination) {
    for (let page = pagination.page + 1; page <= pagination.totalPages; page++) {
      const result = await request(
        `/products?page=${page}&pageSize=${pagination.pageSize}`,
        productListSchema, { accessToken, signal }
      );
      products.push(...result.data.products);
    }
  }
  return [...new Map(products.map(p => [p.id, p])).values()];
}
export function validateProductImage(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Selecciona una imagen JPEG, PNG o WebP.";
  }
  if (!file.size || file.size > 5 * 1024 * 1024) {
    return "La imagen debe contener datos y pesar como máximo 5 MB.";
  }
  return null;
}
export async function getProductDetail(
  id: string, isCombo: boolean, accessToken: string, signal: AbortSignal
): Promise<CatalogDetail> {
  const validId = productIdSchema.parse(id);
  if (isCombo) {
    const result = await request(`/products/combos/${validId}`, comboResponseSchema, { accessToken, signal });
    return result.data.product;
  }
  const result = await request(`/products/${validId}`, productDetailResponseSchema, { accessToken, signal });
  return result.data.product;
}
export async function saveProduct(action: ProductMutation, accessToken: string, signal: AbortSignal) {
  const options = { accessToken, signal };
  if (action.kind === "create") {
    const input = productEditSchema.parse(action.input);
    const components = action.isCombo ? componentsSchema.parse(action.components) : undefined;
    if (action.file) {
      const error = validateProductImage(action.file);
      if (error) throw new ApiError(400, "INVALID_IMAGE", error);
    }
    // Multipart también sin imagen para combos: no dependemos de la variante JSON opcional.
    let body: unknown = input;
    if (action.file || action.isCombo) {
      const form = new FormData();
      for (const [key, value] of Object.entries(input)) {
        if (value !== null) form.append(key, value);
      }
      if (components) form.append("components", JSON.stringify(components));
      if (action.file) form.append("image", action.file);
      body = form;
    }
    await request(action.isCombo ? "/products/combos" : "/products", savedSchema, {
      ...options, method: "POST", body,
    });
    return;
  }
  const id = productIdSchema.parse(action.id);
  if (action.kind === "edit") {
    const input = productEditSchema.partial().parse(action.input);
    const body = action.isCombo && action.components !== undefined
      ? { ...input, components: componentsSchema.parse(action.components) }
      : input;
    await request(action.isCombo ? `/products/combos/${id}` : `/products/${id}`,
      savedSchema, { ...options, method: "PATCH", body });
  } else if (action.kind === "status") {
    await request(`/products/${id}/status`, savedSchema, {
      ...options, method: "PATCH", body: { isActive: action.isActive },
    });
  } else if (action.kind === "image") {
    const error = validateProductImage(action.file);
    if (error) throw new ApiError(400, "INVALID_IMAGE", error);
    const form = new FormData();
    form.append("image", action.file);
    await request(`/products/${id}/image`, savedSchema, { ...options, method: "PUT", body: form });
  } else {
    await request(`/products/${id}/image`, z.union([savedSchema, z.null()]), {
      ...options, method: "DELETE",
    });
  }
}

```

### product-inventory.ts — Nuevo

Ruta de destino: `src/features/products/utils/product-inventory.ts`.

[product-inventory.ts](archivos/src/features/products/utils/product-inventory.ts) · [product-inventory.ts:1](archivos/src/features/products/utils/product-inventory.ts:1)

```ts
import { getNavigation } from "../../../app/navigation";

export function productInventoryPath(productId: string, hasInventory: boolean): string | null {
  const route = getNavigation(["ADMIN"]).find(item => item.id === "inventory");
  if (!route || route.status !== "ready") return null;
  // El destino recibe el producto; Inventario decidirá cómo abrir su configuración.
  const params = new URLSearchParams({
    productId, intent: hasInventory ? "manage" : "configure",
  });
  return route.to + (route.to.includes("?") ? "&" : "?") + params.toString();
}

```

## Archivos reemplazados que debes retirar

- `src/features/products/components/ProductCreateForm.tsx`
- `src/features/products/components/ProductDataForm.tsx`
- `src/features/products/components/ComboDetails.tsx`

El parche los elimina. En la aplicación manual, retíralos después de incorporar los nuevos archivos: el formulario compartido y el detalle nuevo ya reemplazan su lógica.

## Validación y pruebas

TypeScript y ESLint revisaron el árbol propuesto sin modificar src.
La prueba `node entregas/productos/verificar.cjs` usa respuestas simuladas, sin escrituras reales.

Verifica paginación, Bearer, JSON, multipart, serialización, PATCH parcial, imágenes, estado, contratos de detalle, componentes inválidos y duplicados, rechazo de PRODUCTION como cumplimiento, errores específicos, confirmación de desactivación y separación de Inventario.

Pendiente: integración contra la API real y revisión visual en navegador.

## Prueba manual

1. Crear normal sin imagen y seleccionar explícitamente su cumplimiento.
2. Crear normal con imagen y comprobar el nombre del archivo seleccionado.
3. Crear combo: agregar dos veces el mismo producto debe consolidar la cantidad en una fila.
4. Abrir Ver detalle del combo y comprobar su composición guardada.
5. Editar cantidad y precio del combo; verificar la consulta posterior al guardado.
6. Editar solo el nombre de un normal: PATCH no debe incluir imagen ni campos de inventario.
7. Cambiar y retirar imagen conservando los demás datos.
8. Desactivar confirmando el mensaje y comprobar que permanece listado como inactivo.
9. Editar desde una página posterior con filtros activos: comprobar que se conserva el contexto.
10. Ir a Inventario: por ahora debe mostrar aviso, sin ejecutar escrituras.
