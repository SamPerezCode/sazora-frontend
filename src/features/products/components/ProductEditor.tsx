import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import type { Product } from "../schemas/product.schema";
import type {
  ProductActionKind,
  ProductMutation,
} from "../schemas/product-action.schema";
import type { Category } from "../../categories/schemas/category.schema";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import { useProductDetail } from "../hooks/useProductDetail";
import { ProductDetail } from "./ProductDetail";
import { ProductForm } from "./ProductForm";

interface ProductEditorProps {
  product: Product;
  editing: boolean;
  token: string;
  products: readonly Product[];
  categories: readonly Category[];
  areas: readonly PreparationArea[];
  busy: boolean;
  onSave: (action: ProductMutation) => Promise<void>;
  onCancel: () => void;
  onAction: (kind: ProductActionKind, product: Product) => void;
}

export function ProductEditor({
  product,
  editing,
  token,
  products,
  categories,
  areas,
  busy,
  onSave,
  onCancel,
  onAction,
}: ProductEditorProps) {
  const detail = useProductDetail(
    product.id,
    product.isCombo,
    product.businessId,
    token
  );

  if (detail.error) {
    return (
      <div className="product-modal-section">
        <Alert>
          <p>{detail.error}</p>

          <Button
            size="sm"
            variant="secondary"
            onClick={detail.retry}
          >
            Reintentar detalle
          </Button>
        </Alert>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div className="product-modal-section">
        <LoadingState message="Cargando detalle…" />
      </div>
    );
  }

  return editing ? (
    <ProductForm
      original={detail.data}
      summary={product}
      isCombo={product.isCombo}
      products={products}
      categories={categories}
      areas={areas}
      busy={busy}
      onSave={onSave}
      onCancel={onCancel}
      onInventory={() => onAction("inventory", product)}
    />
  ) : (
    <ProductDetail
      detail={detail.data}
      summary={product}
      busy={busy}
      onClose={onCancel}
      onAction={onAction}
    />
  );
}
