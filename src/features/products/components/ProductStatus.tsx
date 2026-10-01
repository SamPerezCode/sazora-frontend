import { CircleCheck, CircleSlash } from "lucide-react";
import type { Product } from "../schemas/product.schema";

export function ProductStatus({ product }: { product: Product }) {
  const label = !product.isActive
    ? "Inactivo"
    : product.isAvailable
      ? "Disponible"
      : "No disponible";

  const reason = !product.isActive
    ? "Producto desactivado."
    : [
        !product.categoryIsActive ? "Categoría desactivada." : "",
        !product.preparationAreaIsActive ? "Área desactivada." : "",
      ]
        .filter(Boolean)
        .join(" ");

  const Icon = product.isAvailable ? CircleCheck : CircleSlash;

  return (
    <span
      title={reason || label}
      aria-label={reason ? `${label}. ${reason}` : label}
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2 py-1 text-[0.6875rem] font-medium"
    >
      <Icon
        aria-hidden="true"
        size={14}
        className={`shrink-0 ${
          product.isAvailable ? "text-accent" : "text-muted"
        }`}
      />

      <span
        className={
          product.isAvailable ? "text-heading" : "text-muted"
        }
      >
        {label}
      </span>
    </span>
  );
}
