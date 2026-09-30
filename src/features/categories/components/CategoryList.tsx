import { useId, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
import { Button } from "../../../components/ui/Button";
import { resolveFileUrl } from "../../../lib/files";
import type { Category } from "../schemas/category.schema";

interface CategoryListProps {
  categories: readonly Category[];
  disabled: boolean;
  onEdit: (id: string) => void;
  onImage: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}

const PAGE_SIZE = 10;

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
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <section
      className="mt-4 space-y-4"
      aria-label="Listado de categorías"
    >
      <TextField
        type="search"
        label="Buscar categorías"
        placeholder="Nombre o descripción"
        icon={Search}
        value={query}
        disabled={disabled}
        aria-controls={listId}
        aria-describedby={summaryId}
        onChange={(event) => {
          setQuery(event.target.value);
          setRequestedPage(1);
        }}
      />

      <div
        id={listId}
        className="rounded-xl border border-outline/60 px-3 sm:px-4"
      >
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {categories.length === 0
              ? "Todavía no tienes categorías. Crea la primera para organizar tus productos."
              : "No encontramos categorías con esa búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-outline/40">
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

      {pageCount > 1 && (
        <nav
          aria-label="Paginación de categorías"
          className="flex items-center justify-center gap-3"
        >
          <Button
            size="sm"
            variant="secondary"
            className="px-3"
            disabled={disabled || page === 1}
            aria-label="Página anterior"
            title="Página anterior"
            aria-controls={listId}
            onClick={() => setRequestedPage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </Button>

          <span className="text-xs text-muted">
            Página {page} de {pageCount}
          </span>

          <Button
            size="sm"
            variant="secondary"
            className="px-3"
            disabled={disabled || page === pageCount}
            aria-label="Página siguiente"
            title="Página siguiente"
            aria-controls={listId}
            onClick={() => setRequestedPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </Button>
        </nav>
      )}

      <div
        id={summaryId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-1 text-center text-xs text-muted"
      >
        <p>
          {filtered.length > 0
            ? `Mostrando ${start + 1}–${Math.min(
                start + PAGE_SIZE,
                filtered.length
              )} de ${filtered.length}${search ? " resultados" : ""}.`
            : search
              ? "0 resultados."
              : "0 categorías."}
        </p>

        <p>
          Total:{" "}
          <span className="font-medium text-heading">
            {categories.length}
          </span>
          {categories.length === 1 ? " categoría" : " categorías"}
        </p>
      </div>
    </section>
  );
}
