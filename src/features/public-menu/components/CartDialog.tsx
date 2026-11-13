import { BottomSheet } from "../../../components/layout/BottomSheet";
import { cents } from "../../../lib/money";
import { money } from "../../../lib/money";
import type { CartRow } from "../schemas/public-menu.schema";
import type { PublicLocation } from "../schemas/public-menu.schema";
import type { PublicProduct } from "../schemas/public-menu.schema";
import { Quantity } from "./Quantity";
import { Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";

export function CartDialog({
  rows,
  location,
  currency,
  refreshing,
  onClose,
  onQuantity,
  onRemove,
  onEdit,
  onContinue,
  onRefresh,
}: {
  rows: CartRow[];
  location?: PublicLocation;
  currency: string;
  refreshing: boolean;
  onClose: () => void;
  onQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onEdit: (product: PublicProduct) => void;
  onContinue: () => void;
  onRefresh: () => void;
}) {
  const total = rows.reduce(
    (sum, row) =>
      sum + cents(row.product.currentPrice) * BigInt(row.quantity),
    0n
  );

  const valid =
    !!location &&
    rows.length > 0 &&
    rows.every((row) => row.available);

  return (
    <BottomSheet
      id="pm-cart-dialog"
      open
      variant="modal"
      title="Tu pedido"
      className="pm-dialog pm-dialog--cart"
      onClose={onClose}
    >
      <p className="pm-dialog-caption">
        Punto de venta:{" "}
        <strong>{location?.name ?? "Sin seleccionar"}</strong>
      </p>

      <div className="pm-dialog-content pm-stack">
        {rows.length === 0 && (
          <p className="pm-notice">
            Tu pedido está vacío. Agrega productos desde el menú.
          </p>
        )}

        {rows.map((row) => (
          <article className="pm-cart-item" key={row.product.id}>
            <div className="pm-between pm-align-start">
              <div>
                <h3>{row.product.name}</h3>
                <small className="pm-muted">
                  {money(row.product.currentPrice, currency)} c/u
                </small>
              </div>

              <strong>
                {money(
                  cents(row.product.currentPrice) *
                    BigInt(row.quantity),
                  currency
                )}
              </strong>
            </div>

            {row.notes && (
              <p className="pm-item-notes">{row.notes}</p>
            )}

            {!row.available && (
              <p className="pm-error">
                No disponible en este punto. Retíralo o cambia de
                punto de venta.
              </p>
            )}

            <div className="pm-between">
              <Quantity
                value={row.quantity}
                disabled={!row.available}
                onChange={(quantity) =>
                  onQuantity(row.product.id, quantity)
                }
              />

              <div className="pm-inline">
                <button
                  type="button"
                  className="pm-icon-button"
                  aria-label={"Editar " + row.product.name}
                  disabled={!row.available}
                  onClick={() => onEdit(row.product)}
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="pm-icon-button pm-danger"
                  aria-label={"Retirar " + row.product.name}
                  onClick={() => onRemove(row.product.id)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        ))}

        {rows.some((row) => !row.available) && (
          <button
            type="button"
            className="pm-secondary"
            disabled={refreshing}
            onClick={onRefresh}
          >
            {refreshing
              ? "Consultando…"
              : "Actualizar disponibilidad"}
          </button>
        )}
      </div>

      <div className="pm-dialog-footer pm-stack">
        <div>
          <p className="pm-between">
            <strong>Subtotal estimado</strong>
            <strong>{money(total, currency)}</strong>
          </p>
          <small className="pm-muted">
            El negocio confirma los precios al revisar tu solicitud.
          </small>
        </div>

        <button
          type="button"
          className="pm-primary"
          disabled={!valid || refreshing}
          onClick={onContinue}
        >
          Continuar
        </button>
      </div>
    </BottomSheet>
  );
}
