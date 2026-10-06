import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useAppShell } from "../../../app/layout/shell-context";
import type { AuthSession } from "../../auth/types/auth.types";
import type { Product } from "../schemas/product.schema";
import type {
  ProductActionKind,
  ProductMutation,
} from "../schemas/product-action.schema";
import { ProductList } from "../components/ProductList";
import { ProductForm } from "../components/ProductForm";
import { ProductEditor } from "../components/ProductEditor";
import { ProductImageForm } from "../components/ProductImageForm";
import { ProductStatusConfirmDialog } from "../components/ProductStatusConfirmDialog";
import { productInventoryPath } from "../utils/product-inventory";
import { useProducts } from "../hooks/useProducts";

type Editor =
  | { kind: "create" }
  | {
      kind: Exclude<ProductActionKind, "inventory">;
      id: string;
    };

export function ProductsPage() {
  const { session } = useAppShell();

  if (!session.authorization.roles.includes("ADMIN")) {
    return <Alert>No tienes acceso a Productos.</Alert>;
  }

  return (
    <ProductsContent
      key={`${session.business.id}:${session.membership.id}:${session.accessToken}`}
      session={session}
    />
  );
}

function ProductsContent({ session }: { session: AuthSession }) {
  const resource = useProducts(session);
  const navigate = useNavigate();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);

  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const alive = useRef(false);
  const modalId = useId();

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.error) return;

    const timer = window.setTimeout(() => setNotice(null), 7000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(action: ProductMutation) {
    const warning = await resource.mutate(action);

    if (!alive.current) return;

    setRevision((value) => value + 1);

    setEditor(
      action.kind === "create"
        ? null
        : { kind: "detail", id: action.id }
    );

    setNotice({
      error: !!warning,
      message:
        warning ??
        (action.kind === "create"
          ? "Producto creado. El control de inventario es opcional y se configura desde Inventario."
          : "Cambios guardados."),
    });
  }

  function onAction(kind: ProductActionKind, product: Product) {
    if (resource.busy) return;

    setNotice(null);

    if (kind === "inventory") {
      setEditor(null);

      const path = productInventoryPath(
        product.id,
        product.hasInventory
      );

      if (path) {
        navigate(path);
      } else {
        setNotice({
          error: false,
          message:
            "Inventario todavía no está disponible. La configuración se realizará en ese módulo.",
        });
      }

      return;
    }

    setEditor({ kind, id: product.id });
  }

  const product =
    editor && editor.kind !== "create"
      ? resource.data?.products.find(
          (candidate) => candidate.id === editor.id
        )
      : undefined;

  const title = !editor
    ? ""
    : editor.kind === "create"
      ? "Nuevo producto"
      : editor.kind === "detail"
        ? "Detalle del producto"
        : editor.kind === "edit"
          ? "Editar producto"
          : editor.kind === "image"
            ? "Imagen del producto"
            : editor.kind === "remove-image"
              ? "Retirar imagen"
              : product?.isActive
                ? "Desactivar producto"
                : "Activar producto";

  const modalSize =
    editor?.kind === "create" || editor?.kind === "edit"
      ? "form"
      : editor?.kind === "detail"
        ? "detail"
        : "small";

  const modalDescription =
    editor?.kind === "create"
      ? "Define la información comercial y cómo se atiende el producto."
      : editor?.kind === "edit"
        ? "Datos comerciales, clasificación y forma de atención."
        : editor?.kind === "detail"
          ? "Información comercial y atención del producto."
          : (product?.name ?? "");

  return (
    <div className="products-page">
      {resource.loading && (
        <LoadingState message="Cargando productos…" />
      )}

      {resource.error && (
        <Alert>
          <p>{resource.error}</p>

          <Button
            size="sm"
            variant="secondary"
            disabled={resource.busy}
            onClick={resource.retry}
          >
            Reintentar consulta
          </Button>
        </Alert>
      )}

      {resource.data && (
        <ProductList
          products={resource.data.products}
          categories={resource.data.categories}
          disabled={resource.busy || !!editor}
          onAction={onAction}
          onCreate={() => {
            setNotice(null);
            setEditor({ kind: "create" });
          }}
        />
      )}

      {notice && !editor && (
        <div className="fixed inset-x-4 bottom-24 z-40 sm:bottom-6 sm:left-auto sm:w-96">
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
          title={title}
          busy={resource.busy}
          className={`products-page product-modal product-modal--${modalSize}`}
          onClose={() => setEditor(null)}
        >
          <p className="product-modal-description">
            {modalDescription}
          </p>

          <div className="product-modal-body">
            {notice && (
              <div className="product-modal-notice">
                <Alert variant={notice.error ? "error" : "success"}>
                  {notice.message}
                </Alert>
              </div>
            )}

            {editor.kind === "create" ? (
              <ProductForm
                products={resource.data.products}
                categories={resource.data.categories}
                areas={resource.data.areas}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
              />
            ) : !product ? (
              <div className="product-modal-section">
                <Alert>
                  Este producto ya no aparece en el listado. Actualiza
                  la consulta.
                </Alert>
              </div>
            ) : editor.kind === "image" ? (
              <ProductImageForm
                key={product.id}
                product={product}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
              />
            ) : editor.kind === "status" ||
              editor.kind === "remove-image" ? (
              <ProductStatusConfirmDialog
                key={`${product.id}:${editor.kind}`}
                product={product}
                kind={editor.kind}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
              />
            ) : (
              <ProductEditor
                key={`${product.id}:${editor.kind}:${revision}`}
                product={product}
                editing={editor.kind === "edit"}
                token={session.accessToken}
                products={resource.data.products}
                categories={resource.data.categories}
                areas={resource.data.areas}
                busy={resource.busy}
                onSave={save}
                onCancel={() => setEditor(null)}
                onAction={onAction}
              />
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
