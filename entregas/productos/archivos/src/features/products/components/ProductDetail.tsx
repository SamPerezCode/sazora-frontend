import { Avatar } from "../../../components/ui/Avatar";
import { resolveFileUrl } from "../../../lib/files";
import type { Product } from "../schemas/product.schema";
import type { CatalogDetail, ProductActionKind } from "../schemas/product-action.schema";
import { ProductBadges } from "./ProductBadges";
import { ProductActions } from "./ProductActions";
import { formatProductPrice } from "../utils/product-list";

export function ProductDetail({ detail, summary, busy, onAction }: {
  detail: CatalogDetail; summary: Product; busy: boolean;
  onAction: (kind: ProductActionKind, product: Product) => void;
}) {
  const product = { ...summary, ...detail };
  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <Avatar name={detail.name} src={resolveFileUrl(detail.imageUrl)} size="xl" />
      <ProductActions product={product} disabled={busy} onAction={onAction} />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-heading">{detail.name}</h3>
      <p className="text-sm text-muted">{detail.sku || "Sin código"}</p>
      <ProductBadges product={product} />
    </div>
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div><dt className="text-muted">Precio</dt><dd className="font-semibold text-heading">{formatProductPrice(detail.currentPrice)}</dd></div>
      <div><dt className="text-muted">Estado</dt><dd>{detail.isActive ? "Activo" : "Inactivo"}</dd></div>
      <div><dt className="text-muted">Categoría</dt><dd>{summary.categoryName}</dd></div>
      <div><dt className="text-muted">Área</dt><dd>{summary.preparationAreaName}</dd></div>
    </dl>
    <p className="whitespace-pre-wrap text-sm text-muted">{detail.description || "Sin descripción."}</p>
    {detail.components && <section className="space-y-2">
      <h4 className="font-semibold text-heading">Componentes guardados</h4>
      <ul className="divide-y divide-outline/40">
        {detail.components.map(item => <li key={item.productId} className="flex justify-between gap-3 py-2 text-sm">
          <span>{item.productName}</span><span>× {item.quantity}</span>
        </li>)}
      </ul>
    </section>}
    <p className="text-xs text-muted">El inventario es opcional. Sus existencias y configuración se administran desde Inventario.</p>
  </section>;
}
