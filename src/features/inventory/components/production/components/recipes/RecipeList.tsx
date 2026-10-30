import { Eye, Pencil, Power, PowerOff } from "lucide-react";
import { ActionMenu } from "../../../../../../components/ui/ActionMenu";
import { quantity } from "../../../../utils/inventory-value";
import { timestamp } from "../../utils/production.utils";
import type {
  Recipe,
  RecipeAction,
} from "../../schemas/recipe.schemas";

export function RecipeList({
  rows,
  zone,
  canEdit,
  onAction,
}: {
  rows: Recipe[];
  zone: string;
  canEdit: boolean;
  onAction: (id: string, action: RecipeAction) => void;
}) {
  function menu(row: Recipe) {
    return (
      <ActionMenu
        appearance="compact"
        label={"Acciones de " + row.code}
        actions={[
          {
            id: "detail",
            label: "Ver detalle",
            icon: <Eye size={18} aria-hidden />,
            onSelect: () => onAction(row.id, "detail"),
          },
          ...(canEdit
            ? [
                {
                  id: "edit",
                  label: "Editar",
                  icon: <Pencil size={18} aria-hidden />,
                  onSelect: () => onAction(row.id, "edit"),
                },
                {
                  id: "status",
                  label: row.isActive
                    ? "Desactivar receta"
                    : "Activar receta",
                  icon: row.isActive ? (
                    <PowerOff size={18} aria-hidden />
                  ) : (
                    <Power size={18} aria-hidden />
                  ),
                  danger: row.isActive,
                  separatorBefore: true,
                  onSelect: () => onAction(row.id, "status"),
                },
              ]
            : []),
        ]}
      />
    );
  }

  function fields(row: Recipe) {
    return [
      { label: "Nombre", value: row.name },
      { label: "Insumos", value: row.inputs.length },
      {
        label: "Productos obtenidos",
        value: row.outputs
          .map((line) => line.inventoryItemName)
          .join(" · "),
      },
      {
        label: "Rendimiento por lote",
        value: row.outputs
          .map((line) => quantity(line.quantity, line.baseUnit))
          .join(" · "),
      },
      {
        label: "Estado",
        value: (
          <span
            className={
              row.isActive
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-muted"
            }
          >
            {row.isActive ? "Activa" : "Inactiva"}
          </span>
        ),
      },
      {
        label: "Última actualización",
        value: (
          <>
            <span>{timestamp(row.updatedAt, zone)}</span>
            <span className="mt-1 block text-muted">
              {row.updatedByName}
            </span>
          </>
        ),
      },
    ];
  }

  return (
    <div className="min-w-0">
      <ul
        aria-label="Recetas de producción"
        className="m-0 grid list-none gap-3 p-0 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className="min-w-0 rounded-2xl border border-outline bg-surface p-4 shadow-sm dark:shadow-none"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium [overflow-wrap:anywhere]">
                {row.code}
              </p>

              {menu(row)}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs leading-5">
              {fields(row).map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-muted">{field.label}</dt>

                  <dd className="m-0 [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div
        role="region"
        aria-label="Recetas de producción"
        tabIndex={0}
        className="hidden min-w-0 overflow-x-auto rounded-xl border border-outline focus-visible:outline-2 focus-visible:outline-accent md:block"
      >
        <table className="w-full min-w-[1100px] text-left text-xs leading-4">
          <thead className="bg-secondary/40 text-muted">
            <tr>
              {[
                "Código",
                "Nombre",
                "Insumos",
                "Productos obtenidos",
                "Rendimiento por lote",
                "Estado",
                "Última actualización",
                "Acciones",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="p-3 font-normal"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-surface">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="h-16 border-t border-outline"
              >
                <td className="p-3">{row.code}</td>

                {fields(row).map((field) => (
                  <td
                    key={field.label}
                    className="max-w-[240px] p-3 [overflow-wrap:anywhere]"
                  >
                    {field.value}
                  </td>
                ))}

                <td className="w-20 p-3">{menu(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
