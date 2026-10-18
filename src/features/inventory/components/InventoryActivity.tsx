import { useCallback, useState } from "react";
import { Eye, FilterX, Plus } from "lucide-react";
import type { AuthSession } from "../../auth/types/auth.types";
import { DateField } from "../../../components/forms/DateField";
import { Pagination } from "../../../components/ui/Pagination";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { loadActivity } from "../services/inventory-audit.service";
import { dayKey, searchKey } from "../utils/inventory-format";
import { movementLabels } from "../utils/inventory-audit";
import { Button } from "./InventoryButton";
import {
  Choice,
  DataTable,
  Field,
  Notice,
} from "./InventoryLocationUI";
import { InventoryMovementDetail } from "./InventoryMovementDetail";

export function InventoryActivity({
  production = false,
  locationId,
  currency,
  timezone,
  revision,
  canCreate,
  onCreate,
}: {
  production?: boolean;
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
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opened, setOpened] = useState("");

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadActivity(session, signal, production),
    [production]
  );

  const query = useInventoryQuery(
    "inventory-activity:" + production,
    loader,
    revision
  );

  const rows = (query.data ?? []).filter((row) => {
    const day = dayKey(row.createdAt, timezone);

    return (
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
  });

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / size))
  );

  const change =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
    };

  return (
    <div className="grid min-w-0 gap-5">
      <Button disabled={!canCreate} onClick={onCreate}>
        <Plus size={17} />
        {production ? "Registrar producción" : "Registrar movimiento"}
      </Button>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Field
            label="Buscar referencia, responsable o motivo"
            value={search}
            onChange={change(setSearch)}
          />
        </div>

        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setFrom("");
            setTo("");
            setType("");
            setPage(1);
          }}
        >
          <FilterX size={17} />
          Limpiar filtros
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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

        {!production && (
          <Choice
            label="Tipo de movimiento"
            value={type}
            onValueChange={change(setType)}
            options={[
              { value: "", label: "Todos los tipos" },
              ...Object.entries(movementLabels).map(
                ([value, label]) => ({ value, label })
              ),
            ]}
          />
        )}
      </div>

      {query.pending && <Notice>Consultando registros…</Notice>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="secondary" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!query.pending && !query.error && (
        <>
          <DataTable
            headers={[
              "Fecha",
              "Tipo",
              "Ubicación",
              "Referencia",
              "Responsable",
              "Líneas",
              "Acción",
            ]}
          >
            {rows
              .slice((current - 1) * size, current * size)
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    {new Intl.DateTimeFormat("es-CO", {
                      timeZone: timezone,
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(row.createdAt))}
                  </td>
                  <td>{movementLabels[row.movementType]}</td>
                  <td>
                    {row.location
                      ? row.location.name + " · " + row.location.code
                      : "Sin ubicación histórica"}
                  </td>
                  <td>{row.externalReference ?? "M-" + row.id}</td>
                  <td>{row.createdByName}</td>
                  <td>{row.lineCount}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="compact"
                      onClick={() => setOpened(row.id)}
                    >
                      <Eye size={16} />
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
          </DataTable>

          {!rows.length && (
            <Notice>No hay registros para estos filtros.</Notice>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={rows.length}
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
        <InventoryMovementDetail
          id={opened}
          production={production}
          currency={currency}
          timezone={timezone}
          onClose={() => setOpened("")}
        />
      )}
    </div>
  );
}
