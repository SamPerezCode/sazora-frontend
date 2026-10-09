import { useCallback, useEffect, useRef, useState } from "react";
import {
  Boxes,
  Eye,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { SelectField } from "../../../components/forms/SelectField";
import { Toggle } from "../../../components/forms/Toggle";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Button } from "../../../components/ui/Button";
import type { AuthSession } from "../../auth/types/auth.types";
import type { Product } from "../../products/schemas/product.schema";
import { getProductDetail } from "../../products/services/product.service";
import type { InventoryItem } from "../schemas/inventory.schema";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  errorText,
  uncertain,
} from "../services/inventory-operations";
import {
  consumptionInputSchema,
  loadLinks,
  loadProducts,
  saveLink,
  setLinkStatus,
} from "../services/inventory-workspace";
import type { ConsumptionLink } from "../services/inventory-workspace";
import {
  formatQuantity,
  itemTypeLabels,
  unitLabels,
} from "../utils/inventory-format";
import {
  InventoryLoadError,
  InventorySkeleton,
} from "./InventoryStates";
import { InventoryWriteDialog } from "./InventoryWriteDialog";

type Editor =
  | {
      kind: "create";
      productId?: string;
    }
  | {
      kind: "edit" | "status";
      link: ConsumptionLink;
    };

export function InventoryConsumption({
  items,
  itemsReady,
  itemsError,
  initialItemId = "",
  initialProductId = "",
  revision,
  onItem,
  onChanged,
}: {
  items: InventoryItem[];
  itemsReady: boolean;
  itemsError: string | null;
  initialItemId?: string;
  initialProductId?: string;
  revision: number;
  onItem: (id: string) => void;
  onChanged: () => void;
}) {
  const { session } = useAppShell();

  const resource = useInventoryQuery(
    "consumption",
    loadLinks,
    revision
  );

  const catalog = useInventoryQuery(
    "inventory-products",
    loadProducts,
    revision
  );

  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);

  const [itemFilter, setItemFilter] = useState(initialItemId);

  const [productFilter, setProductFilter] =
    useState(initialProductId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [blockedData, setBlockedData] = useState<
    ConsumptionLink[] | null
  >(null);

  const writing = useRef<AbortController | null>(null);
  const locked = useRef(false);

  useEffect(() => () => writing.current?.abort(), []);

  const rows = resource.data ?? [];
  const products = catalog.data ?? [];

  const disabled =
    busy ||
    resource.pending ||
    (blockedData !== null && blockedData === resource.data);

  const visible = rows.filter(
    (row) =>
      (!itemFilter || row.inventoryItemId === itemFilter) &&
      (!productFilter || row.productId === productFilter)
  );

  function refreshed() {
    resource.refresh();
    onChanged();
  }

  function closeEditor() {
    setEditor(null);
    refreshed();
  }

  function retryEditor() {
    catalog.refresh();
    refreshed();
  }

  async function toggle(link: ConsumptionLink) {
    if (locked.current || disabled || !link.isActive) {
      return;
    }

    locked.current = true;

    setBusy(true);
    setError("");

    const controller = new AbortController();
    writing.current = controller;

    try {
      await saveLink(
        link.id,
        {
          productId: link.productId,
          inventoryItemId: link.inventoryItemId,
          quantityPerProduct: link.quantityPerProduct,
          autoDeduct: !link.autoDeduct,
        },
        session,
        controller.signal
      );

      controller.signal.throwIfAborted();
      refreshed();
    } catch (cause) {
      if (controller.signal.aborted) return;

      const ambiguous = uncertain(cause);

      if (ambiguous) {
        setBlockedData(resource.data);
      }

      setError(
        ambiguous
          ? "No pudimos confirmar el cambio. Actualiza para consultar el estado real."
          : errorText(cause)
      );
    } finally {
      locked.current = false;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return (
    <>
      <header className="inventory-heading">
        <div>
          <h2>Consumo por producto</h2>
          <p>Define cuánto inventario consume cada unidad vendida.</p>
        </div>

        <div className="inventory-buttons">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            loading={resource.pending}
            onClick={() => {
              resource.refresh();
              catalog.refresh();
            }}
          >
            <RefreshCw size={16} />
            Actualizar
          </Button>

          <Button
            size="sm"
            disabled={disabled || !catalog.data}
            onClick={() =>
              setEditor({
                kind: "create",
                productId: productFilter || undefined,
              })
            }
          >
            <Plus size={16} />
            Crear relación de consumo
          </Button>
        </div>
      </header>

      {(itemFilter || productFilter) && (
        <div className="inventory-message">
          <span>
            Relaciones del{" "}
            {productFilter
              ? "producto #" + productFilter
              : "artículo #" + itemFilter}
            .
          </span>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setItemFilter("");
              setProductFilter("");
            }}
          >
            Ver todas
          </Button>
        </div>
      )}

      {catalog.error && (
        <div className="inventory-message" role="alert">
          <span>
            No pudimos actualizar el catálogo de productos:{" "}
            {catalog.error}
          </span>

          <Button
            size="sm"
            variant="secondary"
            onClick={catalog.refresh}
          >
            Reintentar
          </Button>
        </div>
      )}

      {error && (
        <p className="inventory-message inventory-error" role="alert">
          {error}
        </p>
      )}

      {resource.loading ? (
        <InventorySkeleton />
      ) : !resource.data ? (
        <InventoryLoadError
          message={resource.error}
          status={resource.status}
          busy={resource.pending}
          onRetry={resource.refresh}
        />
      ) : (
        <>
          {resource.error && (
            <p
              className="inventory-message inventory-error"
              role="alert"
            >
              {resource.error} Se conserva la última consulta.
            </p>
          )}

          {visible.length ? (
            <div
              className="inv-data-table"
              aria-busy={busy || resource.pending}
            >
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Artículo de inventario</th>
                    <th>Tipo del artículo</th>
                    <th>Cantidad por producto</th>
                    <th>Unidad</th>
                    <th>Descuento automático</th>
                    <th>Estado</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((link) => {
                    const product = products.find(
                      (value) => value.id === link.productId
                    );

                    return (
                      <tr
                        key={link.id}
                        data-inactive={!link.isActive || undefined}
                      >
                        <td data-label="Producto">
                          <strong>{link.productName}</strong>
                        </td>

                        <td data-label="Artículo">
                          {link.inventoryItemName}
                        </td>

                        <td data-label="Tipo">
                          {itemTypeLabels[link.inventoryItemType]}
                        </td>

                        <td data-label="Cantidad">
                          {formatQuantity(link.quantityPerProduct)}
                        </td>

                        <td data-label="Unidad">
                          {unitLabels[link.baseUnit]}
                        </td>

                        <td data-label="Descuento">
                          <Toggle
                            label={
                              link.autoDeduct ? "Activo" : "Apagado"
                            }
                            checked={link.autoDeduct}
                            aria-label={
                              "Descuento automático de " +
                              link.productName +
                              " / " +
                              link.inventoryItemName
                            }
                            disabled={disabled || !link.isActive}
                            onChange={() => void toggle(link)}
                          />
                        </td>

                        <td data-label="Estado">
                          <span
                            className="inv-link-status"
                            data-active={link.isActive}
                          >
                            {link.isActive ? "Activa" : "Inactiva"}
                          </span>
                        </td>

                        <td>
                          <ActionMenu
                            appearance="compact"
                            label={"Acciones de " + link.productName}
                            disabled={disabled}
                            actions={[
                              {
                                id: "edit",
                                label: "Editar cantidad de consumo",
                                icon: <Pencil size={16} />,
                                onSelect: () =>
                                  setEditor({
                                    kind: "edit",
                                    link,
                                  }),
                              },

                              ...(link.isActive
                                ? [
                                    {
                                      id: "auto",
                                      label:
                                        (link.autoDeduct
                                          ? "Desactivar"
                                          : "Activar") +
                                        " descuento automático",
                                      icon: (
                                        <SlidersHorizontal
                                          size={16}
                                        />
                                      ),
                                      onSelect: () => {
                                        void toggle(link);
                                      },
                                    },
                                  ]
                                : []),

                              ...(product
                                ? [
                                    {
                                      id: "product",
                                      label: "Ver producto",
                                      icon: <Eye size={16} />,
                                      onSelect: () =>
                                        setPreview(product),
                                    },
                                  ]
                                : []),

                              {
                                id: "item",
                                label: "Ver artículo de inventario",
                                icon: <Boxes size={16} />,
                                onSelect: () =>
                                  onItem(link.inventoryItemId),
                              },

                              {
                                id: "status",
                                label: link.isActive
                                  ? "Desactivar relación"
                                  : "Activar relación",
                                icon: <Power size={16} />,
                                danger: link.isActive,
                                separatorBefore: true,
                                onSelect: () =>
                                  setEditor({
                                    kind: "status",
                                    link,
                                  }),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inventory-state" role="status">
              <h3>
                {rows.length
                  ? "No hay relaciones para este filtro"
                  : "Aún no hay relaciones"}
              </h3>

              <p>
                Crea una relación para configurar el consumo de
                inventario.
              </p>
            </div>
          )}
        </>
      )}

      {editor?.kind === "status" ? (
        <InventoryWriteDialog
          title={
            editor.link.isActive
              ? "Desactivar relación"
              : "Activar relación"
          }
          description={
            editor.link.productName +
            " · " +
            editor.link.inventoryItemName
          }
          submitLabel={
            editor.link.isActive
              ? "Desactivar relación"
              : "Activar relación"
          }
          dirty={false}
          onClose={closeEditor}
          onSaved={closeEditor}
          onSave={(signal) =>
            setLinkStatus(
              editor.link.id,
              !editor.link.isActive,
              session,
              signal
            )
          }
        >
          <p>
            {editor.link.isActive
              ? "Esta relación dejará de descontar existencias al vender. El historial se conserva."
              : "Se reactivará la relación con su configuración de descuento automático."}
          </p>
        </InventoryWriteDialog>
      ) : (
        editor && (
          <ConsumptionForm
            key={editor.kind === "edit" ? editor.link.id : "new"}
            link={editor.kind === "edit" ? editor.link : undefined}
            products={products}
            items={items}
            links={rows}
            initialItemId={itemFilter}
            initialProductId={
              editor.kind === "create"
                ? (editor.productId ?? productFilter)
                : editor.link.productId
            }
            lockProduct={
              editor.kind === "create" && !!editor.productId
            }
            ready={
              itemsReady &&
              resource.data !== null &&
              catalog.data !== null &&
              !resource.pending &&
              !catalog.pending &&
              !resource.error &&
              !catalog.error
            }
            loadError={itemsError || resource.error || catalog.error}
            onRetry={retryEditor}
            onClose={closeEditor}
            onSaved={closeEditor}
          />
        )
      )}

      {preview && (
        <ProductPreview
          product={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

function ConsumptionForm({
  link,
  products,
  items,
  links,
  initialItemId,
  initialProductId,
  lockProduct,
  ready,
  loadError,
  onRetry,
  onClose,
  onSaved,
}: {
  link?: ConsumptionLink;
  products: Product[];
  items: InventoryItem[];
  links: ConsumptionLink[];
  initialItemId: string;
  initialProductId: string;
  lockProduct: boolean;
  ready: boolean;
  loadError: string | null;
  onRetry: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAppShell();

  const initial = {
    productId: link?.productId ?? initialProductId,
    inventoryItemId: link?.inventoryItemId ?? initialItemId,
    quantityPerProduct: link?.quantityPerProduct ?? "",
    autoDeduct: link?.autoDeduct ?? true,
  };

  const [draft, setDraft] = useState(initial);

  const update = (patch: Partial<typeof draft>) =>
    setDraft((previous) => ({
      ...previous,
      ...patch,
    }));

  const validation = consumptionInputSchema.safeParse(draft);

  const item = items.find(
    (value) => value.id === draft.inventoryItemId
  );

  const product = products.find(
    (value) => value.id === draft.productId
  );

  const duplicate =
    !link &&
    links.some(
      (value) =>
        value.productId === draft.productId &&
        value.inventoryItemId === draft.inventoryItemId
    );

  const available =
    !!link || (!!item?.isActive && !!product?.isActive);

  const valid =
    ready &&
    !loadError &&
    validation.success &&
    available &&
    !duplicate &&
    (!lockProduct || draft.productId === initialProductId);

  const dirty = JSON.stringify(initial) !== JSON.stringify(draft);

  return (
    <InventoryWriteDialog
      title={
        link
          ? "Editar relación de consumo"
          : "Crear relación de consumo"
      }
      description="Define cuánto inventario consume cada unidad vendida."
      submitLabel={link ? "Guardar cambios" : "Crear relación"}
      dirty={dirty}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onSave={(signal) => {
        if (!valid) {
          throw new Error(
            "Espera la carga y revisa los datos de la relación."
          );
        }

        return saveLink(link?.id ?? null, draft, session, signal);
      }}
    >
      {loadError ? (
        <div className="inv-error" role="alert">
          <p>No pudimos cargar la configuración: {loadError}</p>

          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw size={16} />
            Reintentar
          </Button>
        </div>
      ) : !ready ? (
        <p className="inv-muted" role="status">
          Cargando los datos de inventario…
        </p>
      ) : null}

      {link ? (
        <p>
          <strong>{link.productName}</strong>
          {" · "}
          {link.inventoryItemName}
        </p>
      ) : (
        <>
          {lockProduct ? (
            <div className="inv-note">
              <div>
                <span className="inv-muted">Producto</span>

                <p>
                  <strong>
                    {product?.name ?? "Producto #" + initialProductId}
                  </strong>

                  {product?.sku && <span> · {product.sku}</span>}
                </p>
              </div>
            </div>
          ) : (
            <SelectField
              label="Producto *"
              required
              value={draft.productId}
              options={products
                .filter((value) => value.isActive)
                .map((value) => ({
                  value: value.id,
                  label:
                    value.name + (value.sku ? " · " + value.sku : ""),
                }))}
              onValueChange={(productId) => update({ productId })}
            />
          )}

          <SelectField
            label="Artículo de inventario *"
            required
            value={draft.inventoryItemId}
            options={items
              .filter((value) => value.isActive)
              .map((value) => ({
                value: value.id,
                label:
                  value.name + (value.sku ? " · " + value.sku : ""),
              }))}
            onValueChange={(inventoryItemId) =>
              update({ inventoryItemId })
            }
          />
        </>
      )}

      <label className="inv-consumption-quantity">
        Cantidad consumida por cada unidad vendida *
        <input
          required
          inputMode="decimal"
          placeholder="0,020"
          value={draft.quantityPerProduct}
          onChange={(event) =>
            update({
              quantityPerProduct: event.target.value,
            })
          }
        />
        <span className="inv-muted">
          {item
            ? unitLabels[item.baseUnit]
            : link
              ? unitLabels[link.baseUnit]
              : "Selecciona un artículo"}
        </span>
      </label>

      <div className="inv-line">
        <Toggle
          label="Descontar automáticamente al vender"
          description="Si está apagado, la relación se conserva pero no descuenta existencias."
          checked={draft.autoDeduct}
          onChange={(event) =>
            update({
              autoDeduct: event.target.checked,
            })
          }
        />
      </div>

      {duplicate && (
        <p className="inv-error" role="alert">
          Esta relación ya existe. Edítala o reactívala desde el
          listado.
        </p>
      )}

      {dirty && !validation.success && (
        <p className="inv-error">
          {validation.error.issues[0]?.message}
        </p>
      )}

      {ready && lockProduct && !product?.isActive ? (
        <p className="inv-error" role="alert">
          Este producto no existe o está inactivo. No se puede crear
          la relación.
        </p>
      ) : ready && !available ? (
        <p className="inv-muted">
          {lockProduct
            ? "Selecciona un artículo de inventario activo."
            : "Selecciona un producto y un artículo activos."}
        </p>
      ) : null}
    </InventoryWriteDialog>
  );
}

function ProductPreview({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const loader = useCallback(
    async (session: AuthSession, signal: AbortSignal) => {
      const result = await getProductDetail(
        product.id,
        product.isCombo,
        session.accessToken,
        signal
      );

      if (result.businessId !== session.business.id) {
        throw new Error("El producto no corresponde al negocio.");
      }

      return result;
    },
    [product.id, product.isCombo]
  );

  const resource = useInventoryQuery(
    "inventory-product:" + product.id,
    loader
  );

  return (
    <BottomSheet
      id={"inventory-product-" + product.id}
      open
      variant="modal"
      title="Detalle del producto"
      className="inv-dialog inv-centered"
      onClose={onClose}
    >
      <div className="inv-dialog-body">
        {resource.loading ? (
          <p role="status">Cargando producto…</p>
        ) : !resource.data ? (
          <InventoryLoadError
            message={resource.error}
            status={resource.status}
            busy={resource.pending}
            onRetry={resource.refresh}
          />
        ) : (
          <>
            <h3>{resource.data.name}</h3>

            <p className="inv-muted">
              {resource.data.description || "Sin descripción"}
            </p>

            <dl className="inv-summary">
              <div>
                <dt>SKU</dt>
                <dd>{resource.data.sku || "Sin SKU"}</dd>
              </div>

              <div>
                <dt>Precio</dt>
                <dd>
                  $ {formatQuantity(resource.data.currentPrice)}
                </dd>
              </div>

              <div>
                <dt>Categoría</dt>
                <dd>{product.categoryName}</dd>
              </div>

              <div>
                <dt>Estado</dt>
                <dd>
                  {resource.data.isActive ? "Activo" : "Inactivo"}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <footer className="inv-dialog-footer">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </footer>
    </BottomSheet>
  );
}
