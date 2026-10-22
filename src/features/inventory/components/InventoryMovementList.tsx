import { useCallback, useState } from "react";
import { FilterX, Plus, Search } from "lucide-react";

import type { AuthSession } from "../../auth/types/auth.types";
import { DateField } from "../../../components/forms/DateField";
import { Pagination } from "../../../components/ui/Pagination";
import { InventoryMobileCards } from "./InventoryMobileCards";

import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  loadActivity,
  loadMovement,
} from "../services/inventory-audit.service";

import { dayKey, searchKey } from "../utils/inventory-format";
import { movementLabels } from "../utils/inventory-audit";
import {
  add,
  money,
  quantity,
  subtract,
} from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Choice, DataTable, Notice } from "./InventoryLocationUI";
import { InventoryMovementDetail } from "./InventoryMovementDetail";

type Movement = Awaited<ReturnType<typeof loadMovement>>;

async function loadDetails(
  session: AuthSession,
  signal: AbortSignal,
  idsKey: string
) {
  const ids = JSON.parse(idsKey) as string[];
  const result: Movement[] = [];

  for (let index = 0; index < ids.length; index += 4) {
    signal.throwIfAborted();

    const batch = await Promise.all(
      ids
        .slice(index, index + 4)
        .map((id) => loadMovement(session, signal, id))
    );

    result.push(...batch);
  }

  signal.throwIfAborted();

  return result;
}

function useMovementDetails(idsKey: string, revision: number) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadDetails(session, signal, idsKey),
    [idsKey]
  );

  return useInventoryQuery(
    "movement-lines:" + idsKey,
    loader,
    revision
  );
}

function economicImpact(movement: Movement) {
  if (
    !movement.lines.length ||
    movement.lines.some(
      (line) =>
        line.totalCost === null || line.costStatus !== "VALUED"
    )
  ) {
    return null;
  }

  const total = (direction: "IN" | "OUT") =>
    add(
      ...movement.lines
        .filter((line) => line.direction === direction)
        .map((line) => line.totalCost!)
    );

  return subtract(total("IN"), total("OUT"));
}

export function InventoryMovementList({
  items,
  locationId,
  currency,
  timezone,
  revision,
  canCreate,
  onCreate,
}: {
  items: { id: string; name: string }[];
  locationId: string;
  currency: string;
  timezone: string;
  revision: number;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [itemId, setItemId] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opened, setOpened] = useState("");

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadActivity(session, signal, false),
    []
  );

  const query = useInventoryQuery("movement-list", loader, revision);

  const invalidDates = !!from && !!to && from > to;

  const candidates = (query.data ?? [])
    .filter((row) => {
      const day = dayKey(row.createdAt, timezone);

      return (
        !invalidDates &&
        (!locationId || row.location?.id === locationId) &&
        (!type || row.movementType === type) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        searchKey(
          [
            row.id,
            row.externalReference,
            row.createdByName,
            row.notes,
          ].join(" ")
        ).includes(searchKey(search))
      );
    })
    .sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );

  const candidatePage = Math.min(
    page,
    Math.max(1, Math.ceil(candidates.length / size))
  );

  // Para filtrar por artículo se revisan todos los candidatos.
  // Sin ese filtro, solo se consultan los detalles de la página.
  const detailCandidates = itemId
    ? candidates
    : candidates.slice(
        (candidatePage - 1) * size,
        candidatePage * size
      );

  const idsKey = JSON.stringify(
    query.pending || query.error
      ? []
      : detailCandidates.map((row) => row.id)
  );

  const details = useMovementDetails(idsKey, revision);

  const byId = new Map(
    (details.data ?? []).map((row) => [row.id, row])
  );

  const rows = itemId
    ? candidates.filter((row) =>
        byId
          .get(row.id)
          ?.lines.some((line) => line.inventoryItemId === itemId)
      )
    : candidates;

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / size))
  );

  const pending = query.pending || details.pending;
  const error = query.error || details.error;

  const change =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
    };

  function clear() {
    setSearch("");
    setFrom("");
    setTo("");
    setItemId("");
    setType("");
    setPage(1);
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <Button disabled={!canCreate} onClick={onCreate}>
          <Plus size={16} aria-hidden="true" />
          Registrar movimiento
        </Button>
      </div>

      <div className="grid gap-4 border-b border-outline pb-4">
        <div className="grid min-w-0 grid-cols-1 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
          <label className="grid min-w-0 gap-2 text-sm text-heading">
            <span>Buscar</span>
            <div className="relative">
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />

              <input
                type="search"
                value={search}
                placeholder="Buscar referencia, responsable o motivo"
                onChange={(event) =>
                  change(setSearch)(event.target.value)
                }
                className="h-10 w-full min-w-0 rounded-xl border border-outline bg-surface pl-10 pr-3 text-sm text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </label>
          <Button
            variant="ghost"
            onClick={clear}
            className="min-h-11 justify-self-end"
          >
            <FilterX size={16} aria-hidden="true" />
            Limpiar filtros
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DateField
            label="Desde"
            value={from}
            max={to || undefined}
            timeZone={timezone}
            onValueChange={change(setFrom)}
          />

          <DateField
            label="Hasta"
            value={to}
            min={from || undefined}
            timeZone={timezone}
            onValueChange={change(setTo)}
          />

          <Choice
            label="Artículo"
            value={itemId}
            onValueChange={change(setItemId)}
            options={[
              { value: "", label: "Todos los artículos" },
              ...items.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />

          <Choice
            label="Tipo de movimiento"
            value={type}
            onValueChange={change(setType)}
            options={[
              { value: "", label: "Todos los movimientos" },
              ...Object.entries(movementLabels).map(
                ([value, label]) => ({ value, label })
              ),
            ]}
          />
        </div>
      </div>

      {invalidDates && (
        <Notice>
          La fecha inicial debe ser anterior o igual a la final.
        </Notice>
      )}

      {pending && <Notice>Consultando movimientos…</Notice>}

      {error && (
        <Notice>
          {error}{" "}
          <Button
            variant="ghost"
            onClick={query.error ? query.refresh : details.refresh}
          >
            Reintentar
          </Button>
        </Notice>
      )}

      {!pending && !error && !invalidDates && (
        <>
          <InventoryMobileCards
            label="Movimientos de inventario"
            rows={rows
              .slice((current - 1) * size, current * size)
              .map((row) => {
                const movement = byId.get(row.id);
                const impact = movement
                  ? economicImpact(movement)
                  : null;

                return {
                  id: row.id,
                  fields: [
                    {
                      label: "Fecha y hora",
                      value: new Intl.DateTimeFormat("es-CO", {
                        timeZone: timezone,
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(row.createdAt)),
                    },
                    {
                      label: "Tipo",
                      value: movementLabels[row.movementType],
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
                      label: "Referencia",
                      value: row.externalReference ?? "M-" + row.id,
                    },
                    {
                      label: "Responsable",
                      value: row.createdByName,
                    },
                    {
                      label: "Entradas / salidas",
                      value:
                        movement?.lines
                          .map(
                            (line) =>
                              (line.direction === "IN" ? "+" : "−") +
                              quantity(line.quantity, line.baseUnit) +
                              " " +
                              line.inventoryItemName
                          )
                          .join(" · ") || "Sin líneas",
                    },
                    {
                      label: "Impacto económico",
                      value:
                        impact === null
                          ? "Sin valoración completa"
                          : money(impact, currency),
                    },
                    {
                      label: "Estado",
                      value: (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Registrado
                        </span>
                      ),
                    },
                    {
                      label: "Acción",
                      value: (
                        <Button
                          variant="ghost"
                          size="compact"
                          className="min-h-11 hover:bg-accent! hover:text-on-accent!"
                          onClick={() => setOpened(row.id)}
                          aria-label={
                            "Ver detalle del movimiento M-" + row.id
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
          <div className="hidden min-w-0 md:block [&_table]:bg-surface">
            <DataTable
              headers={[
                "Fecha y hora",
                "Tipo",
                "Ubicación",
                "Referencia",
                "Responsable",
                "Entradas / salidas",
                "Impacto económico",
                "Estado",
                "Acción",
              ]}
            >
              {rows
                .slice((current - 1) * size, current * size)
                .map((row) => {
                  const movement = byId.get(row.id);
                  const impact = movement
                    ? economicImpact(movement)
                    : null;

                  return (
                    <tr key={row.id}>
                      <td>
                        {new Intl.DateTimeFormat("es-CO", {
                          timeZone: timezone,
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(row.createdAt))}
                      </td>

                      <td>{movementLabels[row.movementType]}</td>

                      <td>
                        {row.location
                          ? row.location.name +
                            " · " +
                            row.location.code
                          : "Sin ubicación histórica"}
                      </td>

                      <td>
                        {row.externalReference ?? "M-" + row.id}
                      </td>

                      <td>{row.createdByName}</td>

                      <td className="min-w-56 max-w-lg whitespace-normal">
                        {movement?.lines
                          .map(
                            (line) =>
                              (line.direction === "IN" ? "+" : "−") +
                              quantity(line.quantity, line.baseUnit) +
                              " " +
                              line.inventoryItemName
                          )
                          .join(" · ") || "Sin líneas"}
                      </td>

                      <td className="whitespace-nowrap">
                        {impact === null ? (
                          <span className="text-muted">
                            Sin valoración completa
                          </span>
                        ) : (
                          money(impact, currency)
                        )}
                      </td>

                      <td>
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Registrado
                        </span>
                      </td>

                      <td>
                        <Button
                          variant="ghost"
                          size="compact"
                          className="hover:bg-accent! hover:text-on-accent!"
                          onClick={() => setOpened(row.id)}
                          aria-label={
                            "Ver detalle del movimiento M-" + row.id
                          }
                        >
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </DataTable>
          </div>

          {!rows.length && (
            <Notice>No hay movimientos para estos filtros.</Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={rows.length}
            itemLabel="movimientos"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}

      {opened && (
        <InventoryMovementDetail
          id={opened}
          currency={currency}
          timezone={timezone}
          onClose={() => setOpened("")}
        />
      )}
    </div>
  );
}
