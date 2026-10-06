import { Boxes, Pencil } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { resolveFileUrl } from "../../../lib/files";
import type { Product } from "../schemas/product.schema";
import type {
  CatalogDetail,
  ProductActionKind,
} from "../schemas/product-action.schema";
import { ProductActions } from "./ProductActions";
import { ProductStatus } from "./ProductStatus";
import { formatProductPrice } from "../utils/product-list";

interface ProductDetailProps {
  detail: CatalogDetail;
  summary: Product;
  busy: boolean;
  onClose: () => void;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

const fulfillmentLabels = {
  PREPARE_TO_ORDER: "Preparado al momento",
  READY_TO_SERVE: "Listo para entregar",
};

const inventoryLabels = {
  NONE: "Sin control de inventario",
  RESALE: "Reventa",
  PRODUCTION: "Producción",
  COMBO: "Combo",
  CUSTOM: "Configuración avanzada",
};

export function ProductDetail({
  detail,
  summary,
  busy,
  onClose,
  onAction,
}: ProductDetailProps) {
  const product = { ...summary, ...detail };

  return (
    <div>
      <div className="product-modal-section">
        <div className="product-detail-hero">
          <div className="product-detail-image">
            <Avatar
              name={detail.name}
              src={resolveFileUrl(detail.imageUrl)}
              size="xl"
            />
          </div>

          <div className="product-detail-heading">
            <h3>{detail.name}</h3>

            <p className="product-modal-muted">
              {detail.sku || "Sin código"}
            </p>

            <ProductStatus product={product} />
          </div>

          <ProductActions
            product={product}
            disabled={busy}
            onAction={onAction}
          />
        </div>

        <dl className="product-detail-grid">
          <div>
            <dt>Precio de venta</dt>
            <dd className="product-detail-price">
              {formatProductPrice(detail.currentPrice)}
            </dd>
          </div>

          <div>
            <dt>Tipo</dt>
            <dd>{product.isCombo ? "Combo" : "Normal"}</dd>
          </div>

          <div>
            <dt>Categoría</dt>
            <dd>{summary.categoryName}</dd>
          </div>

          <div>
            <dt>Área de preparación</dt>
            <dd>{summary.preparationAreaName}</dd>
          </div>

          <div>
            <dt>Forma de cumplimiento</dt>
            <dd>{fulfillmentLabels[detail.fulfillmentMode]}</dd>
          </div>

          <div>
            <dt>Inventario</dt>
            <dd>
              {summary.hasInventory
                ? inventoryLabels[summary.inventoryTrackingType]
                : "Sin inventario configurado"}
            </dd>
          </div>
        </dl>

        <section className="product-detail-section">
          <h4>Descripción</h4>
          <p className="product-detail-description">
            {detail.description || "Sin descripción."}
          </p>
        </section>

        {detail.components && (
          <section className="product-detail-section">
            <h4>Componentes del combo</h4>

            <ul className="product-detail-components">
              {detail.components.map((component) => (
                <li key={component.productId}>
                  <span>{component.productName}</span>
                  <strong>× {component.quantity}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="product-inventory-note">
          <p>
            La configuración de inventario se administra por separado.
          </p>

          <button
            type="button"
            className="product-modal-link"
            disabled={busy}
            onClick={() => onAction("inventory", product)}
          >
            <Boxes size={16} aria-hidden="true" />
            {summary.hasInventory
              ? "Gestionar en Inventario"
              : "Configurar en Inventario"}
          </button>
        </div>
      </div>

      <footer className="product-modal-footer">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cerrar
        </Button>

        <Button
          size="sm"
          disabled={busy}
          onClick={() => onAction("edit", product)}
        >
          <Pencil size={16} aria-hidden="true" />
          Editar producto
        </Button>
      </footer>
    </div>
  );
}
