import { useCallback } from "react";
import { CircleAlert } from "lucide-react";

import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadItemDetail } from "../services/inventory-location.service";

import {
  itemTypeLabels,
  unitLabels,
} from "../utils/inventory-format";

import {
  add,
  cost,
  fixed,
  money,
  physical,
  quantity,
  subtract,
  unvalued,
} from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Modal, Notice, StockBadge } from "./InventoryLocationUI";
import { InventoryResponsiveRecords } from "./InventoryResponsiveRecords";

export function InventoryReconciliationDetail({
  itemId,
  currency,
  revision,
  onClose,
}: {
  itemId: string;
  currency: string;
  revision: number;
  onClose: () => void;
}) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadItemDetail(session, signal, itemId),
    [itemId]
  );

  const query = useInventoryQuery(
    "reconciliation-detail:" + itemId,
    loader,
    revision
  );

  const detail = query.data;
  const item = detail?.item;
  const balances = detail?.balances ?? [];

  const locationStock = balances.reduce(
    (total, balance) => add(total, balance.currentStock),
    "0"
  );

  const difference = item
    ? subtract(item.currentStock, locationStock)
    : "0";

  const metadata = item
    ? [
        { label: "Artículo", value: item.name },
        { label: "SKU", value: item.sku || "Sin SKU" },
        {
          label: "Tipo",
          value: itemTypeLabels[item.itemType],
        },
        {
          label: "Unidad base",
          value: unitLabels[item.baseUnit],
        },
        {
          label: "Estado",
          value: item.isActive ? "Activo" : "Inactivo",
        },
      ]
    : [];

  const totals = item
    ? [
        {
          label: "Existencia global",
          value: item.currentStock,
        },
        {
          label: "Suma de ubicaciones",
          value: locationStock,
        },
        {
          label: "Diferencia física",
          value: difference,
        },
      ]
    : [];

  const rows = balances.map((balance) => ({
    id: balance.location.id,
    fields: [
      {
        label: "Ubicación",
        value:
          balance.location.name +
          " · " +
          balance.location.code +
          (balance.location.isActive ? "" : " · Inactiva"),
      },
      {
        label: "Existencia",
        value: quantity(balance.currentStock, balance.baseUnit),
      },
      {
        label: "Mínimo local",
        value: quantity(balance.minimumStock, balance.baseUnit),
      },
      {
        label: "Costo promedio",
        value: cost(
          balance.valuationStatus === "VALUED"
            ? balance.averageUnitCost
            : null,
          balance.baseUnit,
          currency
        ),
      },
      {
        label: "Valor",
        value: money(
          unvalued(balance) ? null : balance.inventoryValue,
          currency
        ),
      },
      {
        label: "Estado físico",
        value: <StockBadge label={physical(balance)} />,
      },
      {
        label: "Valoración",
        value: unvalued(balance)
          ? "Sin valorar"
          : balance.valuationStatus === "UNVALUED" ||
              balance.averageUnitCost === null
            ? "Sin costo vigente"
            : "Valorado",
      },
    ],
  }));

  return (
    <Modal
      title="Revisión de inventario"
      wide
      onClose={onClose}
      footer={
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={onClose}
        >
          Cerrar
        </Button>
      }
    >
      {query.pending && (
        <Notice>Consultando el artículo y sus ubicaciones…</Notice>
      )}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="secondary" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!query.pending && !query.error && item && (
        <div className="grid min-w-0 gap-5">
          <p className="text-sm text-muted">{item.name}</p>

          <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
            {metadata.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-xs leading-5 text-muted">
                  {field.label}
                </dt>

                <dd className="m-0 mt-1 text-sm font-medium text-heading [overflow-wrap:anywhere]">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs leading-5 text-heading">
            <CircleAlert
              size={17}
              aria-hidden
              className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400"
            />

            <p>
              Revisión de solo lectura. No se modificarán saldos ni
              movimientos históricos.
            </p>
          </div>

          <dl className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
            {totals.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-xs leading-5 text-muted">
                  {field.label}
                </dt>

                <dd
                  className={
                    "m-0 mt-1 text-sm font-medium [overflow-wrap:anywhere] " +
                    (field.label === "Diferencia física" &&
                    fixed(field.value) !== 0n
                      ? "text-red-600 dark:text-red-400"
                      : "text-heading")
                  }
                >
                  {quantity(field.value, item.baseUnit)}
                </dd>
              </div>
            ))}
          </dl>

          <InventoryResponsiveRecords
            label="Inventario por ubicación"
            rows={rows}
          />

          {!balances.length && (
            <Notice>
              El artículo no tiene saldos por ubicación registrados.
            </Notice>
          )}
        </div>
      )}
    </Modal>
  );
}
