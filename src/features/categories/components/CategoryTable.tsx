import {
  CircleCheck,
  CircleSlash,
  ImagePlus,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Avatar } from "../../../components/ui/Avatar";
import { resolveFileUrl } from "../../../lib/files";
import type { Category } from "../schemas/category.schema";

interface CategoryTableProps {
  categories: readonly Category[];
  disabled: boolean;
  onEdit: (id: string) => void;
  onImage: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}

interface CategoryActionsProps {
  category: Category;
  disabled: boolean;
  onEdit: (id: string) => void;
  onImage: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}

export function CategoryIdentity({
  category,
}: {
  category: Category;
}) {
  return (
    <div className="category-identity">
      <span className="category-thumbnail">
        <Avatar
          name={category.name}
          src={resolveFileUrl(category.imageUrl)}
          size="md"
        />
      </span>

      <p className="category-name">{category.name}</p>
    </div>
  );
}

export function CategoryStatus({ category }: { category: Category }) {
  const Icon = category.isActive ? CircleCheck : CircleSlash;

  return (
    <span
      className="category-status"
      data-inactive={!category.isActive}
    >
      <Icon size={13} aria-hidden="true" />
      <span>{category.isActive ? "Activa" : "Inactiva"}</span>
    </span>
  );
}

export function CategoryActions({
  category,
  disabled,
  onEdit,
  onImage,
  onToggle,
}: CategoryActionsProps) {
  return (
    <ActionMenu
      label={`Acciones de ${category.name}`}
      appearance="compact"
      disabled={disabled}
      actions={[
        {
          id: "edit",
          label: "Editar",
          icon: <Pencil size={16} aria-hidden="true" />,
          onSelect: () => onEdit(category.id),
        },
        {
          id: "image",
          label: "Imagen",
          icon: <ImagePlus size={16} aria-hidden="true" />,
          onSelect: () => onImage(category.id),
        },
        {
          id: "status",
          label: category.isActive ? "Desactivar" : "Activar",
          icon: category.isActive ? (
            <ToggleRight size={18} aria-hidden="true" />
          ) : (
            <ToggleLeft size={18} aria-hidden="true" />
          ),
          danger: category.isActive,
          separatorBefore: true,
          onSelect: () => {
            void onToggle(category.id, !category.isActive);
          },
        },
      ]}
    />
  );
}

export function CategoryTable({
  categories,
  disabled,
  onEdit,
  onImage,
  onToggle,
}: CategoryTableProps) {
  return (
    <div className="categories-desktop">
      <table className="categories-table">
        <caption className="sr-only">Listado de categorías</caption>

        <colgroup>
          <col className="categories-col-order" />
          <col className="categories-col-name" />
          <col />
          <col className="categories-col-status" />
          <col className="categories-col-actions" />
        </colgroup>

        <thead>
          <tr>
            <th scope="col" className="categories-order-cell">
              Orden
            </th>
            <th scope="col">Categoría</th>
            <th scope="col">Descripción</th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td className="categories-order-cell">
                <span className="category-order">
                  {category.displayOrder}
                </span>
              </td>

              <th scope="row">
                <CategoryIdentity category={category} />
              </th>

              <td>
                <p className="category-description">
                  {category.description || "Sin descripción"}
                </p>
              </td>

              <td>
                <CategoryStatus category={category} />
              </td>

              <td className="categories-actions-cell">
                <CategoryActions
                  category={category}
                  disabled={disabled}
                  onEdit={onEdit}
                  onImage={onImage}
                  onToggle={onToggle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
