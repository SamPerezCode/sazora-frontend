import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useAppShell } from "../../../app/layout/shell-context";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { Product } from "../schemas/product.schema";
import type {
  ProductActionKind,
  ProductMutation,
} from "../schemas/product-action.schema";
import { ProductList } from "../components/ProductList";
import { ProductCreateForm } from "../components/ProductCreateForm";
import { ProductDataForm } from "../components/ProductDataForm";
import { ProductImageForm } from "../components/ProductImageForm";
import { ComboDetails } from "../components/ComboDetails";
import { useProducts } from "../hooks/useProducts";

type Editor =
  | { kind: "create" }
  | {
      kind: Exclude<ProductActionKind, "status">;
      product: Product;
    };

export function ProductsPage() {
  const { session } = useAppShell();

  return (
    <ProductsContent
      key={`${session.business.id}:${session.membership.id}:${session.accessToken}`}
      session={session}
    />
  );
}

function ProductsContent({ session }: { session: AuthSession }) {
  const resource = useProducts(session);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const modalId = useId();
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(action: ProductMutation) {
    const warning = await resource.mutate(action);

    if (!alive.current) return;

    setEditor(null);
    setNotice({
      error: !!warning,
      message:
        warning ??
        (action.kind === "create"
          ? "Producto creado."
          : action.kind === "status"
            ? action.isActive
              ? "Producto activado."
              : "Producto desactivado."
            : "Cambios guardados."),
    });
  }

  function handleAction(kind: ProductActionKind, product: Product) {
    if (resource.busy) return;

    setNotice(null);

    if (kind === "status") {
      void save({
        kind: "status",
        id: product.id,
        isActive: !product.isActive,
      }).catch((error: unknown) => {
        if (alive.current) {
          setNotice({
            error: true,
            message:
              error instanceof ApiError
                ? error.message
                : "No pudimos cambiar el estado.",
          });
        }
      });
    } else {
      setEditor({ kind, product });
    }
  }

  return (
    <div className="products-page">
      {resource.loading && (
        <div className="py-10">
          <LoadingState message="Cargando productos…" />
        </div>
      )}

      {resource.error && (
        <Alert>
          <p>{resource.error}</p>

          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={resource.retry}
          >
            Reintentar
          </Button>
        </Alert>
      )}

      {resource.data && (
        <ProductList
          products={resource.data.products}
          categories={resource.data.categories}
          disabled={resource.busy || !!editor}
          onAction={handleAction}
          onCreate={() => {
            setNotice(null);
            setEditor({ kind: "create" });
          }}
        />
      )}

      {notice && (
        <div className="fixed inset-x-4 bottom-24 z-40 sm:left-auto sm:bottom-6 sm:w-96">
          <Alert variant={notice.error ? "error" : "success"}>
            {notice.message}
          </Alert>
        </div>
      )}

      {editor && resource.data && (
        <BottomSheet
          id={modalId}
          open
          variant="modal"
          busy={resource.busy}
          className="products-page"
          title={
            editor.kind === "create"
              ? "Nuevo producto"
              : editor.kind === "edit"
                ? "Editar producto"
                : editor.kind === "image"
                  ? "Imagen del producto"
                  : editor.kind === "inventory"
                    ? "Configurar inventario"
                    : "Composición del combo"
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind === "create" ? (
            <ProductCreateForm
              categories={resource.data.categories}
              areas={resource.data.areas}
              busy={resource.busy}
              onSave={save}
              onCancel={() => setEditor(null)}
            />
          ) : editor.kind === "image" ? (
            <ProductImageForm
              product={editor.product}
              busy={resource.busy}
              onSave={save}
              onCancel={() => setEditor(null)}
            />
          ) : editor.kind === "combo" ? (
            <ComboDetails
              key={editor.product.id}
              product={editor.product}
              accessToken={session.accessToken}
            />
          ) : (
            <ProductDataForm
              key={`${editor.kind}:${editor.product.id}`}
              kind={editor.kind}
              product={editor.product}
              categories={resource.data.categories}
              areas={resource.data.areas}
              busy={resource.busy}
              onSave={save}
              onCancel={() => setEditor(null)}
            />
          )}
        </BottomSheet>
      )}
    </div>
  );
}
