import { Boxes, Eye, ImagePlus, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind } from "../schemas/product-action.schema";

export function ProductActions({ product, disabled, onAction }: {
  product: Product; disabled?: boolean;
  onAction: (kind: ProductActionKind, product: Product) => void;
}) {
  const actions = [
    { id: "detail", label: "Ver detalle", icon: <Eye size={16} />, onSelect: () => onAction("detail", product) },
    { id: "edit", label: "Editar", icon: <Pencil size={16} />, onSelect: () => onAction("edit", product) },
    { id: "image", label: "Cambiar imagen", icon: <ImagePlus size={16} />, onSelect: () => onAction("image", product) },
    ...(product.imageUrl ? [{
      id: "remove-image", label: "Retirar imagen", icon: <Trash2 size={16} />, onSelect: () => onAction("remove-image", product),
    }] : []),
    { id: "inventory", label: product.hasInventory ? "Gestionar en Inventario" : "Configurar en Inventario",
      icon: <Boxes size={16} />, onSelect: () => onAction("inventory", product) },
    { id: "status", label: product.isActive ? "Desactivar" : "Activar",
      icon: product.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />,
      onSelect: () => onAction("status", product) },
  ];
  return <ActionMenu label={`Acciones de ${product.name}`} disabled={disabled} actions={actions} />;
}
