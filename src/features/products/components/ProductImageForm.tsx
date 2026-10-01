import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { resolveFileUrl } from "../../../lib/files";
import { ApiError } from "../../../lib/http/client";
import type { Product } from "../schemas/product.schema";
import type { ProductMutation } from "../schemas/product-action.schema";
import { validateProductImage } from "../services/product.service";

interface ProductImageFormProps {
  product: Product;
  busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
}

export function ProductImageForm({
  product,
  busy,
  onSave,
  onCancel,
}: ProductImageFormProps) {
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

  async function save(
    action: Extract<
      ProductMutation,
      { kind: "image" | "remove-image" }
    >
  ) {
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
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (file && !locked) {
          void save({
            kind: "image",
            id: product.id,
            file,
          });
        }
      }}
    >
      <div className="flex justify-center">
        <Avatar
          name={product.name}
          src={preview ?? resolveFileUrl(product.imageUrl)}
          size="xl"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-heading"
        >
          Imagen de {product.name}
        </label>

        <div className="relative min-w-0">
          <input
            id={id}
            type="file"
            data-dialog-initial-focus
            accept="image/jpeg,image/png,image/webp"
            disabled={locked}
            aria-describedby={[
              `${id}-filename`,
              `${id}-help`,
              error ? `${id}-error` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];

              if (!selected) return;

              const message = validateProductImage(selected);

              if (objectUrl.current) {
                URL.revokeObjectURL(objectUrl.current);
                objectUrl.current = null;
              }

              setFile(null);
              setPreview(null);
              setError(message ?? "");

              if (message) {
                // Solo limpiamos el input si el archivo es inválido.
                event.currentTarget.value = "";
                return;
              }

              const nextPreview = URL.createObjectURL(selected);

              objectUrl.current = nextPreview;
              setPreview(nextPreview);
              setFile(selected);
            }}
          />

          <div
            className={[
              "pointer-events-none flex min-h-20 min-w-0 items-center gap-3",
              "rounded-xl border border-input-border bg-secondary/30 p-3",
              "transition-colors",
              "peer-enabled:peer-hover:border-accent",
              "peer-enabled:peer-hover:bg-accent/5",
              "peer-focus-visible:outline-2",
              "peer-focus-visible:outline-offset-2",
              "peer-focus-visible:outline-accent",
              "peer-disabled:opacity-60",
              "motion-reduce:transition-none",
            ].join(" ")}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Upload aria-hidden="true" size={20} />
            </span>

            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-heading">
                {file ? "Cambiar archivo" : "Seleccionar archivo"}
              </span>

              <p
                id={`${id}-filename`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="mt-2 text-xs text-muted [overflow-wrap:anywhere]"
              >
                {file ? file.name : "Ningún archivo seleccionado"}
              </p>
            </div>
          </div>
        </div>

        <p id={`${id}-help`} className="text-xs text-muted">
          JPEG, PNG o WebP. Máximo 5 MB.
        </p>
      </div>

      {error && (
        <div id={`${id}-error`}>
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="space-y-3 border-t border-outline/60 pt-4">
        {product.imageUrl && (
          <Button
            size="sm"
            variant="danger"
            className="w-full"
            disabled={locked}
            loading={operation === "remove-image"}
            loadingText="Eliminando…"
            onClick={() => {
              void save({
                kind: "remove-image",
                id: product.id,
              });
            }}
          >
            <Trash2 aria-hidden="true" size={16} />
            Eliminar imagen
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="min-w-0 w-full"
            disabled={locked}
            onClick={onCancel}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            size="sm"
            className="min-w-0 w-full"
            disabled={!file || locked}
            loading={operation === "image"}
            loadingText="Guardando…"
          >
            <ImagePlus
              aria-hidden="true"
              size={16}
              className="shrink-0"
            />
            Guardar
          </Button>
        </div>
      </div>
    </form>
  );
}
