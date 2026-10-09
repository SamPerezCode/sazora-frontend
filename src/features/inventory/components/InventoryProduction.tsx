import { useCallback, useState } from "react";
import { Eye, Factory, RefreshCw } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  getProduction,
  getProductionPage,
  listProduction,
} from "../services/production.service";
import type { ProductionSummary } from "../services/production.service";
import {
  formatQuantity,
  unitLabels,
  validTimeZone,
} from "../utils/inventory-format";
import {
  InventoryLoadError,
  InventorySkeleton,
} from "./InventoryStates";
import { ProductionForm } from "./ProductionForm";
import { ProductionLines } from "./ProductionLines";

function dateLabel(value: string, zone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(value));
}

export function InventoryProduction({
  revision,
  onChanged,
}: {
  revision: number;
  onChanged: () => void;
}) {
  const { session, settings } = useAppShell();

  const resource = useInventoryQuery(
    "production",
    listProduction,
    revision
  );

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [detailRevision, setDetailRevision] = useState(0);

  const zone = validTimeZone(settings.data?.timezone) ?? "UTC";

  const rows = [...(resource.data ?? [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / size))
  );

  const visible = rows.slice((current - 1) * size, current * size);

  function refresh() {
    resource.refresh();
    setDetailRevision((value) => value + 1);
  }

  function closeForm() {
    setCreating(false);
    refresh();
    onChanged();
  }

  return (
    <>
      <header className="inventory-heading">
        <div>
          <h2>Producción</h2>

          <p>
            Registra transformaciones: insumos que salen y productos
            que entran al inventario.
          </p>
        </div>

        <div className="inventory-buttons">
          <Button
            size="sm"
            variant="secondary"
            loading={resource.pending}
            onClick={refresh}
          >
            <RefreshCw size={16} />
            Actualizar
          </Button>

          <Button size="sm" onClick={() => setCreating(true)}>
            <Factory size={16} />
            Registrar producción
          </Button>
        </div>
      </header>

      {notice && (
        <p className="inventory-message" role="status">
          {notice}
        </p>
      )}

      {zone === "UTC" && (
        <p className="inventory-muted">Fechas mostradas en UTC.</p>
      )}

      {resource.loading ? (
        <InventorySkeleton />
      ) : !resource.data ? (
        <InventoryLoadError
          message={resource.error}
          status={resource.status}
          busy={resource.pending}
          onRetry={refresh}
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

          {rows.length ? (
            <>
              <ProductionTable
                rows={visible}
                zone={zone}
                revision={revision + detailRevision}
                onDetail={setSelected}
              />

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
          ) : (
            <div className="inventory-state" role="status">
              <Factory size={26} />

              <h3>Aún no hay producciones</h3>

              <p>
                Registra los insumos consumidos y los productos
                obtenidos.
              </p>

              <Button size="sm" onClick={() => setCreating(true)}>
                Registrar producción
              </Button>
            </div>
          )}
        </>
      )}

      {creating && (
        <ProductionForm
          key={session.accessToken}
          onClose={closeForm}
          onSaved={() => {
            setNotice("Producción registrada.");
            closeForm();
          }}
        />
      )}

      {selected && (
        <ProductionDetail
          key={selected + session.accessToken}
          id={selected}
          zone={zone}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function ProductionTable({
  rows,
  zone,
  revision,
  onDetail,
}: {
  rows: ProductionSummary[];
  zone: string;
  revision: number;
  onDetail: (id: string) => void;
}) {
  const idsKey = JSON.stringify(rows.map((row) => row.id));

  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      getProductionPage(
        JSON.parse(idsKey) as string[],
        session,
        signal
      ),
    [idsKey]
  );

  const details = useInventoryQuery(
    "production-page:" + idsKey,
    loader,
    revision
  );

  return (
    <>
      {details.error && (
        <div
          className="inventory-message inventory-error"
          role="alert"
        >
          <span>
            No pudimos cargar todos los artículos: {details.error}
          </span>

          <Button
            size="sm"
            variant="secondary"
            onClick={details.refresh}
          >
            Reintentar
          </Button>
        </div>
      )}

      <div className="inv-data-table" aria-busy={details.pending}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Identificador</th>
              <th>Insumos consumidos</th>
              <th>Productos obtenidos</th>
              <th>Responsable</th>
              <th>Notas</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const detail = details.data?.find(
                (value) => value.id === row.id
              );

              return (
                <tr key={row.id}>
                  <td data-label="Fecha">
                    {dateLabel(row.createdAt, zone)}
                  </td>

                  <td data-label="Identificador">
                    <strong>P-{row.id}</strong>
                  </td>

                  {(["OUT", "IN"] as const).map((direction) => (
                    <td
                      key={direction}
                      data-label={
                        direction === "OUT" ? "Insumos" : "Resultados"
                      }
                    >
                      {detail ? (
                        <ul className="production-table-lines">
                          {detail.lines
                            .filter(
                              (line) => line.direction === direction
                            )
                            .map((line) => (
                              <li key={line.id}>
                                <span data-direction={direction}>
                                  {direction === "OUT" ? "↗" : "↙"}
                                </span>{" "}
                                {line.inventoryItemName}{" "}
                                {formatQuantity(line.quantity)}{" "}
                                {unitLabels[line.baseUnit]}
                              </li>
                            ))}
                        </ul>
                      ) : details.pending ? (
                        "Cargando…"
                      ) : (
                        "No disponible"
                      )}
                    </td>
                  ))}

                  <td data-label="Responsable">
                    {row.createdByName}
                  </td>

                  <td data-label="Notas">
                    {row.notes || "Sin notas"}
                  </td>

                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onDetail(row.id)}
                    >
                      <Eye size={16} />
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductionDetail({
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
      getProduction(id, session, signal),
    [id]
  );

  const resource = useInventoryQuery(
    "production-detail:" + id,
    loader
  );

  return (
    <BottomSheet
      id={"production-" + id}
      open
      variant="modal"
      title={"Producción P-" + id}
      className="inv-dialog inv-centered inv-production-detail"
      onClose={onClose}
    >
      <div className="inv-dialog-body">
        {resource.loading ? (
          <p role="status">Cargando producción…</p>
        ) : !resource.data ? (
          <InventoryLoadError
            message={resource.error}
            status={resource.status}
            busy={resource.pending}
            onRetry={resource.refresh}
          />
        ) : (
          <>
            <p className="inv-muted">
              {dateLabel(resource.data.createdAt, zone)}
              {" · "}
              {resource.data.createdByName}
            </p>

            <p>{resource.data.notes || "Sin notas generales"}</p>

            <ProductionLines lines={resource.data.lines} />
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
