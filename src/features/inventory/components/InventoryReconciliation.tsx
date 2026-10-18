import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Pagination } from "../../../components/ui/Pagination";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadReconciliation } from "../services/inventory-audit.service";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { quantity } from "../utils/inventory-value";
import { searchKey } from "../utils/inventory-format";
import { Button } from "./InventoryButton";
import {
  Choice,
  DataTable,
  Field,
  Notice,
} from "./InventoryLocationUI";

const issues = {
  PHYSICAL_STOCK_MISMATCH: "Diferencia física",
  NEGATIVE_LOCATION_STOCK: "Saldo negativo",
  UNVALUED_LOCATION_STOCK: "Existencia sin valorar",
};

export function InventoryReconciliation({
  data,
  revision,
}: {
  data: InventoryWorkspace;
  revision: number;
}) {
  const query = useInventoryQuery(
    "inventory-reconciliation",
    loadReconciliation,
    revision
  );

  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const report = query.data;

  const rows = (report?.items ?? []).filter(
    (item) =>
      searchKey(item.name + " " + (item.sku ?? "")).includes(
        searchKey(search)
      ) &&
      (!onlyIssues || item.issues.length > 0)
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / size))
  );

  const amount = (itemId: string, value: string) => {
    const item = data.items.find((item) => item.id === itemId);

    return item
      ? quantity(value, item.baseUnit)
      : value + " (unidad no disponible)";
  };

  return (
    <div className="grid min-w-0 gap-5">
      <Notice>
        La conciliación compara el inventario global con todas las
        ubicaciones. Este informe siempre corresponde al negocio
        completo.
      </Notice>

      <Button
        variant="secondary"
        disabled={query.pending}
        onClick={query.refresh}
      >
        <RefreshCw size={17} />
        Actualizar conciliación
      </Button>

      {query.pending && <Notice>Consultando conciliación…</Notice>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="secondary" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!query.pending && !query.error && report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries({
              "Artículos revisados":
                report.summary.inventoryItemCount,
              "Artículos con incidencias":
                report.summary.inconsistentItemCount,
              "Diferencias físicas":
                report.summary.physicalMismatchCount,
              "Saldos negativos": report.summary.negativeBalanceCount,
              "Saldos sin valorar":
                report.summary.unvaluedBalanceCount,
              "Movimientos sin ubicación":
                report.summary.movementWithoutLocationCount,
              "Líneas históricas sin valorar":
                report.summary.unvaluedMovementLineCount,
            }).map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-outline bg-surface p-4"
              >
                <p className="text-sm text-muted">{label}</p>
                <strong className="text-2xl">{value}</strong>
              </div>
            ))}
          </div>

          <Notice>
            {report.summary.isPhysicallyConsistent
              ? "Los saldos físicos concilian."
              : "Hay diferencias físicas que requieren revisión."}
            {report.summary.hasLegacyAuditGaps &&
              " Existen vacíos históricos de auditoría; no se corrigen automáticamente."}
          </Notice>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Buscar artículo o SKU"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />

            <Choice
              label="Estado"
              value={onlyIssues}
              onValueChange={(value) => {
                setOnlyIssues(value);
                setPage(1);
              }}
              options={[
                { value: "", label: "Todos los artículos" },
                { value: "issues", label: "Con incidencias" },
              ]}
            />
          </div>

          <DataTable
            headers={[
              "Artículo",
              "SKU",
              "Existencia global",
              "Suma por ubicaciones",
              "Diferencia",
              "Ubicaciones negativas",
              "Ubicaciones sin valorar",
              "Problemas",
            ]}
          >
            {rows
              .slice((current - 1) * size, current * size)
              .map((item) => (
                <tr key={item.inventoryItemId}>
                  <td>{item.name}</td>
                  <td>{item.sku ?? "—"}</td>
                  <td>
                    {amount(item.inventoryItemId, item.globalStock)}
                  </td>
                  <td>
                    {amount(item.inventoryItemId, item.locationStock)}
                  </td>
                  <td>
                    {amount(item.inventoryItemId, item.difference)}
                  </td>
                  <td>{item.negativeLocationCount}</td>
                  <td>{item.unvaluedLocationCount}</td>
                  <td>
                    {item.issues.length
                      ? item.issues
                          .map((issue) => issues[issue])
                          .join(" · ")
                      : "Sin incidencias"}
                  </td>
                </tr>
              ))}
          </DataTable>

          {!rows.length && (
            <Notice>No hay artículos para estos filtros.</Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={rows.length}
            itemLabel="artículos"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
