import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { Toggle } from "../../../components/forms/Toggle";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { InventoryConsumptionList } from "./InventoryConsumptionList";

import {
  consumptionInputSchema,
  loadLinks,
  loadProducts,
  saveLink,
  setLinkStatus,
} from "../services/inventory-workspace";

import type { ConsumptionLink } from "../services/inventory-workspace";

import {
  errorText,
  uncertain,
} from "../services/inventory-operations";

import { itemTypeLabels } from "../utils/inventory-format";

import { quantity, unit } from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Choice, Notice } from "./InventoryLocationUI";
import { InventoryWriteDialog } from "./InventoryWriteDialog";

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
    link?: ConsumptionLink;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [blocked, setBlocked] = useState<ConsumptionLink[] | null>(
    null
  );

  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const rows = resource.data ?? [];
  const products = catalog.data ?? [];

  const disabled =
    !ready ||
    busy ||
    resource.pending ||
    catalog.pending ||
    !!resource.error ||
    !!catalog.error ||
    !resource.data ||
    !catalog.data ||
    (blocked !== null && blocked === resource.data);

  const visible = rows.filter(
    (row) =>
      (!initialProductId || row.productId === initialProductId) &&
      (!initialItemId || row.inventoryItemId === initialItemId)
  );

  function reload() {
    resource.refresh();
    catalog.refresh();
    onChanged();
  }

  async function changeSwitch(
    link: ConsumptionLink,
    kind: "automatic" | "status",
    checked: boolean
  ) {
    if (
      lock.current ||
      disabled ||
      (kind === "automatic" && !link.isActive)
    ) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");

    const request = new AbortController();
    controller.current = request;

    try {
      if (kind === "status") {
        await setLinkStatus(
          link.id,
          checked,
          session,
          request.signal
        );
      } else {
        await saveLink(
          link.id,
          {
            productId: link.productId,
            inventoryItemId: link.inventoryItemId,
            quantityPerProduct: link.quantityPerProduct,
            autoDeduct: checked,
          },
          session,
          request.signal
        );
      }

      request.signal.throwIfAborted();

      setBlocked(resource.data);
      reload();
    } catch (cause) {
      if (request.signal.aborted) return;

      if (uncertain(cause)) {
        setBlocked(resource.data);
      }

      setError(
        uncertain(cause)
          ? "No pudimos confirmar el cambio. Actualiza antes de volver a intentarlo."
          : errorText(cause)
      );
    } finally {
      lock.current = false;

      if (!request.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold">
            Consumo por producto
          </h3>

          <p className="mt-1 text-[12px] text-muted">
            Las relaciones se configuran para todo el negocio.
          </p>
        </div>

        <Button disabled={disabled} onClick={() => setEditor({})}>
          <Plus size={16} aria-hidden />
          Crear relación
        </Button>
      </div>

      {(initialProductId || initialItemId) && (
        <Notice>
          Mostrando las relaciones del producto o artículo
          seleccionado.
          <Button
            variant="ghost"
            size="compact"
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);

                next.delete("productId");
                next.delete("itemId");
                next.delete("setupProductId");
                next.delete("intent");
                next.set("tab", "consumption");

                return next;
              })
            }
          >
            Ver todas
          </Button>
        </Notice>
      )}

      {(error || resource.error || catalog.error) && (
        <Notice>
          {error || resource.error || catalog.error}{" "}
          <Button variant="ghost" disabled={busy} onClick={reload}>
            Actualizar
          </Button>
        </Notice>
      )}

      {resource.pending && resource.data && (
        <p role="status" className="sr-only">
          Actualizando relaciones…
        </p>
      )}

      {!resource.data && resource.pending ? (
        <p role="status" className="text-[14px] text-muted">
          Cargando relaciones…
        </p>
      ) : !visible.length ? (
        <Notice>
          No hay relaciones de consumo para esta selección.
        </Notice>
      ) : (
        <InventoryConsumptionList
          rows={visible}
          disabled={disabled}
          busy={busy || resource.pending}
          onAutomatic={(link, checked) => {
            void changeSwitch(link, "automatic", checked);
          }}
          onStatus={(link) => {
            void changeSwitch(link, "status", !link.isActive);
          }}
          onEdit={(link) => setEditor({ link })}
        />
      )}

      {editor && (
        <ConsumptionEditor
          key={editor.link?.id ?? "new"}
          link={editor.link}
          data={data}
          products={products}
          links={rows}
          initialProductId={initialProductId}
          initialItemId={initialItemId}
          ready={!disabled}
          onClose={() => {
            setEditor(null);
            reload();
          }}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ConsumptionEditor({
  link,
  data,
  products,
  links,
  initialProductId,
  initialItemId,
  ready,
  onClose,
  onSaved,
}: {
  link?: ConsumptionLink;
  data: InventoryWorkspace;
  products: Awaited<ReturnType<typeof loadProducts>>;
  links: ConsumptionLink[];
  initialProductId: string;
  initialItemId: string;
  ready: boolean;
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

  const parsed = consumptionInputSchema.safeParse(draft);

  const item = data.items.find(
    (row) => row.id === draft.inventoryItemId
  );

  const product = products.find((row) => row.id === draft.productId);

  const baseUnit = item?.baseUnit ?? link?.baseUnit;

  const duplicate =
    !link &&
    links.some(
      (row) =>
        row.productId === draft.productId &&
        row.inventoryItemId === draft.inventoryItemId
    );

  const valid =
    ready &&
    parsed.success &&
    !duplicate &&
    (!!link ||
      (!!item?.isActive && !!product?.isActive && !product.isCombo));

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const productOptions = link
    ? [
        {
          value: link.productId,
          label: link.productName,
        },
      ]
    : products
        .filter((row) => row.isActive && !row.isCombo)
        .map((row) => ({
          value: row.id,
          label: row.name,
        }));

  const itemOptions = link
    ? [
        {
          value: link.inventoryItemId,
          label:
            link.inventoryItemName +
            " · " +
            itemTypeLabels[link.inventoryItemType],
        },
      ]
    : data.items
        .filter((row) => row.isActive)
        .map((row) => ({
          value: row.id,
          label: row.name + " · " + itemTypeLabels[row.itemType],
        }));

  return (
    <InventoryWriteDialog
      title={link ? "Editar consumo" : "Crear relación"}
      description="Define cuánto inventario consume cada unidad vendida."
      submitLabel={link ? "Guardar cambios" : "Crear relación"}
      className="max-w-[640px]!"
      dirty={dirty}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onSave={(signal) => {
        if (!valid) {
          throw new Error("Revisa los datos de la relación.");
        }

        return saveLink(link?.id ?? null, draft, session, signal);
      }}
    >
      <div className="grid min-w-0 gap-4">
        <Choice
          label="Producto *"
          value={draft.productId}
          disabled={!!link || !ready}
          options={[
            {
              value: "",
              label: "Selecciona un producto",
            },
            ...productOptions,
          ]}
          onValueChange={(productId) => update({ productId })}
        />

        <Choice
          label="Artículo de inventario *"
          value={draft.inventoryItemId}
          disabled={!!link || !ready}
          options={[
            {
              value: "",
              label: "Selecciona un artículo",
            },
            ...itemOptions,
          ]}
          onValueChange={(inventoryItemId) =>
            update({ inventoryItemId })
          }
        />

        <label className="grid gap-2 text-[14px] text-heading">
          Cantidad consumida por cada unidad vendida *
          <span className="relative">
            <input
              required
              inputMode="decimal"
              value={draft.quantityPerProduct}
              disabled={!ready}
              placeholder="0,020"
              onChange={(event) =>
                update({
                  quantityPerProduct: event.target.value,
                })
              }
              className="h-10 w-full rounded-xl border border-outline bg-surface pr-24 pl-3 text-heading outline-none focus:border-accent"
            />

            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">
              {baseUnit ? unit(baseUnit) : ""}
            </span>
          </span>
        </label>

        <div className="rounded-xl border border-outline p-3">
          <Toggle
            label="Descontar automáticamente al vender"
            description="Si está apagado, la relación se conserva pero no descuenta existencias."
            checked={draft.autoDeduct}
            disabled={!ready || link?.isActive === false}
            onChange={(event) =>
              update({
                autoDeduct: event.target.checked,
              })
            }
          />
        </div>

        {duplicate && (
          <Notice>
            Esta relación ya existe. Edítala o reactívala desde el
            listado.
          </Notice>
        )}

        {dirty && !parsed.success && (
          <Notice>{parsed.error.issues[0]?.message}</Notice>
        )}

        {!ready && (
          <Notice>
            Actualizando los datos. Espera antes de guardar.
          </Notice>
        )}

        {link?.isActive === false && (
          <Notice>
            La relación está inactiva y no descuenta existencias.
          </Notice>
        )}

        {parsed.success && baseUnit && (
          <Notice>
            {draft.autoDeduct && link?.isActive !== false ? (
              <>
                Una unidad de{" "}
                <strong>{product?.name ?? link?.productName}</strong>{" "}
                vendida descuenta{" "}
                {quantity(parsed.data.quantityPerProduct, baseUnit)}{" "}
                de {item?.name ?? link?.inventoryItemName}.
              </>
            ) : (
              <>
                Consumo configurado:{" "}
                {quantity(parsed.data.quantityPerProduct, baseUnit)}.
                El descuento automático está deshabilitado.
              </>
            )}
          </Notice>
        )}
      </div>
    </InventoryWriteDialog>
  );
}
