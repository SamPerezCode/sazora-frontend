import { CircleCheck, CircleSlash } from "lucide-react";
import type { Product } from "../schemas/product.schema";

export function ProductStatus({ product }: { product: Product }) {
  const unavailable =
    !product.isActive || product.isAvailable === false;

  const label = !product.isActive
    ? "Inactivo"
    : product.isAvailable === undefined
      ? "Activo"
      : product.isAvailable
        ? "Disponible"
        : "No disponible";

  const reason = !product.isActive
    ? "Producto desactivado."
    : [
        product.categoryIsActive === false
          ? "Categoría desactivada."
          : "",
        product.preparationAreaIsActive === false
          ? "Área desactivada."
          : "",
      ]
        .filter(Boolean)
        .join(" ");

  const Icon = unavailable ? CircleSlash : CircleCheck;

  return (
    <span
      className="product-status"
      data-unavailable={unavailable}
      title={reason || label}
      aria-label={reason ? `${label}. ${reason}` : label}
    >
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
