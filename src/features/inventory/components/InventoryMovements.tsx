import { useCallback, useState } from "react";
import {
  Eye,
  FilterX,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { Pagination } from "../../../components/ui/Pagination";
import type { AuthSession } from "../../auth/types/auth.types";
import type { InventoryItem } from "../schemas/inventory.schema";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  InventoryLoadError,
  InventorySkeleton,
} from "./InventoryStates";
import { movementLabels } from "../services/inventory-operations";
import {
  loadMovement,
  loadMovementIndex,
  loadMovements,
  movementReference,
} from "../services/inventory-workspace";
import {
  dayKey,
  formatQuantity,
  searchKey,
  unitLabels,
  validTimeZone,
} from "../utils/inventory-format";

function dateLabel(value: string, zone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: zone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InventoryMovements({
  items,
  initialItemId = "",
  revision,
  onRegister,
}: {
  items: InventoryItem[];
  initialItemId?: string;
  revision: number;
  onRegister: () => void;
}) {
  const { settings } = useAppShell();

  const zone = validTimeZone(settings.data?.timezone) ?? "UTC";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [itemId, setItemId] = useState(initialItemId);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const [selected, setSelected] = useState<string | null>(null);

  const indexed = !!search.trim() || !!itemId;

  const resource = useInventoryQuery(
    indexed ? "movement-index" : "movements",
    indexed ? loadMovementIndex : loadMovements,
    revision
  );

  const rows = resource.data ?? [];
  const query = searchKey(search);

  const invalidDates = !!from && !!to && from > to;

  const filtered = rows
    .filter((row) => {
      const day = dayKey(row.createdAt, zone);

      return (
        !invalidDates &&
        (!type || row.movementType === type) &&
        (!userId || row.createdByMembershipId === userId) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!itemId ||
          row.lines?.some(
            (line) => line.inventoryItemId === itemId
          )) &&
        (!query ||
          searchKey(
            [
              row.notes,
              movementReference(row),
              ...(row.lines?.map((line) => line.inventoryItemName) ??
                []),
            ].join(" ")
          ).includes(query))
      );
    })
    .sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size))
  );

  const visible = filtered.slice(
    (current - 1) * size,
    current * size
  );

  const users = [
    ...new Map(
      rows.map((row) => [
        row.createdByMembershipId,
        {
          value: row.createdByMembershipId,
          label: row.createdByName,
        },
      ])
    ).values(),
  ];

  function clear() {
    setSearch("");
    setType("");
    setItemId("");
    setUserId("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <>
      <header className="inventory-heading">
        <div>
          <h2>Movimientos de inventario</h2>

          <p>
            Historial de entradas y salidas. Las ventas y aperturas se
            registran automáticamente.
          </p>
        </div>

        <div className="inventory-buttons">
          <Button
            size="sm"
            variant="secondary"
            loading={resource.pending}
            onClick={resource.refresh}
          >
            <RefreshCw size={16} />
            Actualizar
          </Button>

          <Button size="sm" onClick={onRegister}>
            <SlidersHorizontal size={16} />
            Registrar movimiento
          </Button>
        </div>
      </header>

      <div className="inv-workspace-filters">
        <label className="inv-filter-search">
          <span className="sr-only">Buscar movimientos</span>

          <input
            type="search"
            value={search}
            placeholder="Buscar en notas, referencia o artículo"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <SelectField
          label="Tipo"
          hideLabel
          value={type}
          options={[
            { value: "", label: "Todos los tipos" },
            ...Object.entries(movementLabels).map(
              ([value, label]) => ({ value, label })
            ),
          ]}
          onValueChange={(value) => {
            setType(value);
            setPage(1);
          }}
        />

        <SelectField
          label="Artículo"
          hideLabel
          value={itemId}
          options={[
            { value: "", label: "Todos los artículos" },
            ...items.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
          onValueChange={(value) => {
            setItemId(value);
            setPage(1);
          }}
        />

        <SelectField
          label="Responsable"
          hideLabel
          value={userId}
          options={[
            { value: "", label: "Todos los usuarios" },
            ...users,
          ]}
          onValueChange={(value) => {
            setUserId(value);
            setPage(1);
          }}
        />

        <label>
          Desde
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Hasta
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <Button size="sm" variant="secondary" onClick={clear}>
          <FilterX size={16} />
          Limpiar filtros
        </Button>
      </div>

      {zone === "UTC" && (
        <p className="inventory-muted">Fechas mostradas en UTC.</p>
      )}

      {invalidDates && (
        <p className="inv-error" role="alert">
          La fecha inicial debe ser anterior o igual a la final.
        </p>
      )}

      {resource.loading ? (
        <InventorySkeleton />
      ) : resource.data === null ? (
        <InventoryLoadError
          message={resource.error}
          status={resource.status}
          busy={resource.pending}
          onRetry={resource.refresh}
        />
      ) : (
        <>
          {resource.error && (
            <p
              className="inventory-message inventory-error"
              role="alert"
            >
              {resource.error} Se conserva la última consulta.
            </p>
          )}

          {visible.length ? (
            <div
              className="inv-data-table"
              aria-busy={resource.pending}
            >
              <table>
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Tipo</th>
                    <th>Referencia</th>
                    <th>Notas</th>
                    <th>Responsable</th>
                    <th>Líneas</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Fecha y hora">
                        {dateLabel(row.createdAt, zone)}
                      </td>

                      <td data-label="Tipo">
                        {movementLabels[row.movementType]}
                      </td>

                      <td data-label="Referencia">
                        {movementReference(row)}
                      </td>

                      <td data-label="Notas">
                        {row.notes || "Sin notas"}
                      </td>

                      <td data-label="Responsable">
                        {row.createdByName}
                      </td>

                      <td data-label="Líneas">{row.lineCount}</td>

                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelected(row.id)}
                          aria-label={"Ver movimiento #" + row.id}
                        >
                          <Eye size={16} />
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inventory-state" role="status">
              <h3>
                {rows.length
                  ? "No encontramos movimientos"
                  : "Aún no hay movimientos"}
              </h3>

              <p>
                {rows.length
                  ? "Prueba con otros filtros."
                  : "Los movimientos registrados aparecerán aquí."}
              </p>
            </div>
          )}

          <Pagination
            page={current}
            pageSize={size}
            totalItems={filtered.length}
            itemLabel="movimientos"
            totalLabel={rows.length + " en total"}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}

      {selected && (
        <MovementDetailDialog
          key={selected}
          id={selected}
          zone={zone}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MovementDetailDialog({
  id,
  zone,
  onClose,
}: {
  id: string;
  zone: string;
  onClose: () => void;
}) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadMovement(id, session, signal),
    [id]
  );

  const resource = useInventoryQuery("movement:" + id, loader);

  const movement = resource.data;

  return (
    <BottomSheet
      id={"movement-detail-" + id}
      open
      variant="modal"
      title="Detalle del movimiento"
      className="inv-dialog inv-dialog-wide inv-centered"
      onClose={onClose}
    >
      <div className="inv-dialog-body">
        {resource.loading ? (
          <p role="status">Cargando movimiento…</p>
        ) : !movement ? (
          <InventoryLoadError
            message={resource.error}
            status={resource.status}
            busy={resource.pending}
            onRetry={resource.refresh}
          />
        ) : (
          <>
            <dl className="inv-summary">
              {[
                ["Identificador", "Movimiento #" + movement.id],
                ["Tipo", movementLabels[movement.movementType]],
                ["Fecha y hora", dateLabel(movement.createdAt, zone)],
                ["Responsable", movement.createdByName],
                ["Origen o referencia", movementReference(movement)],
                ["Número de líneas", String(movement.lines.length)],
                ["Notas generales", movement.notes || "Sin notas"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <h3>Artículos afectados</h3>

            {movement.lines.map((line) => (
              <article className="inv-line" key={line.id}>
                <div className="inventory-heading">
                  <strong>{line.inventoryItemName}</strong>

                  <span data-direction={line.direction}>
                    {line.direction === "IN"
                      ? "↙ Entrada"
                      : "↗ Salida"}
                  </span>
                </div>

                <p className="inv-muted">
                  Unidad: {unitLabels[line.baseUnit]}
                </p>

                <dl className="inv-movement-balances">
                  <div>
                    <dt>Cantidad</dt>

                    <dd data-direction={line.direction}>
                      {line.direction === "IN" ? "+" : "−"}
                      {formatQuantity(line.quantity)}
                    </dd>
                  </div>

                  <div>
                    <dt>Saldo anterior</dt>
                    <dd>{formatQuantity(line.balanceBefore)}</dd>
                  </div>

                  <div>
                    <dt>Saldo posterior</dt>
                    <dd>{formatQuantity(line.balanceAfter)}</dd>
                  </div>
                </dl>

                <p className="inv-muted">
                  {line.notes || "Sin nota"}
                </p>
              </article>
            ))}
          </>
        )}
      </div>

      <footer className="inv-dialog-footer">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </footer>
    </BottomSheet>
  );
}
