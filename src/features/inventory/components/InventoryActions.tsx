import {
  Eye,
  History,
  Link2,
  Pencil,
  Power,
  SlidersHorizontal,
} from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import type { InventoryItem } from "../schemas/inventory.schema";

export type InventoryAction =
  | "detail"
  | "edit"
  | "movement"
  | "history"
  | "links"
  | "status";

interface Props {
  item: InventoryItem;
  onAction: (action: InventoryAction, item: InventoryItem) => void;
}

export function InventoryActions({ item, onAction }: Props) {
  return (
    <ActionMenu
      label={`Acciones de ${item.name}`}
      appearance="compact"
      actions={[
        {
          id: "detail",
          label: "Ver detalle",
          icon: <Eye size={16} />,
          onSelect: () => onAction("detail", item),
        },
        {
          id: "edit",
          label: "Editar información",
          icon: <Pencil size={16} />,
          onSelect: () => onAction("edit", item),
        },
        {
          id: "movement",
          label: "Registrar movimiento",
          icon: <SlidersHorizontal size={16} />,
          onSelect: () => onAction("movement", item),
        },
        {
          id: "history",
          label: "Ver movimientos",
          icon: <History size={16} />,
          onSelect: () => onAction("history", item),
        },
        {
          id: "links",
          label: "Gestionar consumo por producto",
          icon: <Link2 size={16} />,
          onSelect: () => onAction("links", item),
        },
        {
          id: "status",
          label: item.isActive ? "Desactivar" : "Activar",
          icon: <Power size={16} />,
          danger: item.isActive,
          separatorBefore: true,
          onSelect: () => onAction("status", item),
        },
      ]}
    />
  );
}
