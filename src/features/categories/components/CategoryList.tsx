import { useId, useState } from "react";
import { Plus, Search, Tags } from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import {
  CategoryActions,
  CategoryIdentity,
  CategoryStatus,
  CategoryTable,
} from "./CategoryTable";
import type { Category } from "../schemas/category.schema";

interface CategoryListProps {
  categories: readonly Category[];
  disabled: boolean;
  onCreate: () => void;
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
  onCreate,
  onEdit,
  onImage,
  onToggle,
}: CategoryListProps) {
  const [query, setQuery] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listId = useId();
  const resultId = useId();

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

  function clearSearch() {
    setQuery("");
    setRequestedPage(1);
  }

  return (
    <section
      className="categories-list"
      aria-label="Listado de categorías"
    >
      <div className="categories-toolbar">
        <div className="categories-toolbar-search">
          <TextField
            type="search"
            label="Buscar categorías"
            placeholder="Nombre o descripción"
            icon={Search}
            value={query}
            disabled={disabled}
            aria-controls={listId}
            aria-describedby={resultId}
            onChange={(event) => {
              setQuery(event.target.value);
              setRequestedPage(1);
            }}
          />
        </div>

        <Button
          className="categories-toolbar-create"
          disabled={disabled}
          onClick={onCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Nueva categoría
        </Button>
      </div>

      <p
        id={resultId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {filtered.length} de {categories.length} categorías.
      </p>

      <div id={listId}>
        {visible.length === 0 ? (
          <div className="categories-empty">
            <Tags size={28} aria-hidden="true" />

            <p>
              {categories.length === 0
                ? "Todavía no tienes categorías. Crea la primera para organizar tus productos."
                : "No encontramos categorías con esa búsqueda."}
            </p>

            {search && (
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={clearSearch}
              >
                Limpiar búsqueda
              </Button>
            )}
          </div>
        ) : (
          <>
            <CategoryTable
              categories={visible}
              disabled={disabled}
              onEdit={onEdit}
              onImage={onImage}
              onToggle={onToggle}
            />

            <ul className="categories-mobile">
              {visible.map((category) => (
                <li key={category.id} className="category-card">
                  <div className="category-card-header">
                    <CategoryIdentity category={category} />

                    <CategoryActions
                      category={category}
                      disabled={disabled}
                      onEdit={onEdit}
                      onImage={onImage}
                      onToggle={onToggle}
                    />
                  </div>

                  <p className="category-description">
                    {category.description || "Sin descripción"}
                  </p>

                  <div className="category-card-footer">
                    <p className="category-card-order">
                      Orden
                      <strong>{category.displayOrder}</strong>
                    </p>

                    <CategoryStatus category={category} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {filtered.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={
            filtered.length === 1 ? "categoría" : "categorías"
          }
          totalLabel={
            search
              ? `Total: ${categories.length} categorías`
              : undefined
          }
          disabled={disabled}
          controlsId={listId}
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
