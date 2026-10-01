import {
  Boxes,
  ImagePlus,
  ListTree,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind } from "../schemas/product-action.schema";

interface ProductActionsProps {
  product: Product;
  disabled?: boolean;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

export function ProductActions({
  product,
  disabled,
  onAction,
}: ProductActionsProps) {
  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil size={16} aria-hidden="true" />,
      onSelect: () => onAction("edit", product),
    },
    {
      id: "image",
      label: "Imagen",
      icon: <ImagePlus size={16} aria-hidden="true" />,
      onSelect: () => onAction("image", product),
    },
    {
      id: "status",
      label: product.isActive ? "Desactivar" : "Activar",
      icon: product.isActive ? (
        <ToggleRight size={20} aria-hidden="true" />
      ) : (
        <ToggleLeft size={20} aria-hidden="true" />
      ),
      onSelect: () => onAction("status", product),
    },
  ];

  if (
    !product.isCombo &&
    product.isActive &&
    !product.hasInventory &&
    product.inventoryTrackingType === "NONE"
  ) {
    actions.push({
      id: "inventory",
      label: "Configurar inventario",
      icon: <Boxes size={16} aria-hidden="true" />,
      onSelect: () => onAction("inventory", product),
    });
  }

  if (product.isCombo) {
    actions.push({
      id: "combo",
      label: "Ver composición",
      icon: <ListTree size={16} aria-hidden="true" />,
      onSelect: () => onAction("combo", product),
    });
  }

  return (
    <ActionMenu
      label={`Acciones de ${product.name}`}
      disabled={disabled}
      actions={actions}
    />
  );
}
