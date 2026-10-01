import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Save } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { SelectField } from "../../../components/forms/SelectField";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import type { Category } from "../../categories/schemas/category.schema";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import { productEditSchema } from "../schemas/product-action.schema";
import type { ProductMutation } from "../schemas/product-action.schema";
import { validateProductImage } from "../services/product.service";

interface ProductCreateFormProps {
  categories: readonly Category[];
  areas: readonly PreparationArea[];
  busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
}

export function ProductCreateForm({
  categories,
  areas,
  busy,
  onSave,
  onCancel,
}: ProductCreateFormProps) {
  const [draft, setDraft] = useState({
    name: "",
    sku: "",
    description: "",
    currentPrice: "",
    categoryId: "",
    preparationAreaId: "",
    fulfillmentMode: "PREPARE_TO_ORDER",
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const imageId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const alive = useRef(false);

  const activeCategories = categories.filter((item) => item.isActive);

  const activeAreas = areas.filter((item) => item.isActive);

  const missingSetup =
    !activeCategories.length || !activeAreas.length;

  const imageError =
    (file ? validateProductImage(file) : null) || errors.image;

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;

      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
      }
    };
  }, []);

  function change(key: keyof typeof draft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  function changeImage(selected: File | null) {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
    }

    objectUrl.current =
      selected && !validateProductImage(selected)
        ? URL.createObjectURL(selected)
        : null;

    setFile(selected);
    setPreview(objectUrl.current);
    setErrors((previous) => ({ ...previous, image: "" }));
    setMessage("");
  }

  async function submit(form: HTMLFormElement) {
    if (busy || missingSetup || imageError) return;

    const result = productEditSchema.safeParse(draft);

    if (!result.success) {
      const next: Record<string, string> = {};

      for (const issue of result.error.issues) {
        next[String(issue.path[0])] ??= issue.message;
      }

      setErrors(next);

      requestAnimationFrame(() => {
        if (form.isConnected) {
          form
            .querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        }
      });

      return;
    }

    setErrors({});
    setMessage("");

    try {
      await onSave({
        kind: "create",
        input: result.data,
        ...(file ? { file } : {}),
      });
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
      }

      setErrors(next);
      setMessage(
        error instanceof ApiError
          ? error.message
          : "No pudimos crear el producto."
      );
    }
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      {missingSetup && (
        <div className="space-y-2 rounded-xl border border-outline bg-secondary/40 p-3 text-xs text-muted">
          <p>
            Para crear productos necesitas una categoría y un área de
            preparación activas.
          </p>

          {!activeCategories.length && (
            <Link
              to="/productos/categorias"
              className="block text-accent underline"
            >
              Ir a categorías
            </Link>
          )}

          {!activeAreas.length && (
            <Link
              to="/mi-negocio"
              className="block text-accent underline"
            >
              Ir a configuración del negocio
            </Link>
          )}
        </div>
      )}

      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">Nuevo producto</legend>

        <TextField
          label="Nombre del producto"
          name="name"
          required
          maxLength={150}
          data-dialog-initial-focus
          autoFocus
          value={draft.name}
          error={errors.name}
          onChange={(event) => change("name", event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Código / SKU (opcional)"
            name="sku"
            maxLength={50}
            value={draft.sku}
            error={errors.sku}
            onChange={(event) => change("sku", event.target.value)}
          />

          <TextField
            label="Precio"
            name="currentPrice"
            required
            inputMode="decimal"
            placeholder="Ej. 18000"
            value={draft.currentPrice}
            error={errors.currentPrice}
            onChange={(event) => {
              change("currentPrice", event.target.value);
            }}
          />
        </div>

        <SelectField
          label="Categoría"
          required
          disabled={busy}
          value={draft.categoryId}
          error={errors.categoryId}
          onValueChange={(value) => change("categoryId", value)}
          options={activeCategories.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <SelectField
          label="Área de preparación"
          required
          disabled={busy}
          value={draft.preparationAreaId}
          error={errors.preparationAreaId}
          onValueChange={(value) => {
            change("preparationAreaId", value);
          }}
          options={activeAreas.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />

        <SelectField
          label="Preparación"
          required
          disabled={busy}
          value={draft.fulfillmentMode}
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

        <TextAreaField
          label="Descripción (opcional)"
          name="description"
          rows={3}
          maxLength={500}
          value={draft.description}
          error={errors.description}
          onChange={(event) => {
            change("description", event.target.value);
          }}
        />

        <div className="space-y-2">
          <label
            htmlFor={imageId}
            className="block text-xs font-semibold text-muted"
          >
            Imagen (opcional)
          </label>

          {preview && (
            <div className="flex justify-center">
              <Avatar
                name={draft.name || "Producto"}
                src={preview}
                size="xl"
              />
            </div>
          )}

          <input
            ref={fileInput}
            id={imageId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={!!imageError}
            aria-describedby={`${imageId}-help`}
            className="block w-full min-w-0 rounded-xl border border-outline p-2 text-xs text-heading file:mr-2 file:rounded-lg file:bg-secondary file:p-2 file:text-heading"
            onChange={(event) => {
              changeImage(event.target.files?.[0] ?? null);
            }}
          />

          <p id={`${imageId}-help`} className="text-xs text-muted">
            {imageError || "JPEG, PNG o WebP. Máximo 5 MB."}
          </p>

          {file && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                changeImage(null);

                if (fileInput.current) {
                  fileInput.current.value = "";
                }
              }}
            >
              Quitar imagen
            </Button>
          )}
        </div>
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
          loadingText="Creando…"
          disabled={busy || missingSetup || !!imageError}
        >
          <Save aria-hidden="true" size={16} />
          Crear producto
        </Button>
      </div>
    </form>
  );
}
