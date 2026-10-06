import { useRef, useState } from "react";
import { Boxes, Save } from "lucide-react";
import { InventoryTrackingBadge } from "./ProductBadges";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import type { Category } from "../../categories/schemas/category.schema";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import type { Product } from "../schemas/product.schema";
import {
  componentsSchema,
  productEditSchema,
} from "../schemas/product-action.schema";
import type {
  CatalogDetail,
  ComboComponent,
  ProductEditInput,
  ProductMutation,
} from "../schemas/product-action.schema";
import { ComboComponentsEditor } from "./ComboComponentsEditor";
import { ProductImageField } from "./ProductImageField";
import { formatProductPrice } from "../utils/product-list";

interface ProductFormProps {
  original?: CatalogDetail;
  isCombo?: boolean;
  products: readonly Product[];
  categories: readonly Category[];
  areas: readonly PreparationArea[];
  busy: boolean;
  summary?: Product;
  onInventory?: () => void;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({
  original,
  summary,
  isCombo: originalIsCombo = false,
  products,
  categories,
  areas,
  busy,
  onSave,
  onCancel,
  onInventory,
}: ProductFormProps) {
  const [isCombo, setIsCombo] = useState(originalIsCombo);

  const [draft, setDraft] = useState({
    name: original?.name ?? "",
    sku: original?.sku ?? "",
    description: original?.description ?? "",
    currentPrice: original?.currentPrice ?? "",
    categoryId: original?.categoryId ?? "",
    preparationAreaId: original?.preparationAreaId ?? "",
    fulfillmentMode: original?.fulfillmentMode ?? "",
  });

  const [components, setComponents] = useState<ComboComponent[]>(
    original?.components?.map(({ productId, quantity }) => ({
      productId,
      quantity,
    })) ?? []
  );

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = useRef(false);

  const parsed = productEditSchema.safeParse(draft);

  const compositionValid =
    !isCombo ||
    (componentsSchema.safeParse(components).success &&
      components.every(
        (component) =>
          component.productId !== original?.id &&
          products.some(
            (product) => product.id === component.productId
          )
      ));

  const setupValid =
    categories.some(
      (category) =>
        category.id === draft.categoryId &&
        (category.isActive || original?.categoryId === category.id)
    ) &&
    areas.some(
      (area) =>
        area.id === draft.preparationAreaId &&
        (area.isActive || original?.preparationAreaId === area.id)
    );

  const valid = parsed.success && compositionValid && setupValid;

  function change(key: keyof typeof draft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  async function submit() {
    if (busy || saving.current || !valid || !parsed.success) {
      return;
    }

    saving.current = true;
    setMessage("");
    setErrors({});

    try {
      if (!original) {
        await onSave({
          kind: "create",
          isCombo,
          input: parsed.data,
          ...(isCombo ? { components } : {}),
          ...(file ? { file } : {}),
        });
      } else {
        const input = Object.fromEntries(
          Object.entries(parsed.data).filter(([key, value]) => {
            const previous = original[key as keyof ProductEditInput];

            return key === "currentPrice"
              ? formatProductPrice(String(value)) !==
                  formatProductPrice(String(previous))
              : value !== previous;
          })
        ) as Partial<ProductEditInput>;

        const normalized = (items: ComboComponent[]) =>
          JSON.stringify(
            [...items].sort((first, second) =>
              first.productId.localeCompare(second.productId)
            )
          );

        const previous =
          original.components?.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })) ?? [];

        const compositionChanged =
          isCombo && normalized(previous) !== normalized(components);

        if (!Object.keys(input).length && !compositionChanged) {
          onCancel();
          return;
        }

        await onSave({
          kind: "edit",
          id: original.id,
          isCombo,
          input,
          ...(compositionChanged ? { components } : {}),
        });
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrors(
          Object.fromEntries(
            cause.errors.map((error) => [error.field, error.message])
          )
        );

        if (cause.code === "PRODUCT_SKU_CONFLICT") {
          setErrors((previous) => ({
            ...previous,
            sku: cause.message,
          }));
        }
      }

      setMessage(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar el producto."
      );
    } finally {
      saving.current = false;
    }
  }

  return (
    <form
      className="product-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="product-modal-section">
        <section className="product-form-section">
          <h3>Información comercial</h3>

          <TextField
            label="Nombre del producto"
            placeholder="Ej. Combo desayuno"
            required
            maxLength={150}
            value={draft.name}
            disabled={busy}
            error={errors.name}
            onChange={(event) => change("name", event.target.value)}
          />

          <div className="product-form-grid">
            <TextField
              label="Código SKU (opcional)"
              placeholder="Ej. DESAYUNO-01"
              maxLength={50}
              value={draft.sku}
              disabled={busy}
              error={errors.sku}
              onChange={(event) => change("sku", event.target.value)}
            />

            <TextField
              label="Precio de venta"
              placeholder="Ej. 15000.00"
              inputMode="decimal"
              required
              value={draft.currentPrice}
              disabled={busy}
              error={errors.currentPrice}
              onChange={(event) =>
                change("currentPrice", event.target.value)
              }
            />
          </div>

          <TextAreaField
            label="Descripción (opcional)"
            placeholder="Describe el producto o la oferta"
            rows={3}
            value={draft.description}
            maxLength={500}
            disabled={busy}
            error={errors.description}
            onChange={(event) =>
              change("description", event.target.value)
            }
          />
        </section>

        <section className="product-form-section">
          <h3>Clasificación y atención</h3>

          <div className="product-form-grid">
            <SelectField
              label="Categoría"
              value={draft.categoryId}
              required
              disabled={busy}
              error={errors.categoryId}
              onValueChange={(value) => change("categoryId", value)}
              options={categories
                .filter(
                  (category) =>
                    category.isActive ||
                    category.id === original?.categoryId
                )
                .map((category) => ({
                  value: category.id,
                  label:
                    category.name +
                    (category.isActive ? "" : " · Inactiva"),
                  disabled: !category.isActive,
                }))}
            />

            <SelectField
              label="Área de preparación"
              value={draft.preparationAreaId}
              required
              disabled={busy}
              error={errors.preparationAreaId}
              onValueChange={(value) =>
                change("preparationAreaId", value)
              }
              options={areas
                .filter(
                  (area) =>
                    area.isActive ||
                    area.id === original?.preparationAreaId
                )
                .map((area) => ({
                  value: area.id,
                  label:
                    area.name + (area.isActive ? "" : " · Inactiva"),
                  disabled: !area.isActive,
                }))}
            />

            {!original ? (
              <SelectField
                label="Tipo de producto"
                value={isCombo ? "combo" : "normal"}
                onValueChange={(value) =>
                  setIsCombo(value === "combo")
                }
                disabled={busy}
                options={[
                  { value: "normal", label: "Producto normal" },
                  { value: "combo", label: "Producto combo" },
                ]}
              />
            ) : (
              <div className="product-readonly-field">
                <span>Tipo de producto</span>
                <p>{isCombo ? "Combo" : "Normal"}</p>
              </div>
            )}

            <SelectField
              label="Forma de cumplimiento"
              value={draft.fulfillmentMode}
              required
              disabled={busy}
              error={errors.fulfillmentMode}
              onValueChange={(value) =>
                change("fulfillmentMode", value)
              }
              options={[
                {
                  value: "PREPARE_TO_ORDER",
                  label: "Preparar después de recibir el pedido",
                },
                {
                  value: "READY_TO_SERVE",
                  label: "Ya está listo para entregar",
                },
              ]}
            />
          </div>

          <p className="product-modal-help">
            La forma de cumplimiento define la preparación y entrega
            del producto dentro de una orden.
          </p>
        </section>

        {isCombo && (
          <section className="product-form-section">
            <ComboComponentsEditor
              products={products}
              value={components}
              ownId={original?.id}
              onChange={setComponents}
              disabled={busy}
            />

            {!compositionValid && (
              <p className="text-xs text-danger">
                Agrega componentes existentes con cantidades mayores
                que cero. El combo no puede incluirse a sí mismo.
              </p>
            )}
          </section>
        )}

        {!original && (
          <section className="product-form-section">
            <ProductImageField
              file={file}
              name={draft.name}
              disabled={busy}
              onChange={setFile}
            />
          </section>
        )}

        <div className="product-inventory-note">
          <div>
            {summary ? (
              <div className="product-inventory-summary">
                <Boxes size={16} aria-hidden="true" />
                <InventoryTrackingBadge product={summary} />
              </div>
            ) : (
              <p>
                El inventario es opcional y se configura después de
                crear el producto.
              </p>
            )}

            {summary && (
              <p className="product-modal-help">
                Su configuración se administra desde Inventario.
              </p>
            )}
          </div>

          {onInventory && (
            <button
              type="button"
              className="product-modal-link"
              disabled={busy}
              onClick={onInventory}
            >
              Ir a Inventario
            </button>
          )}
        </div>

        <div className="product-form-feedback">
          {message && (
            <Alert>
              <p>{message}</p>

              {Object.entries(errors)
                .filter(([key]) => key.startsWith("components"))
                .map(([key, text]) => (
                  <p key={key}>{text}</p>
                ))}
            </Alert>
          )}

          {!categories.some((category) => category.isActive) && (
            <Alert>
              Necesitas una categoría activa para crear productos.
            </Alert>
          )}

          {!areas.some((area) => area.isActive) && (
            <Alert>
              Necesitas un área de preparación activa para crear
              productos.
            </Alert>
          )}
        </div>
      </div>

      <footer className="product-modal-footer">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button
          size="sm"
          type="submit"
          loading={busy}
          loadingText="Guardando…"
          disabled={!valid || busy}
        >
          <Save size={16} aria-hidden="true" />
          {original ? "Guardar cambios" : "Crear producto"}
        </Button>
      </footer>
    </form>
  );
}
