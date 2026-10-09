import { useCallback, useId, useRef, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { ProductDetailData } from "../../products/schemas/product.schema";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  configureInventory,
  inventorySetupSchema,
  loadInventorySetup,
} from "../services/inventory-setup";
import type { InventorySetupDraft } from "../services/inventory-setup";
import { unitLabels } from "../utils/inventory-format";
import { InventoryWriteDialog } from "./InventoryWriteDialog";

export function ProductInventorySetupDialog({
  productId,
  onClose,
  onResolved,
}: {
  productId: string;
  onClose: () => void;
  onResolved: (alreadyConfigured: boolean) => void;
}) {
  const id = useId();

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadInventorySetup(productId, session, signal),
    [productId]
  );

  const resource = useInventoryQuery(
    "inventory-setup:" + productId,
    loader
  );

  const data = resource.data;

  if (
    !data ||
    resource.pending ||
    resource.error ||
    data.configured ||
    !data.product.isActive
  ) {
    return (
      <BottomSheet
        id={id}
        open
        variant="modal"
        title="Configurar inventario"
        className="inv-dialog inv-centered"
        onClose={onClose}
      >
        <div className="inv-dialog-body">
          {resource.pending ? (
            <p role="status">Cargando configuración…</p>
          ) : resource.error ? (
            <div role="alert">
              <p className="inv-error">{resource.error}</p>

              <Button variant="secondary" onClick={resource.refresh}>
                Reintentar
              </Button>
            </div>
          ) : data?.configured ? (
            <p>
              <strong>{data.product.name}</strong> ya tiene una
              configuración de inventario. Puedes revisar sus
              relaciones, incluidas las inactivas.
            </p>
          ) : (
            <p role="alert">
              El producto no está disponible para configurar.
            </p>
          )}
        </div>

        <footer className="inv-dialog-footer">
          <Button variant="cancel" onClick={onClose}>
            Cancelar
          </Button>

          {!resource.pending &&
            !resource.error &&
            data?.configured && (
              <Button onClick={() => onResolved(true)}>
                Ver configuración existente
              </Button>
            )}
        </footer>
      </BottomSheet>
    );
  }

  return (
    <SetupForm
      key={data.product.id}
      product={data.product}
      onClose={onClose}
      onResolved={onResolved}
    />
  );
}

function SetupForm({
  product,
  onClose,
  onResolved,
}: {
  product: ProductDetailData;
  onClose: () => void;
  onResolved: (alreadyConfigured: boolean) => void;
}) {
  const { session } = useAppShell();

  const [initial] = useState<InventorySetupDraft>(() => ({
    trackingType: "RESALE",
    sku: product.sku ?? "",
    baseUnit: "UNIT",
    openingQuantity: "0",
    minimumStock: "0",
    quantityPerProduct: "1",
  }));

  const [draft, setDraft] = useState(initial);

  const alreadyConfigured = useRef(false);

  const validation = inventorySetupSchema.safeParse(draft);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function update(patch: Partial<InventorySetupDraft>) {
    setDraft((previous) => ({
      ...previous,
      ...patch,
    }));
  }

  return (
    <InventoryWriteDialog
      title="Configurar inventario"
      description="Crea el inventario de este producto y activa el descuento por venta."
      submitLabel="Guardar configuración"
      dirty={dirty}
      valid={validation.success && product.isActive}
      onClose={onClose}
      onSaved={() => onResolved(alreadyConfigured.current)}
      onSave={async (signal) => {
        alreadyConfigured.current = false;

        try {
          await configureInventory(
            product.id,
            draft,
            session,
            signal
          );
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.code === "PRODUCT_INVENTORY_ALREADY_CONFIGURED"
          ) {
            // Puede haberse configurado desde otra pestaña
            // después de nuestra consulta inicial.
            alreadyConfigured.current = true;
            return;
          }

          throw error;
        }
      }}
    >
      <p className="inv-note">
        <strong>{product.name}</strong>
      </p>

      <div className="inv-fields">
        <SelectField
          label="Tipo de seguimiento"
          required
          value={draft.trackingType}
          options={[
            {
              value: "RESALE",
              label: "Reventa",
            },
            {
              value: "PRODUCTION",
              label: "Producción",
            },
          ]}
          onValueChange={(value) => {
            if (value === "RESALE" || value === "PRODUCTION") {
              update({ trackingType: value });
            }
          }}
        />

        <label>
          SKU de inventario (opcional)
          <input
            maxLength={50}
            value={draft.sku}
            onChange={(event) => update({ sku: event.target.value })}
          />
        </label>

        <SelectField
          label="Unidad base"
          required
          value={draft.baseUnit}
          options={Object.entries(unitLabels).map(
            ([value, label]) => ({
              value,
              label,
            })
          )}
          onValueChange={(value) => {
            const parsed =
              inventorySetupSchema.shape.baseUnit.safeParse(value);

            if (parsed.success) {
              update({ baseUnit: parsed.data });
            }
          }}
        />

        {(
          [
            ["openingQuantity", "Existencia inicial"],
            ["minimumStock", "Stock mínimo"],
            ["quantityPerProduct", "Cantidad descontada por venta"],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label} *
            <input
              required
              inputMode="decimal"
              value={draft[field]}
              onChange={(event) =>
                update({
                  [field]: event.target.value,
                })
              }
            />
          </label>
        ))}
      </div>

      <p className="inv-note">
        {draft.trackingType === "RESALE"
          ? "Se creará un artículo de reventa vinculado a este producto."
          : "Se creará un artículo de producto terminado. Después podrás aumentar sus existencias mediante producción."}{" "}
        El descuento por venta estará activo y usará la unidad base
        seleccionada.
      </p>

      {dirty && !validation.success && (
        <p className="inv-error" role="alert">
          {validation.error.issues[0]?.message}
        </p>
      )}
    </InventoryWriteDialog>
  );
}
