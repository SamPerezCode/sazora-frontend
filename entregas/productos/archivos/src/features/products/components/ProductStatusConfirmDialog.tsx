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
