import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import type { Product } from "../schemas/product.schema";
import type { ProductMutation } from "../schemas/product-action.schema";
import { ProductImageField } from "./ProductImageField";

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
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<
    "image" | "remove-image" | null
  >(null);

  const alive = useRef(false);
  const saving = useRef(false);

  const locked = busy || operation !== null;

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
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
      className="product-image-form"
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
      <div className="product-modal-section">
        <ProductImageField
          file={file}
          name={product.name}
          currentImageUrl={product.imageUrl}
          disabled={locked}
          onChange={(next) => {
            setFile(next);
            setError("");
          }}
        />

        {error && (
          <div className="product-form-feedback">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {product.imageUrl && (
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
                  id: product.id,
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
