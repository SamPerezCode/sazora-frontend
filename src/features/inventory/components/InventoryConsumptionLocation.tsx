import { useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { hasPermission } from "../../auth/utils/permissions";

import { useInventoryQuery } from "../hooks/useInventoryQuery";

import type { InventoryWorkspace } from "../services/inventory-location.service";

import {
  loadLinks,
  loadProducts,
} from "../services/inventory-workspace";

import { InventoryConsumptionList } from "./InventoryConsumptionList";
import { InventoryCompositionDialog } from "./InventoryCompositionDialog";
import { Button } from "./InventoryButton";
import { Notice } from "./InventoryLocationUI";

import "../inventory-composition.css";

type Props = {
  data: InventoryWorkspace;
  ready: boolean;
  revision: number;
  initialProductId: string;
  initialItemId: string;
  onChanged: () => void;
};

export function InventoryConsumptionLocation({
  data,
  ready,
  revision,
  initialProductId,
  initialItemId,
  onChanged,
}: Props) {
  const { session } = useAppShell();
  const [, setParams] = useSearchParams();

  const resource = useInventoryQuery(
    "consumption-location",
    loadLinks,
    revision
  );

  const catalog = useInventoryQuery(
    "consumption-products",
    loadProducts,
    revision
  );

  const [editor, setEditor] = useState<{
    productId?: string;
  } | null>(null);

  const [notice, setNotice] = useState("");

  const links = resource.data ?? [];
  const products = catalog.data ?? [];

  const pending = resource.pending || catalog.pending;

  const disabled =
    !ready ||
    pending ||
    !!resource.error ||
    !!catalog.error ||
    !resource.data ||
    !catalog.data ||
    !hasPermission(session, "inventory.links.manage");

  const rows = products
    .filter((product) => !product.isCombo)
    .map((product) => ({
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      links: links.filter((link) => link.productId === product.id),
    }))
    .filter(
      (row) =>
        (row.isActive || row.links.length > 0) &&
        (!initialProductId || row.id === initialProductId) &&
        (!initialItemId ||
          row.links.some(
            (link) => link.inventoryItemId === initialItemId
          ))
    );

  function reload() {
    resource.refresh();
    catalog.refresh();
    onChanged();
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[16px] font-bold">
          Consumo por producto
        </h3>

        <Button
          disabled={disabled}
          className="whitespace-normal!"
          onClick={() => {
            setNotice("");
            setEditor({});
          }}
        >
          <Plus size={16} aria-hidden />
          Configurar consumo del producto
        </Button>
      </div>

      {notice && <Notice>{notice}</Notice>}

      {(initialProductId || initialItemId) && (
        <Notice>
          Mostrando la selección actual. Cada producto conserva su
          composición completa.
          <Button
            variant="ghost"
            size="compact"
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);

                for (const key of [
                  "productId",
                  "itemId",
                  "setupProductId",
                  "intent",
                ]) {
                  next.delete(key);
                }

                next.set("tab", "consumption");

                return next;
              })
            }
          >
            Ver todos
          </Button>
        </Notice>
      )}

      {(resource.error || catalog.error) && (
        <Notice>
          {resource.error || catalog.error}{" "}
          <Button variant="ghost" onClick={reload}>
            Actualizar
          </Button>
        </Notice>
      )}

      {pending && <p role="status">Actualizando composición…</p>}

      {!pending &&
        !resource.error &&
        !catalog.error &&
        !rows.length && (
          <Notice>No hay productos para esta selección.</Notice>
        )}

      <InventoryConsumptionList
        rows={rows}
        disabled={disabled}
        busy={pending}
        onEdit={(productId) => {
          setNotice("");
          setEditor({ productId });
        }}
      />

      {editor && (
        <InventoryCompositionDialog
          key={JSON.stringify([
            session.business.id,
            session.membership.id,
            session.accessToken,
            session.authorization,
            editor.productId ?? "new",
          ])}
          productId={editor.productId}
          initialProductId={initialProductId}
          products={products}
          links={links}
          items={data.items}
          ready={!disabled}
          onClose={() => {
            setEditor(null);
            reload();
          }}
          onSaved={() => {
            setEditor(null);
            setNotice("Configuración de consumo guardada.");
            reload();
          }}
        />
      )}
    </div>
  );
}
