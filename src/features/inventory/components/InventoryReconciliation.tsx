import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

import { Pagination } from "../../../components/ui/Pagination";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadReconciliation } from "../services/inventory-audit.service";
import { formatQuantity } from "../utils/inventory-format";
import { fixed } from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Notice } from "./InventoryLocationUI";
import { InventoryResponsiveRecords } from "./InventoryResponsiveRecords";
import { InventoryReconciliationDetail } from "./InventoryReconciliationDetail";

const issues = {
  PHYSICAL_STOCK_MISMATCH: "Diferencia física",
  NEGATIVE_LOCATION_STOCK: "Saldo negativo",
  UNVALUED_LOCATION_STOCK: "Sin valorar",
};

export function InventoryReconciliation({
  currency,
  revision,
}: {
  currency: string;
  revision: number;
}) {
  const query = useInventoryQuery(
    "inventory-reconciliation",
    loadReconciliation,
    revision
  );

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opened, setOpened] = useState("");

  const report = query.data;
  const summary = report?.summary;
  const items = report?.items ?? [];

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(items.length / size))
  );

  const red = "text-red-600 dark:text-red-400";
  const orange = "text-orange-700 dark:text-orange-400";

  const metrics = summary
    ? [
        {
          label: "Artículos revisados",
          value: summary.inventoryItemCount,
          tone: "",
        },
        {
          label: "Artículos inconsistentes",
          value: summary.inconsistentItemCount,
          tone: red,
        },
        {
          label: "Diferencias físicas",
          value: summary.physicalMismatchCount,
          tone: red,
        },
        {
          label: "Saldos negativos",
          value: summary.negativeBalanceCount,
          tone: red,
        },
        {
          label: "Saldos sin valorar",
          value: summary.unvaluedBalanceCount,
          tone: orange,
        },
        {
          label: "Movimientos antiguos sin ubicación",
          value: summary.movementWithoutLocationCount,
          tone: orange,
        },
        {
          label: "Líneas históricas sin costo",
          value: summary.unvaluedMovementLineCount,
          tone: orange,
        },
      ]
    : [];

  const rows = items
    .slice((current - 1) * size, current * size)
    .map((item) => ({
      id: item.inventoryItemId,
      fields: [
        {
          label: "Artículo / SKU",
          value: (
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted">
                {item.sku || "Sin SKU"}
              </p>
            </div>
          ),
        },
        {
          label: "Existencia global",
          value: formatQuantity(item.globalStock),
        },
        {
          label: "Suma por ubicaciones",
          value: formatQuantity(item.locationStock),
        },
        {
          label: "Diferencia",
          value: (
            <span
              className={
                fixed(item.difference) !== 0n ? red : "text-heading"
              }
            >
              {formatQuantity(item.difference)}
            </span>
          ),
        },
        {
          label: "Ubicaciones negativas",
          value: item.negativeLocationCount,
        },
        {
          label: "Ubicaciones sin valorar",
          value: item.unvaluedLocationCount,
        },
        {
          label: "Problemas detectados",
          value:
            item.issues.map((issue) => issues[issue]).join(" · ") ||
            "Sin incidencias",
        },
        {
          label: "Acción",
          value: (
            <Button
              variant="ghost"
              size="compact"
              className="min-h-11 hover:bg-accent! hover:text-on-accent!"
              aria-label={"Revisar inventario de " + item.name}
              onClick={() => setOpened(item.inventoryItemId)}
            >
              Revisar
            </Button>
          ),
        },
      ],
    }));

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="status" className="min-w-0 text-sm font-medium">
          {query.pending ? (
            <span className="text-muted">Revisando inventario…</span>
          ) : query.error ? (
            <span className={red}>
              No se pudo completar la revisión.
            </span>
          ) : (
            summary && (
              <span
                className={
                  "flex items-center gap-2 " +
                  (!summary.isPhysicallyConsistent
                    ? red
                    : summary.hasLegacyAuditGaps
                      ? orange
                      : "text-emerald-700 dark:text-emerald-400")
                }
              >
                {!summary.isPhysicallyConsistent ? (
                  <ClipboardCheck
                    size={22}
                    className="shrink-0"
                    aria-hidden
                  />
                ) : summary.hasLegacyAuditGaps ? (
                  <CircleAlert
                    size={22}
                    className="shrink-0"
                    aria-hidden
                  />
                ) : (
                  <CircleCheck
                    size={22}
                    className="shrink-0"
                    aria-hidden
                  />
                )}

                {!summary.isPhysicallyConsistent
                  ? "Se encontraron diferencias"
                  : summary.hasLegacyAuditGaps
                    ? "Existen alertas de valoración"
                    : "El inventario está conciliado"}
              </span>
            )
          )}
        </div>

        <Button
          variant="secondary"
          className="min-h-11 self-start md:self-auto"
          disabled={query.pending}
          aria-busy={query.pending}
          onClick={() => {
            setPage(1);
            query.refresh();
          }}
        >
          <RefreshCw
            size={17}
            aria-hidden
            className={
              query.pending ? "motion-safe:animate-spin" : ""
            }
          />
          Revisar inventario
        </Button>
      </div>

      <p className="text-xs leading-5 text-muted">
        La conciliación compara la existencia global con todas las
        ubicaciones del negocio.
      </p>

      {query.error && <Notice>{query.error}</Notice>}

      {!query.pending && !query.error && report && (
        <>
          <dl className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="min-w-0 rounded-xl border border-outline bg-surface p-4"
              >
                <dt className="text-xs leading-5 text-muted">
                  {metric.label}
                </dt>

                <dd
                  className={
                    "m-0 mt-2 text-xl font-bold tabular-nums " +
                    (metric.value > 0 && metric.tone
                      ? metric.tone
                      : "text-heading")
                  }
                >
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>

          {report.summary.hasLegacyAuditGaps && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs leading-5 text-heading"
            >
              <CircleAlert
                size={17}
                aria-hidden
                className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400"
              />

              <p>
                Existen vacíos de valoración. Los movimientos antiguos
                sin ubicación y las líneas históricas sin costo son
                alertas de auditoría; no se corrigen automáticamente.
              </p>
            </div>
          )}

          <InventoryResponsiveRecords
            label="Artículos con incidencias"
            rows={rows}
          />

          {!items.length && (
            <Notice>
              {report.summary.hasLegacyAuditGaps
                ? "No hay incidencias actuales por artículo. Revisa las alertas históricas del resumen."
                : "No se encontraron artículos con incidencias."}
            </Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={items.length}
            itemLabel="registros"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}

      {opened && (
        <InventoryReconciliationDetail
          key={opened}
          itemId={opened}
          currency={currency}
          revision={revision}
          onClose={() => setOpened("")}
        />
      )}
    </div>
  );
}
