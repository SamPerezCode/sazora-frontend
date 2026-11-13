import { useAppShell } from "../../../app/layout/shell-context";
import { hasPermission } from "../../auth/utils/permissions";
import {
  Boxes,
  Eye,
  ImagePlus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
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
  const { session } = useAppShell();
  const canManage = hasPermission(session, "catalog.manage");
  const canInventory =
    hasPermission(session, "inventory.items.read") &&
    hasPermission(session, "inventory.links.manage");

  const actions = [
    {
      id: "detail",
      label: "Ver detalle",
      icon: <Eye size={16} />,
      onSelect: () => onAction("detail", product),
    },
    {
      id: "edit",
      disabled: !canManage,
      label: "Editar",
      icon: <Pencil size={16} />,
      onSelect: () => onAction("edit", product),
    },
    {
      id: "image",
      disabled: !canManage,
      label: "Cambiar imagen",
      icon: <ImagePlus size={16} />,
      onSelect: () => onAction("image", product),
    },
    ...(product.imageUrl
      ? [
          {
            id: "remove-image",
            disabled: !canManage,
            label: "Retirar imagen",
            icon: <Trash2 size={16} />,
            danger: true,
            onSelect: () => onAction("remove-image", product),
          },
        ]
      : []),
    {
      id: "inventory",
      disabled: product.isCombo ? !canManage : !canInventory,
      label: product.isCombo
        ? "Editar composición"
        : product.hasInventory
          ? "Gestionar en Inventario"
          : "Configurar en Inventario",
      icon: <Boxes size={16} />,
      onSelect: () =>
        onAction(product.isCombo ? "edit" : "inventory", product),
    },
    {
      id: "status",
      disabled: !canManage,
      label: product.isActive ? "Desactivar" : "Activar",
      icon: product.isActive ? (
        <ToggleRight size={18} />
      ) : (
        <ToggleLeft size={18} />
      ),
      danger: product.isActive,
      separatorBefore: true,
      onSelect: () => onAction("status", product),
    },
  ];

  return (
    <ActionMenu
      label={`Acciones de ${product.name}`}
      appearance="compact"
      disabled={disabled}
      actions={actions}
    />
  );
}
