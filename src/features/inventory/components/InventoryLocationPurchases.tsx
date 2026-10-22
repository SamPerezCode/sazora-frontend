import { useCallback, useState } from "react";
import { Eye, FilterX, Plus } from "lucide-react";
import { DateField } from "../../../components/forms/DateField";
import { calendarToday } from "../../../components/forms/calendar-date";
import { Button } from "./InventoryButton";
import { Pagination } from "../../../components/ui/Pagination";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { InventoryMobileCards } from "./InventoryMobileCards";

import {
  loadPurchase,
  loadPurchaseRows,
} from "../services/inventory-location.service";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import type { PurchaseRow } from "../schemas/inventory-location.schema";
import { add, cost, money, quantity } from "../utils/inventory-value";
import { searchKey } from "../utils/inventory-format";
import {
  Choice,
  DataTable,
  Field,
  Modal,
  Notice,
} from "./InventoryLocationUI";

export function InventoryLocationPurchases({
  data,
  locationId,
  currency,
  timezone,
  revision,
  onCreate,
}: {
  data: InventoryWorkspace;
  locationId: string;
  currency: string;
  timezone: string;
  revision: number;
  onCreate: () => void;
}) {
  const today = calendarToday(timezone);

  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [itemId, setItem] = useState("");
  const [supplier, setSupplier] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opened, setOpened] = useState("");

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadPurchaseRows(session, signal, {
        from,
        to,
        locationId,
        inventoryItemId: "",
      }),
    [from, to, locationId]
  );

  const query = useInventoryQuery(
    JSON.stringify(["purchases", from, to, locationId]),
    loader,
    revision
  );

  const grouped = new Map<string, PurchaseRow[]>();

  for (const row of query.data ?? []) {
    grouped.set(row.movementId, [
      ...(grouped.get(row.movementId) ?? []),
      row,
    ]);
  }

  const groups = [...grouped.values()];

  const suppliers = [
    ...new Set(
      groups
        .map((group) => group[0].supplierName)
        .filter((value): value is string => !!value)
    ),
  ];

  const filtered = groups.filter((rows) => {
    const first = rows[0];

    return (
      (!itemId ||
        rows.some((row) => row.inventoryItemId === itemId)) &&
      (!supplier || first.supplierName === supplier) &&
      searchKey(
        [
          first.externalReference,
          first.supplierName,
          first.createdByName,
        ].join(" ")
      ).includes(searchKey(search))
    );
  });

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size))
  );

  function total(
    rows: PurchaseRow[],
    key:
      | "grossCost"
      | "discountAmount"
      | "additionalCostAmount"
      | "netCost"
  ) {
    return rows.some((row) => row[key] === null)
      ? null
      : add(...rows.map((row) => row[key]!));
  }

  function clear() {
    setFrom(today.slice(0, 7) + "-01");
    setTo(today);
    setSearch("");
    setItem("");
    setSupplier("");
    setPage(1);
  }
  return (
    <div className="grid min-w-0 gap-5">
      <div>
        <Button onClick={onCreate}>
          <Plus size={16} />
          Registrar compra
        </Button>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
        <div className="min-w-0">
          <Field
            label="Buscar"
            placeholder="Buscar referencia, proveedor o responsable"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </div>

        <Button
          variant="ghost"
          onClick={clear}
          className="min-h-11 justify-self-end"
        >
          <FilterX size={16} aria-hidden="true" />
          Limpiar filtros
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DateField
          label="Desde"
          value={from}
          max={to || undefined}
          timeZone={timezone}
          clearable={false}
          onValueChange={(value) => {
            setFrom(value);
            setPage(1);
          }}
        />

        <DateField
          label="Hasta"
          value={to}
          min={from || undefined}
          timeZone={timezone}
          clearable={false}
          onValueChange={(value) => {
            setTo(value);
            setPage(1);
          }}
        />

        <Choice
          label="Artículo"
          value={itemId}
          onValueChange={(value) => {
            setItem(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos los artículos" },
            ...data.items.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
        />

        <Choice
          label="Proveedor"
          value={supplier}
          onValueChange={(value) => {
            setSupplier(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos los proveedores" },
            ...suppliers.map((value) => ({
              value,
              label: value,
            })),
          ]}
        />
      </div>

      {query.pending && (
        <Notice>Consultando las compras del período…</Notice>
      )}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="soft" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!query.pending && !query.error && (
        <>
          <InventoryMobileCards
            label="Compras de inventario"
            rows={filtered
              .slice((current - 1) * size, current * size)
              .map((rows) => {
                const row = rows[0];

                return {
                  id: row.movementId,
                  fields: [
                    {
                      label: "Fecha",
                      value:
                        row.documentDate ??
                        new Intl.DateTimeFormat("es-CO", {
                          timeZone: timezone,
                          dateStyle: "short",
                        }).format(new Date(row.createdAt)),
                    },
                    {
                      label: "Documento",
                      value:
                        row.externalReference ??
                        "M-" + row.movementId,
                    },
                    {
                      label: "Proveedor",
                      value: row.supplierName ?? "—",
                    },
                    {
                      label: "Ubicación",
                      value: row.location
                        ? row.location.name +
                          " · " +
                          row.location.code
                        : "Sin ubicación histórica",
                    },
                    {
                      label: "Líneas",
                      value: rows.length,
                    },
                    {
                      label: "Costo bruto",
                      value: money(
                        total(rows, "grossCost"),
                        currency
                      ),
                    },
                    {
                      label: "Descuentos",
                      value: money(
                        total(rows, "discountAmount"),
                        currency
                      ),
                    },
                    {
                      label: "Adicionales",
                      value: money(
                        total(rows, "additionalCostAmount"),
                        currency
                      ),
                    },
                    {
                      label: "Costo neto",
                      value: (
                        <strong>
                          {money(total(rows, "netCost"), currency)}
                        </strong>
                      ),
                    },
                    {
                      label: "Responsable",
                      value: row.createdByName,
                    },
                    {
                      label: "Acción",
                      value: (
                        <Button
                          variant="ghost"
                          size="compact"
                          className="min-h-11 hover:bg-accent! hover:text-on-accent!"
                          onClick={() => setOpened(row.movementId)}
                          aria-label={
                            "Ver detalle de la compra M-" +
                            row.movementId
                          }
                        >
                          Ver detalle
                        </Button>
                      ),
                    },
                  ],
                };
              })}
          />
          <div className="hidden min-w-0 md:block">
            <DataTable
              headers={[
                "Fecha",
                "Documento",
                "Proveedor",
                "Ubicación",
                "Líneas",
                "Costo bruto",
                "Descuentos",
                "Adicionales",
                "Costo neto",
                "Responsable",
                "Acción",
              ]}
            >
              {filtered
                .slice((current - 1) * size, current * size)
                .map((rows) => {
                  const row = rows[0];

                  return (
                    <tr key={row.movementId}>
                      <td>
                        {row.documentDate ??
                          new Intl.DateTimeFormat("es-CO", {
                            timeZone: timezone,
                            dateStyle: "short",
                          }).format(new Date(row.createdAt))}
                      </td>
                      <td>
                        {row.externalReference ??
                          "M-" + row.movementId}
                      </td>
                      <td>{row.supplierName ?? "—"}</td>
                      <td>
                        {row.location
                          ? row.location.name +
                            " · " +
                            row.location.code
                          : "Sin ubicación histórica"}
                      </td>
                      <td>{rows.length}</td>
                      <td>
                        {money(total(rows, "grossCost"), currency)}
                      </td>
                      <td>
                        {money(
                          total(rows, "discountAmount"),
                          currency
                        )}
                      </td>
                      <td>
                        {money(
                          total(rows, "additionalCostAmount"),
                          currency
                        )}
                      </td>
                      <td>
                        {money(total(rows, "netCost"), currency)}
                      </td>
                      <td>{row.createdByName}</td>
                      <td>
                        <Button
                          variant="soft"
                          size="compact"
                          onClick={() => setOpened(row.movementId)}
                        >
                          <Eye size={16} />
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </DataTable>
          </div>

          {!filtered.length && (
            <Notice>
              No hay compras para los filtros seleccionados.
            </Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={filtered.length}
            itemLabel="compras"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}

      {opened && (
        <PurchaseDetail
          id={opened}
          currency={currency}
          timezone={timezone}
          onClose={() => setOpened("")}
        />
      )}
    </div>
  );
}

function PurchaseDetail({
  id,
  currency,
  timezone,
  onClose,
}: {
  id: string;
  currency: string;
  timezone: string;
  onClose: () => void;
}) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadPurchase(session, signal, id),
    [id]
  );

  const query = useInventoryQuery("purchase:" + id, loader);
  const purchase = query.data;

  return (
    <Modal title="Detalle de compra" wide onClose={onClose}>
      {query.pending && <p role="status">Cargando compra…</p>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="soft" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {purchase && (
        <div className="grid gap-5">
          <p className="text-sm text-muted">
            M-{purchase.id} · Compra
          </p>

          <dl className="grid gap-4 sm:grid-cols-3">
            {Object.entries({
              Ubicación:
                purchase.location.name +
                " · " +
                purchase.location.code,
              "Fecha y hora": new Intl.DateTimeFormat("es-CO", {
                timeZone: timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(purchase.createdAt)),
              Referencia: purchase.externalReference ?? "—",
              Responsable: purchase.createdByName,
              Notas: purchase.notes ?? "—",
              Proveedor: purchase.supplier?.name ?? "—",
              "Documento del proveedor":
                purchase.supplier?.document ?? "—",
              "Fecha documental": purchase.documentDate ?? "—",
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <DataTable
            headers={[
              "Artículo",
              "Presentación",
              "Cantidad de presentaciones",
              "Factor",
              "Cantidad base",
              "Bruto",
              "Descuento",
              "Adicionales",
              "Neto",
              "Costo / unidad",
            ]}
          >
            {purchase.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.inventoryItemName}</td>
                <td>{line.presentation.name}</td>
                <td>{line.purchasedQuantity}</td>
                <td>
                  {quantity(
                    line.presentation.conversionFactor,
                    line.baseUnit
                  )}
                </td>
                <td>{quantity(line.baseQuantity, line.baseUnit)}</td>
                <td>{money(line.grossCost, currency)}</td>
                <td>{money(line.discountAmount, currency)}</td>
                <td>{money(line.additionalCostAmount, currency)}</td>
                <td>{money(line.netCost, currency)}</td>
                <td>
                  {cost(line.unitCost, line.baseUnit, currency)}
                </td>
              </tr>
            ))}
          </DataTable>

          <strong className="rounded-xl border border-outline p-4 text-xl">
            Costo neto total:{" "}
            {money(purchase.costs.netTotal, currency)}
          </strong>

          <h3 className="font-semibold">
            Impacto físico y económico
          </h3>

          <DataTable
            headers={[
              "Artículo",
              "Cantidad",
              "Saldo anterior",
              "Saldo resultante",
              "Costo total",
              "Valor anterior",
              "Valor resultante",
              "Promedio anterior",
              "Promedio nuevo",
            ]}
          >
            {purchase.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.inventoryItemName}</td>
                <td>{quantity(line.baseQuantity, line.baseUnit)}</td>
                <td>{quantity(line.balanceBefore, line.baseUnit)}</td>
                <td>{quantity(line.balanceAfter, line.baseUnit)}</td>
                <td>{money(line.netCost, currency)}</td>
                <td>{money(line.inventoryValueBefore, currency)}</td>
                <td>{money(line.inventoryValueAfter, currency)}</td>
                <td>
                  {cost(
                    line.averageUnitCostBefore,
                    line.baseUnit,
                    currency
                  )}
                </td>
                <td>
                  {cost(
                    line.averageUnitCostAfter,
                    line.baseUnit,
                    currency
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </Modal>
  );
}
