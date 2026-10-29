import { useCallback, useId } from "react";

import { BottomSheet } from "../../../../../../components/layout/BottomSheet";
import type { AuthSession } from "../../../../../auth/types/auth.types";

import { useInventoryQuery } from "../../../../hooks/useInventoryQuery";
import { quantity } from "../../../../utils/inventory-value";

import { Button } from "../../../InventoryButton";
import { Notice } from "../../../InventoryLocationUI";

import { getQuickProduction } from "../../services/quick-production.service";
import { productionRoles } from "../../utils/production.access";
import { cash } from "../../utils/production.utils";
import {
  quickDate,
  quickCost,
} from "../../utils/quick-production.utils";

import type { QuickProductionLine } from "../../schemas/quick-production.schemas";

function Lines({
  title,
  lines,
}: {
  title: string;
  lines: QuickProductionLine[];
}) {
  const fields = (line: QuickProductionLine) => [
    {
      label: "Cantidad",
      value: quantity(line.quantity, line.baseUnit),
    },
    {
      label: "Notas",
      value: line.notes || "—",
    },
    {
      label: "Saldo anterior",
      value: quantity(line.balanceBefore, line.baseUnit),
    },
    {
      label: "Saldo resultante",
      value: quantity(line.balanceAfter, line.baseUnit),
    },
  ];

  return (
    <section className="grid min-w-0 gap-4">
      <h3 className="text-sm font-semibold">{title}</h3>

      <ul
        aria-label={title}
        className="grid list-none gap-3 p-0 md:hidden"
      >
        {lines.map((line) => (
          <li
            key={line.id}
            className="min-w-0 rounded-xl border border-outline p-4"
          >
            <p className="mb-3 text-sm font-semibold [overflow-wrap:anywhere]">
              {line.inventoryItemName}
            </p>

            <dl className="grid grid-cols-2 gap-3 text-xs leading-5">
              {fields(line).map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-muted">{field.label}</dt>

                  <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="hidden min-w-0 overflow-x-auto rounded-xl border border-outline focus-visible:outline-2 focus-visible:outline-accent md:block"
      >
        <table className="w-full min-w-[650px] table-fixed text-left text-xs leading-4">
          <thead className="bg-secondary/40 text-muted">
            <tr>
              {[
                "Artículo",
                "Cantidad",
                "Notas",
                "Saldo anterior",
                "Saldo resultante",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="p-3 font-normal"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {lines.map((line) => (
              <tr
                key={line.id}
                className="h-16 border-t border-outline [&>td]:p-3 [&>td]:whitespace-pre-wrap [&>td]:[overflow-wrap:anywhere]"
              >
                <td>{line.inventoryItemName}</td>

                {fields(line).map((field) => (
                  <td key={field.label}>{field.value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function QuickProductionDetail({
  productionId,
  locationId,
  currency,
  zone,
  revision,
  onClose,
}: {
  productionId: string;
  locationId: string;
  currency: string;
  zone: string;
  revision: number;
  onClose: () => void;
}) {
  const dialogId = useId();

  const load = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      getQuickProduction(session, signal, productionId, locationId),
    [productionId, locationId]
  );

  const query = useInventoryQuery(
    "quick-production-detail:" + locationId + ":" + productionId,
    load,
    revision,
    productionRoles
  );

  const row = query.data;

  return (
    <BottomSheet
      id={dialogId}
      open
      variant="modal"
      title={"Producción rápida · P-" + productionId}
      onClose={onClose}
      className="w-[calc(100%_-_2rem)]! max-w-[1000px]! max-h-[calc(100dvh_-_2rem)]! overflow-hidden! p-0! [&[open]]:flex [&[open]]:flex-col [&>.bottom-sheet-heading]:m-0 [&>.bottom-sheet-heading]:shrink-0 [&>.bottom-sheet-heading]:px-5 [&>.bottom-sheet-heading]:pt-4 [&>.bottom-sheet-heading]:pb-2 [&>.bottom-sheet-heading_h2]:text-base"
    >
      <p className="shrink-0 border-b border-outline px-5 pb-5 text-xs text-muted">
        Movimiento M-{productionId}
      </p>

      <div className="grid min-h-0 min-w-0 gap-5 overflow-y-auto overscroll-contain p-5">
        {query.pending && <Notice>Consultando producción…</Notice>}

        {query.error && (
          <Notice>
            {query.error}{" "}
            <Button
              size="compact"
              variant="secondary"
              onClick={query.refresh}
            >
              Reintentar
            </Button>
          </Notice>
        )}

        {row && !query.error && (
          <>
            <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
              {[
                {
                  label: "Planta",
                  value: row.location?.name ?? "Sin ubicación",
                },
                {
                  label: "Fecha",
                  value: quickDate(row.createdAt, zone),
                },
                {
                  label: "Responsable",
                  value: row.createdByName,
                },
                {
                  label: "Notas",
                  value: row.notes || "—",
                },
              ].map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="mb-1 text-xs text-muted">
                    {field.label}
                  </dt>

                  <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Lines
              title="Insumos consumidos"
              lines={row.lines.filter(
                (line) => line.direction === "OUT"
              )}
            />

            <Lines
              title="Productos obtenidos"
              lines={row.lines.filter(
                (line) => line.direction === "IN"
              )}
            />

            <dl className="rounded-xl border border-outline p-4">
              <dt className="text-xs text-muted">Costo trasladado</dt>

              <dd className="m-0 mt-2 text-xl font-semibold">
                {cash(quickCost(row), currency)}
              </dd>
            </dl>
          </>
        )}
      </div>

      <footer className="flex shrink-0 justify-end border-t border-outline bg-background px-5 py-3">
        <Button size="compact" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </footer>
    </BottomSheet>
  );
}
