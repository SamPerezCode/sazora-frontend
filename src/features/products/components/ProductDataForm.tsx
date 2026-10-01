import { useEffect, useRef, useState } from "react";
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
  productEditSchema,
  inventorySetupSchema,
} from "../schemas/product-action.schema";
import type {
  ProductMutation,
  ProductEditInput,
} from "../schemas/product-action.schema";

interface Props {
  product: Product;
  kind: "edit" | "inventory";
  categories: readonly Category[];
  areas: readonly PreparationArea[];
  busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
}

export function ProductDataForm({
  product,
  kind,
  categories,
  areas,
  busy,
  onSave,
  onCancel,
}: Props) {
  const editing = kind === "edit";

  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    name: product.name,
    sku: product.sku ?? "",
    description: product.description ?? "",
    currentPrice: product.currentPrice,
    categoryId: product.categoryId,
    preparationAreaId: product.preparationAreaId,
    fulfillmentMode: product.fulfillmentMode,
    trackingType: "RESALE",
    baseUnit: "UNIT",
    openingQuantity: "0",
    minimumStock: "0",
    quantityPerProduct: "1",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function change(key: string, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  async function submit(form: HTMLFormElement) {
    if (busy) return;

    setMessage("");
    setErrors({});

    try {
      let action: ProductMutation;

      if (editing) {
        const values = productEditSchema.parse(draft);

        const input = Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) =>
              product[key as keyof ProductEditInput] !== value
          )
        ) as Partial<ProductEditInput>;

        if (!Object.keys(input).length) {
          onCancel();
          return;
        }

        action = {
          kind: "edit",
          id: product.id,
          isCombo: product.isCombo,
          input,
        };
      } else {
        action = {
          kind: "inventory",
          id: product.id,
          input: inventorySetupSchema.parse(draft),
        };
      }

      await onSave(action);
    } catch (error) {
      if (!alive.current) return;

      const next: Record<string, string> = {};

      if (error instanceof ApiError) {
        for (const issue of error.errors) {
          next[issue.field] ??= issue.message;
        }

        if (error.code === "PRODUCT_SKU_CONFLICT") {
          next.sku = error.message;
        }
      } else if (
        error &&
        typeof error === "object" &&
        "issues" in error
      ) {
        const schema = editing
          ? productEditSchema
          : inventorySetupSchema;

        const result = schema.safeParse(draft);

        if (!result.success) {
          for (const issue of result.error.issues) {
            next[String(issue.path[0])] ??= issue.message;
          }
        }
      }

      setErrors(next);

      setMessage(
        error instanceof ApiError
          ? error.message
          : Object.keys(next).length
            ? "Revisa los campos indicados."
            : "No pudimos guardar."
      );

      requestAnimationFrame(() => {
        if (form.isConnected) {
          form
            .querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        }
      });
    }
  }

  const fields = editing
    ? [
        { key: "name", label: "Nombre", maxLength: 150 },
        {
          key: "sku",
          label: "Código / SKU (opcional)",
          maxLength: 50,
        },
        {
          key: "currentPrice",
          label: "Precio",
          maxLength: undefined,
        },
      ]
    : [
        {
          key: "sku",
          label: "SKU de inventario (opcional)",
          maxLength: 50,
        },
        {
          key: "openingQuantity",
          label: "Existencia inicial",
          maxLength: undefined,
        },
        {
          key: "minimumStock",
          label: "Stock mínimo",
          maxLength: undefined,
        },
        {
          key: "quantityPerProduct",
          label: "Cantidad descontada por venta",
          maxLength: undefined,
        },
      ];

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">
          {editing ? "Editar producto" : "Configurar inventario"}
        </legend>

        {fields.map((field, index) => (
          <TextField
            key={field.key}
            autoFocus={index === 0}
            name={field.key}
            label={field.label}
            maxLength={field.maxLength}
            inputMode={
              ["name", "sku"].includes(field.key) ? "text" : "decimal"
            }
            value={draft[field.key]}
            error={errors[field.key]}
            onChange={(event) => {
              change(field.key, event.target.value);
            }}
          />
        ))}

        {editing ? (
          <>
            <TextAreaField
              label="Descripción (opcional)"
              rows={3}
              maxLength={500}
              value={draft.description}
              error={errors.description}
              onChange={(event) => {
                change("description", event.target.value);
              }}
            />

            <SelectField
              label="Categoría"
              value={draft.categoryId}
              disabled={busy}
              error={errors.categoryId}
              onValueChange={(value) => change("categoryId", value)}
              options={categories.map((item) => ({
                value: item.id,
                label:
                  item.name + (item.isActive ? "" : " (inactiva)"),
                disabled:
                  !item.isActive && item.id !== product.categoryId,
              }))}
            />

            <SelectField
              label="Área de preparación"
              value={draft.preparationAreaId}
              disabled={busy}
              error={errors.preparationAreaId}
              onValueChange={(value) => {
                change("preparationAreaId", value);
              }}
              options={areas.map((item) => ({
                value: item.id,
                label:
                  item.name + (item.isActive ? "" : " (inactiva)"),
                disabled:
                  !item.isActive &&
                  item.id !== product.preparationAreaId,
              }))}
            />

            <SelectField
              label="Preparación"
              value={draft.fulfillmentMode}
              disabled={busy}
              error={errors.fulfillmentMode}
              onValueChange={(value) => {
                change("fulfillmentMode", value);
              }}
              options={[
                {
                  value: "PREPARE_TO_ORDER",
                  label: "Preparar al pedir",
                },
                {
                  value: "READY_TO_SERVE",
                  label: "Listo para entregar",
                },
              ]}
            />
          </>
        ) : (
          <>
            <SelectField
              label="Tipo de inventario"
              value={draft.trackingType}
              disabled={busy}
              error={errors.trackingType}
              onValueChange={(value) => {
                change("trackingType", value);
              }}
              options={[
                { value: "RESALE", label: "Reventa" },
                { value: "PRODUCTION", label: "Producción" },
              ]}
            />

            <SelectField
              label="Unidad"
              value={draft.baseUnit}
              disabled={busy}
              error={errors.baseUnit}
              onValueChange={(value) => change("baseUnit", value)}
              options={[
                { value: "UNIT", label: "Unidad" },
                { value: "GRAM", label: "Gramo" },
                { value: "KILOGRAM", label: "Kilogramo" },
                { value: "MILLILITER", label: "Mililitro" },
                { value: "LITER", label: "Litro" },
                { value: "PORTION", label: "Porción" },
                { value: "PACKAGE", label: "Paquete" },
              ]}
            />

            <p className="text-xs text-muted">
              Esta configuración inicial crea el inventario y su
              relación con el producto. El descuento se realiza al
              confirmar la orden.
            </p>
          </>
        )}
      </fieldset>

      {message && <Alert>{message}</Alert>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          size="sm"
          loading={busy}
          disabled={busy}
        >
          {editing ? "Guardar cambios" : "Configurar inventario"}
        </Button>
      </div>
    </form>
  );
}
