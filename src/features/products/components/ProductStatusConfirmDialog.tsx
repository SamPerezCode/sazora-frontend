import { useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import type { Product } from "../schemas/product.schema";
import type { ProductMutation } from "../schemas/product-action.schema";

interface ProductStatusConfirmDialogProps {
  product: Product;
  kind: "status" | "remove-image";
  busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
}

export function ProductStatusConfirmDialog({
  product,
  kind,
  busy,
  onSave,
  onCancel,
}: ProductStatusConfirmDialogProps) {
  const [error, setError] = useState("");
  const saving = useRef(false);

  const removing = kind === "remove-image";
  const destructive = removing || product.isActive;

  const actionLabel = removing
    ? "Retirar imagen"
    : product.isActive
      ? "Desactivar"
      : "Activar";

  async function confirm() {
    if (busy || saving.current) return;

    saving.current = true;
    setError("");

    try {
      await onSave(
        removing
          ? {
              kind: "remove-image",
              id: product.id,
            }
          : {
              kind: "status",
              id: product.id,
              isActive: !product.isActive,
            }
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar el cambio."
      );
    } finally {
      saving.current = false;
    }
  }

  return (
    <div>
      <div className="product-modal-section">
        <p className="product-confirm-message">
          {removing
            ? "Se retirará únicamente la imagen. El producto y su información se conservarán."
            : product.isActive
              ? "Este producto dejará de estar disponible para nuevas órdenes. Su información histórica se conservará."
              : "Se reactivará el producto. Su disponibilidad también depende de su categoría y área de preparación."}
        </p>

        {error && (
          <div className="product-form-feedback">
            <Alert>{error}</Alert>
          </div>
        )}
      </div>

      <footer className="product-modal-footer">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Volver
        </Button>

        <Button
          size="sm"
          variant={destructive ? "danger" : "primary"}
          loading={busy}
          loadingText="Guardando…"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {removing ? (
            <Trash2 size={16} aria-hidden="true" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}

          {actionLabel}
        </Button>
      </footer>
    </div>
  );
}
