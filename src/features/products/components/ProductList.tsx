import { useId, useState } from "react";
import { Plus, Search } from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { resolveFileUrl } from "../../../lib/files";
import type { Category } from "../../categories/schemas/category.schema";
import type { Product } from "../schemas/product.schema";
import { SelectField } from "../../../components/forms/SelectField";
import { ProductActions } from "./ProductActions";
import type { ProductActionKind } from "../schemas/product-action.schema";
import {
  filterProducts,
  formatProductPrice,
} from "../utils/product-list";
import { ProductStatus } from "./ProductStatus";

interface ProductListProps {
  products: readonly Product[];
  categories: readonly Category[];
  disabled: boolean;
  onCreate: () => void;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

function ProductIdentity({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        name={product.name}
        src={resolveFileUrl(product.imageUrl)}
        size="list"
      />

      <div className="min-w-0">
        <p className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
          {product.name}
        </p>

        <p className="mt-1 text-[0.6875rem] text-muted [overflow-wrap:anywhere]">
          {product.sku || "Sin código"}
          {product.isCombo && " · Combo"}
        </p>
      </div>
    </div>
  );
}

export function ProductList({
  products,
  categories,
  disabled,
  onCreate,
  onAction,
}: ProductListProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listId = useId();
  const resultId = useId();

  const filtered = filterProducts(products, query, categoryId);

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const hasFilters = query.trim() !== "" || categoryId !== "";

  function clearFilters() {
    setQuery("");
    setCategoryId("");
    setRequestedPage(1);
  }

  return (
    <section className="space-y-4" aria-label="Listado de productos">
      <div className="w-full min-w-0">
        {" "}
        <div className="products-toolbar">
          <div className="products-toolbar-category">
            <SelectField
              label="Categoría"
              value={categoryId}
              describedBy={resultId}
              onValueChange={(value) => {
                setCategoryId(value);
                setRequestedPage(1);
              }}
              options={[
                { value: "", label: "Todas las categorías" },
                ...categories.map((category) => ({
                  value: category.id,
                  label:
                    category.name +
                    (category.isActive ? "" : " (inactiva)"),
                })),
              ]}
            />
          </div>

          <div className="products-toolbar-search">
            <TextField
              type="search"
              label="Buscar productos"
              placeholder="Nombre, código, categoría o área"
              icon={Search}
              value={query}
              aria-controls={listId}
              aria-describedby={resultId}
              onChange={(event) => {
                setQuery(event.target.value);
                setRequestedPage(1);
              }}
            />
          </div>

          <Button
            className="products-toolbar-create whitespace-nowrap"
            disabled={disabled}
            onClick={onCreate}
          >
            <Plus aria-hidden="true" size={14} className="shrink-0" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <p
        id={resultId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-xs text-muted"
      >
        {hasFilters
          ? `${filtered.length} de ${products.length} productos`
          : `${products.length} ${
              products.length === 1 ? "producto" : "productos"
            } · ${categories.length} ${
              categories.length === 1 ? "categoría" : "categorías"
            }`}
      </p>

      <div
        id={listId}
        className="rounded-xl border border-outline/60 bg-surface/50"
      >
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted">
              {products.length === 0
                ? "Todavía no tienes productos registrados."
                : "No encontramos productos con estos filtros."}
            </p>

            {hasFilters && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-4"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Tabla de desktop */}
            <div className="hidden overflow-hidden rounded-xl lg:block">
              <table className="w-full table-fixed text-left">
                <caption className="sr-only">
                  Productos del negocio
                </caption>

                <colgroup>
                  <col className="w-[28%]" />
                  <col />
                  <col />
                  <col className="w-32" />
                  <col className="w-36" />
                  <col className="w-24" />
                </colgroup>

                <thead className="border-b border-outline/60 bg-secondary/30">
                  <tr className="text-[0.6875rem] uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Producto
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Categoría
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Área
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Precio
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
                  {visible.map((product) => (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-secondary/30"
                    >
                      <th
                        scope="row"
                        className="px-4 py-4 font-normal"
                      >
                        <ProductIdentity product={product} />
                      </th>

                      <td className="px-4 py-4 text-xs text-muted [overflow-wrap:anywhere]">
                        {product.categoryName}
                      </td>

                      <td className="px-4 py-4 text-xs text-muted [overflow-wrap:anywhere]">
                        {product.preparationAreaName}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-heading [overflow-wrap:anywhere]">
                        {formatProductPrice(product.currentPrice)}
                      </td>

                      <td className="px-4 py-4">
                        <ProductStatus product={product} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          <ProductActions
                            product={product}
                            disabled={disabled}
                            onAction={onAction}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas de móvil */}
            <ul className="divide-y divide-outline/40 px-3 lg:hidden">
              {visible.map((product) => (
                <li key={product.id} className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <ProductIdentity product={product} />
                    </div>

                    <ProductActions
                      product={product}
                      disabled={disabled}
                      onAction={onAction}
                    />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[0.625rem] uppercase tracking-wide text-muted">
                        Categoría
                      </dt>
                      <dd className="mt-1 text-heading [overflow-wrap:anywhere]">
                        {product.categoryName}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-[0.625rem] uppercase tracking-wide text-muted">
                        Área
                      </dt>
                      <dd className="mt-1 text-heading [overflow-wrap:anywhere]">
                        {product.preparationAreaName}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold tabular-nums text-heading [overflow-wrap:anywhere]">
                      <span className="sr-only">Precio: </span>
                      {formatProductPrice(product.currentPrice)}
                    </p>

                    <ProductStatus product={product} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {products.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={filtered.length === 1 ? "producto" : "productos"}
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
