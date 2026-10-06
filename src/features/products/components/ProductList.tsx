import { useId, useState } from "react";
import { PackageOpen, Plus, Search } from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { resolveFileUrl } from "../../../lib/files";
import type { Category } from "../../categories/schemas/category.schema";
import type { Product } from "../schemas/product.schema";
import type { ProductActionKind } from "../schemas/product-action.schema";
import {
  filterProducts,
  formatProductPrice,
} from "../utils/product-list";
import { ProductActions } from "./ProductActions";
import { ProductStatus } from "./ProductStatus";

interface ProductListProps {
  products: readonly Product[];
  categories: readonly Category[];
  disabled: boolean;
  onCreate: () => void;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

const fulfillmentLabels: Record<Product["fulfillmentMode"], string> =
  {
    PREPARE_TO_ORDER: "Preparado al momento",
    READY_TO_SERVE: "Listo para entregar",
  };

const inventoryLabels: Record<
  Product["inventoryTrackingType"],
  string
> = {
  NONE: "Sin control de inventario",
  RESALE: "Inventario · Reventa",
  PRODUCTION: "Inventario · Producción",
  COMBO: "Inventario · Combo",
  CUSTOM: "Inventario · Configuración avanzada",
};

function ProductThumbnail({ product }: { product: Product }) {
  const src = resolveFileUrl(product.imageUrl);
  const [failedSource, setFailedSource] = useState<string | null>(
    null
  );

  return (
    <span className="product-thumbnail" aria-hidden="true">
      {src && src !== failedSource ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <PackageOpen size={20} strokeWidth={1.7} />
      )}
    </span>
  );
}

function ProductIdentity({ product }: { product: Product }) {
  return (
    <div className="product-identity">
      <ProductThumbnail product={product} />

      <div className="product-identity-copy">
        <p className="product-name">{product.name}</p>
        <p className="product-secondary">
          {product.sku || "Sin código"}
        </p>
      </div>
    </div>
  );
}

function ProductCategory({ product }: { product: Product }) {
  return (
    <div className="product-info">
      <p className="product-primary">{product.categoryName}</p>
      <p className="product-secondary">
        {product.preparationAreaName}
      </p>
    </div>
  );
}

function ProductOperation({ product }: { product: Product }) {
  return (
    <div className="product-info">
      <p className="product-operation-line">
        <span className="product-kind">
          {product.isCombo ? "Combo" : "Normal"}
        </span>
        <span aria-hidden="true"> · </span>
        <span>{fulfillmentLabels[product.fulfillmentMode]}</span>
      </p>

      <p className="product-secondary">
        {product.hasInventory
          ? inventoryLabels[product.inventoryTrackingType]
          : "Sin inventario configurado"}
      </p>
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
    <section
      className="products-list"
      aria-label="Listado de productos"
    >
      <div className="products-toolbar">
        <div className="products-toolbar-search">
          <TextField
            type="search"
            label="Buscar productos"
            placeholder="Nombre, SKU, categoría o área"
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

        <div className="products-toolbar-category">
          <SelectField
            label="Categoría"
            value={categoryId}
            disabled={disabled}
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
                  (category.isActive ? "" : " · Inactiva"),
              })),
            ]}
          />
        </div>

        <Button
          className="products-toolbar-create"
          disabled={disabled}
          onClick={onCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Nuevo producto
        </Button>
      </div>

      <p
        id={resultId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {filtered.length} de {products.length} productos.
      </p>

      <div id={listId}>
        {visible.length === 0 ? (
          <div className="products-empty">
            <PackageOpen size={28} aria-hidden="true" />

            <p>
              {products.length === 0
                ? "Todavía no tienes productos registrados."
                : "No encontramos productos con estos filtros."}
            </p>

            {hasFilters && (
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="products-desktop">
              <table className="products-table">
                <caption className="sr-only">
                  Productos del negocio
                </caption>

                <colgroup>
                  <col className="products-col-identity" />
                  <col className="products-col-category" />
                  <col className="products-col-operation" />
                  <col className="products-col-price" />
                  <col className="products-col-status" />
                  <col className="products-col-actions" />
                </colgroup>

                <thead>
                  <tr>
                    <th scope="col">Producto / SKU</th>
                    <th scope="col">Categoría / Área</th>
                    <th scope="col">Atención / Inventario</th>
                    <th scope="col" className="products-price-cell">
                      Precio
                    </th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((product) => (
                    <tr key={product.id}>
                      <th scope="row">
                        <ProductIdentity product={product} />
                      </th>

                      <td>
                        <ProductCategory product={product} />
                      </td>

                      <td>
                        <ProductOperation product={product} />
                      </td>

                      <td className="products-price-cell">
                        <span className="product-price">
                          {formatProductPrice(product.currentPrice)}
                        </span>
                      </td>

                      <td>
                        <ProductStatus product={product} />
                      </td>

                      <td className="products-actions-cell">
                        <ProductActions
                          product={product}
                          disabled={disabled}
                          onAction={onAction}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="products-mobile">
              {visible.map((product) => (
                <li key={product.id} className="product-card">
                  <div className="product-card-header">
                    <ProductIdentity product={product} />

                    <ProductActions
                      product={product}
                      disabled={disabled}
                      onAction={onAction}
                    />
                  </div>

                  <div className="product-card-info">
                    <ProductCategory product={product} />
                    <ProductOperation product={product} />
                  </div>

                  <div className="product-card-footer">
                    <p className="product-price">
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

      {filtered.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={filtered.length === 1 ? "producto" : "productos"}
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
