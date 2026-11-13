import { TextAreaField } from "../../../components/forms/TextAreaField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { cents } from "../../../lib/money";
import { money } from "../../../lib/money";
import type { CartLine } from "../schemas/public-menu.schema";
import type { PublicProduct } from "../schemas/public-menu.schema";
import { MenuImage } from "./MenuImage";
import { Quantity } from "./Quantity";
import { useState } from "react";

export function ProductDialog({
  product,
  line,
  available,
  currency,
  onClose,
  onSave,
}: {
  product: PublicProduct;
  line?: CartLine;
  available: boolean;
  currency: string;
  onClose: () => void;
  onSave: (quantity: number, notes: string) => void;
}) {
  const [quantity, setQuantity] = useState(line?.quantity ?? 1);
  const [notes, setNotes] = useState(line?.notes ?? "");

  return (
    <BottomSheet
      id="pm-product-dialog"
      open
      variant="modal"
      title={product.name}
      className="pm-dialog pm-dialog--product"
      onClose={onClose}
    >
      <form
        className="pm-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();

          if (available) {
            onSave(quantity, notes.trim());
          }
        }}
      >
        <div className="pm-dialog-content pm-stack">
          <MenuImage
            src={product.imageUrl}
            alt={product.name}
            className="pm-product-cover"
          />

          <div>
            <p className="pm-price">
              {money(product.currentPrice, currency)}
              <small> c/u</small>
            </p>

            {product.description && (
              <p className="pm-muted">{product.description}</p>
            )}
          </div>

          <div className="pm-between">
            <span>Cantidad</span>
            <Quantity
              value={quantity}
              onChange={setQuantity}
              disabled={!available}
            />
          </div>

          <div>
            <TextAreaField
              label="Notas para el producto (opcional)"
              placeholder="Ej. Sin azúcar"
              value={notes}
              maxLength={500}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="pm-counter">{notes.length}/500</p>
          </div>

          {!available && (
            <p role="alert" className="pm-notice">
              Este producto no está disponible para pedir en el punto
              seleccionado.
            </p>
          )}
        </div>

        <div className="pm-dialog-footer">
          <button
            type="submit"
            className="pm-primary pm-between"
            disabled={!available}
          >
            <span>
              {line ? "Actualizar producto" : "Agregar al pedido"}
            </span>
            <span>
              {money(
                cents(product.currentPrice) * BigInt(quantity),
                currency
              )}
            </span>
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
