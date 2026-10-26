import { useCallback, useState } from "react";
import { FilterX, Plus, Search } from "lucide-react";
import type { AuthSession } from "../../auth/types/auth.types";
import type { Movement } from "../schemas/inventory-audit.schema";
import { DateField } from "../../../components/forms/DateField";
import { Pagination } from "../../../components/ui/Pagination";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  loadActivity,
  loadMovement,
} from "../services/inventory-audit.service";
import { dayKey, searchKey } from "../utils/inventory-format";
import { money, quantity } from "../utils/inventory-value";
import {
  allocationLabel,
  valuedTotal,
} from "../utils/inventory-production-view";
import { Button } from "./InventoryButton";
import { Choice, Notice } from "./InventoryLocationUI";
import { InventoryMovementDetail } from "./InventoryMovementDetail";
import { InventoryMovementList } from "./InventoryMovementList";
import { InventoryResponsiveRecords } from "./InventoryResponsiveRecords";

interface Props {
  production?: boolean;
  items: { id: string; name: string }[];
  locationId: string;
  currency: string;
  timezone: string;
  revision: number;
  canCreate: boolean;
  onCreate: () => void;
}

function useProductionDetails(idsKey: string, revision: number) {
  const loader = useCallback(
    async (session: AuthSession, signal: AbortSignal) => {
      const ids = JSON.parse(idsKey) as string[];
      const result: Movement[] = [];

      for (let index = 0; index < ids.length; index += 4) {
        signal.throwIfAborted();

        const batch = await Promise.all(
          ids
            .slice(index, index + 4)
            .map((id) => loadMovement(session, signal, id, true))
        );

        result.push(...batch);
      }

      signal.throwIfAborted();
      return result;
    },
    [idsKey]
  );

  return useInventoryQuery(
    "production-lines:" + idsKey,
    loader,
    revision
  );
}

function InventoryProductionActivity({
  items,
  locationId,
  currency,
  timezone,
  revision,
  canCreate,
  onCreate,
}: Omit<Props, "production">) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [itemId, setItemId] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opened, setOpened] = useState("");

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadActivity(session, signal, true),
    []
  );

  const query = useInventoryQuery(
    "production-list",
    loader,
    revision
  );

  const invalidDates = !!from && !!to && from > to;

  const candidates = (query.data ?? [])
    .filter((row) => {
      const day = dayKey(row.createdAt, timezone);

      return (
        !invalidDates &&
        (!locationId || row.location?.id === locationId) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        searchKey(
          [
            row.id,
            "M-" + row.id,
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
  // Sin ese filtro, solo se cargan los detalles de la página.
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

  const details = useProductionDetails(idsKey, revision);

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
    setPage(1);
  }

  const records = rows
    .slice((current - 1) * size, current * size)
    .map((row) => {
      const movement = byId.get(row.id);

      const inputs =
        movement?.lines.filter((line) => line.direction === "OUT") ??
        [];

      const outputs =
        movement?.lines.filter((line) => line.direction === "IN") ??
        [];

      const total = valuedTotal(inputs);

      return {
        id: row.id,
        fields: [
          {
            label: "Fecha",
            value: new Intl.DateTimeFormat("es-CO", {
              timeZone: timezone,
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(row.createdAt)),
          },
          {
            label: "Producción",
            value: row.externalReference || "M-" + row.id,
          },
          {
            label: "Ubicación",
            value: row.location
              ? row.location.name + " · " + row.location.code
              : "Sin ubicación histórica",
          },
          {
            label: "Insumos",
            value:
              inputs
                .map(
                  (line) =>
                    line.inventoryItemName +
                    " · " +
                    quantity(line.quantity, line.baseUnit)
                )
                .join("; ") || "Sin insumos",
          },
          {
            label: "Productos obtenidos",
            value:
              outputs
                .map((line) => {
                  const allocation = allocationLabel(line, total);

                  return (
                    line.inventoryItemName +
                    " · " +
                    quantity(line.quantity, line.baseUnit) +
                    (allocation === "—"
                      ? ""
                      : " · " + allocation + " calculado") +
                    " · " +
                    money(
                      line.costStatus === "VALUED"
                        ? line.totalCost
                        : null,
                      currency
                    )
                  );
                })
                .join("; ") || "Sin productos obtenidos",
          },
          {
            label: "Costo total",
            value:
              total === null
                ? "Sin valoración completa"
                : money(total, currency),
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
                aria-label={"Ver detalle de producción M-" + row.id}
                onClick={() => setOpened(row.id)}
              >
                Ver detalle
              </Button>
            ),
          },
        ],
      };
    });

  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <Button
          className="min-h-11"
          disabled={!canCreate}
          onClick={onCreate}
        >
          <Plus size={17} aria-hidden="true" />
          Registrar producción
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 border-b border-outline pb-4">
        <div className="grid min-w-0 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3">
          <label className="grid min-w-0 gap-2 text-sm text-heading">
            <span>Buscar</span>

            <div className="relative min-w-0">
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
                className="h-11 w-full min-w-0 rounded-xl border border-outline bg-surface pl-10 pr-3 text-sm text-heading outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </label>

          <Button
            variant="ghost"
            className="min-h-11 justify-self-end"
            onClick={clear}
          >
            <FilterX size={17} aria-hidden="true" />
            Limpiar filtros
          </Button>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3 [&_.date-field-trigger]:min-h-11 [&_.select-field-trigger]:min-h-11!">
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
              {
                value: "",
                label: "Todos los artículos",
              },
              ...items.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
        </div>
      </div>

      {invalidDates && (
        <Notice>
          La fecha inicial debe ser anterior o igual a la final.
        </Notice>
      )}

      {pending && <Notice>Consultando producciones…</Notice>}

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
          <InventoryResponsiveRecords
            label="Producciones"
            rows={records}
          />

          {!rows.length && (
            <Notice>No hay producciones para estos filtros.</Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={rows.length}
            itemLabel="producciones"
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
          production
          currency={currency}
          timezone={timezone}
          onClose={() => setOpened("")}
        />
      )}
    </div>
  );
}

export function InventoryActivity({
  production = false,
  ...props
}: Props) {
  return production ? (
    <InventoryProductionActivity {...props} />
  ) : (
    <InventoryMovementList {...props} />
  );
}
