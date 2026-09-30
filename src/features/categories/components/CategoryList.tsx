import { useId, useState } from "react";
import {
  CircleCheck,
  CircleSlash,
  ImagePlus,
  Pencil,
  Search,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Avatar } from "../../../components/ui/Avatar";
import { Pagination } from "../../../components/ui/Pagination";
import { resolveFileUrl } from "../../../lib/files";
import { CategoryTable } from "./CategoryTable";
import type { Category } from "../schemas/category.schema";

interface CategoryListProps {
  categories: readonly Category[];
  disabled: boolean;
  onEdit: (id: string) => void;
  onImage: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function CategoryList({
  categories,
  disabled,
  onEdit,
  onImage,
  onToggle,
}: CategoryListProps) {
  const [query, setQuery] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listId = useId();
  const summaryId = useId();

  const search = normalizeSearch(query);

  const filtered = categories.filter((category) =>
    normalizeSearch(
      `${category.name} ${category.description ?? ""}`
    ).includes(search)
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  return (
    <section
      className="mt-4 space-y-4"
      aria-label="Listado de categorías"
    >
      <div className="w-full lg:max-w-[30.5rem]">
        <TextField
          type="search"
          label="Buscar categorías"
          placeholder="Nombre o descripción"
          icon={Search}
          value={query}
          disabled={disabled}
          aria-controls={listId}
          aria-describedby={
            categories.length > 10 ? summaryId : undefined
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setRequestedPage(1);
          }}
        />
      </div>

      <div
        id={listId}
        className="rounded-xl border border-outline/60 px-3 sm:px-4 lg:px-0"
      >
        {visible.length > 0 && (
          <CategoryTable
            categories={visible}
            disabled={disabled}
            onEdit={onEdit}
            onImage={onImage}
            onToggle={onToggle}
          />
        )}

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {categories.length === 0
              ? "Todavía no tienes categorías. Crea la primera para organizar tus productos."
              : "No encontramos categorías con esa búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-outline/40 lg:hidden">
            {" "}
            {visible.map((category) => (
              <li
                key={category.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
              >
                <div className="col-start-1 row-span-2 row-start-1 sm:row-span-1">
                  <Avatar
                    name={category.name}
                    src={resolveFileUrl(category.imageUrl)}
                    size="list"
                  />
                </div>

                <div className="col-start-2 row-start-1 min-w-0">
                  <p className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
                    {category.name}
                  </p>

                  {category.description && (
                    <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
                      {category.description}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-muted">
                    Orden: {category.displayOrder}
                  </p>
                </div>

                <span className="col-start-2 row-start-2 flex items-center gap-1 text-xs text-muted sm:col-start-3 sm:row-start-1">
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

                <div className="col-start-3 row-span-2 row-start-1 sm:col-start-4 sm:row-span-1">
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
              </li>
            ))}
          </ul>
        )}
      </div>

      {categories.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={
            filtered.length === 1 ? "categoría" : "categorías"
          }
          totalLabel={
            search
              ? `Total: ${categories.length} ${
                  categories.length === 1 ? "categoría" : "categorías"
                }`
              : undefined
          }
          disabled={disabled}
          controlsId={listId}
          summaryId={summaryId}
          onPageChange={setRequestedPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setRequestedPage(1);
          }}
        />
      )}
    </section>
  );
}
