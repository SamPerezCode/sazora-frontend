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

export function CategoryTable({
  categories,
  disabled,
  onEdit,
  onImage,
  onToggle,
}: CategoryTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-xl lg:block">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Listado de categorías</caption>

        <colgroup>
          <col className="w-20" />
          <col className="w-[32%]" />
          <col />
          <col className="w-32" />
          <col className="w-24" />
        </colgroup>

        <thead className="border-b border-outline/60 bg-secondary/30">
          <tr className="text-[0.6875rem] uppercase tracking-wide text-muted">
            <th
              scope="col"
              className="px-4 py-3 text-center font-medium"
            >
              Orden
            </th>

            <th scope="col" className="px-4 py-3 font-medium">
              Categoría
            </th>

            <th scope="col" className="px-4 py-3 font-medium">
              Descripción
            </th>

            <th scope="col" className="px-4 py-3 font-medium">
              Estado
            </th>

            <th
              scope="col"
              className="px-3 py-3 text-center font-medium"
            >
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-outline/40">
          {categories.map((category) => (
            <tr
              key={category.id}
              className="transition-colors hover:bg-secondary/30"
            >
              <td className="px-4 py-4 align-middle text-center text-xs font-semibold text-accent">
                {category.displayOrder}
              </td>

              <th
                scope="row"
                className="px-4 py-4 align-middle font-normal"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={category.name}
                    src={resolveFileUrl(category.imageUrl)}
                    size="md"
                  />

                  <p className="min-w-0 text-sm font-semibold text-heading [overflow-wrap:anywhere]">
                    {category.name}
                  </p>
                </div>
              </th>

              <td className="px-4 py-4 align-middle text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
                {category.description || "Sin descripción"}
              </td>

              <td className="px-4 py-4 align-middle">
                <span
                  className={[
                    "inline-flex items-center gap-1.5 whitespace-nowrap",
                    "rounded-full bg-secondary/60 px-2 py-1",
                    "text-xs font-medium",
                    category.isActive ? "text-heading" : "text-muted",
                  ].join(" ")}
                >
                  {category.isActive ? (
                    <CircleCheck
                      aria-hidden="true"
                      size={14}
                      className="shrink-0 text-accent"
                    />
                  ) : (
                    <CircleSlash
                      aria-hidden="true"
                      size={14}
                      className="shrink-0"
                    />
                  )}

                  {category.isActive ? "Activa" : "Inactiva"}
                </span>
              </td>

              <td className="px-3 py-4 align-middle">
                <div className="flex justify-center">
                  <ActionMenu
                    label={`Acciones de ${category.name}`}
                    disabled={disabled}
                    actions={[
                      {
                        id: "edit",
                        label: "Editar",
                        icon: <Pencil aria-hidden="true" size={16} />,
                        onSelect: () => onEdit(category.id),
                      },
                      {
                        id: "image",
                        label: "Imagen",
                        icon: (
                          <ImagePlus aria-hidden="true" size={16} />
                        ),
                        onSelect: () => onImage(category.id),
                      },
                      {
                        id: "status",
                        label: category.isActive
                          ? "Desactivar"
                          : "Activar",
                        icon: category.isActive ? (
                          <ToggleRight aria-hidden="true" size={20} />
                        ) : (
                          <ToggleLeft aria-hidden="true" size={20} />
                        ),
                        onSelect: () => {
                          void onToggle(
                            category.id,
                            !category.isActive
                          );
                        },
                      },
                    ]}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
