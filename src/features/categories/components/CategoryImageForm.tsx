import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { resolveFileUrl } from "../../../lib/files";
import { ApiError } from "../../../lib/http/client";
import type {
  Category,
  CategoryAction,
} from "../schemas/category.schema";
import { validateCategoryImage } from "../services/category.service";

interface CategoryImageFormProps {
  category: Category;
  busy: boolean;
  onSave: (action: CategoryAction) => Promise<void>;
  onCancel: () => void;
}

type ImageAction = Extract<
  CategoryAction,
  { kind: "image" | "remove-image" }
>;

export function CategoryImageForm({
  category,
  busy,
  onSave,
  onCancel,
}: CategoryImageFormProps) {
  const id = useId();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<
    "image" | "remove-image" | null
  >(null);

  const objectUrl = useRef<string | null>(null);
  const alive = useRef(false);
  const saving = useRef(false);

  const locked = busy || operation !== null;

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;

      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
    };
  }, []);

  async function save(action: ImageAction) {
    if (busy || saving.current) return;

    saving.current = true;
    setOperation(action.kind);
    setError("");

    try {
      await onSave(action);
    } catch (cause) {
      if (alive.current) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "No pudimos actualizar la imagen."
        );
      }
    } finally {
      saving.current = false;

      if (alive.current) {
        setOperation(null);
      }
    }
  }

  return (
    <form
      className="product-image-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (file && !locked) {
          void save({
            kind: "image",
            id: category.id,
            file,
          });
        }
      }}
    >
      <div className="product-modal-section">
        <div className="product-image-preview product-detail-image">
          <Avatar
            name={category.name}
            src={preview ?? resolveFileUrl(category.imageUrl)}
            size="xl"
          />
        </div>

        <div className="product-image-upload">
          <input
            id={id}
            type="file"
            data-dialog-initial-focus
            accept="image/jpeg,image/png,image/webp"
            disabled={locked}
            aria-label={`Seleccionar imagen para ${category.name}`}
            aria-invalid={!!error}
            aria-describedby={[
              `${id}-filename`,
              `${id}-help`,
              error ? `${id}-error` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];

              if (!selected) return;

              const message = validateCategoryImage(selected);

              if (objectUrl.current) {
                URL.revokeObjectURL(objectUrl.current);
                objectUrl.current = null;
              }

              setFile(null);
              setPreview(null);
              setError(message ?? "");

              if (message) {
                event.currentTarget.value = "";
                return;
              }

              const nextPreview = URL.createObjectURL(selected);

              objectUrl.current = nextPreview;
              setPreview(nextPreview);
              setFile(selected);
            }}
          />

          <div className="product-image-upload-content">
            <Upload size={20} aria-hidden="true" />

            <div>
              <strong>
                {file ? "Cambiar archivo" : "Seleccionar archivo"}
              </strong>

              <p
                id={`${id}-filename`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {file?.name ?? "Ningún archivo seleccionado"}
              </p>
            </div>
          </div>
        </div>

        <p id={`${id}-help`} className="product-modal-help">
          JPEG, PNG o WebP · Máximo 5 MB.
        </p>

        {error && (
          <div id={`${id}-error`} className="product-form-feedback">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {category.imageUrl && (
          <div className="product-image-remove">
            <Button
              size="sm"
              variant="danger"
              disabled={locked}
              loading={operation === "remove-image"}
              loadingText="Retirando…"
              onClick={() => {
                void save({
                  kind: "remove-image",
                  id: category.id,
                });
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Retirar imagen actual
            </Button>
          </div>
        )}
      </div>

      <footer className="product-modal-footer">
        <Button
          size="sm"
          variant="secondary"
          disabled={locked}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          size="sm"
          disabled={!file || locked}
          loading={operation === "image"}
          loadingText="Guardando…"
        >
          <ImagePlus size={16} aria-hidden="true" />
          Guardar imagen
        </Button>
      </footer>
    </form>
  );
}
