import { useCallback, useState } from "react";
import { Link } from "react-router";
import {
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { DiningTableIcon } from "../../../components/ui/DiningTableIcon";
import type { AuthSession } from "../../auth/types/auth.types";
import { tableLocationLabel } from "../schemas/restaurant-table.schema";
import { useRestaurantTables } from "../hooks/useRestaurantTables";
import { RestaurantTableForm } from "./RestaurantTableForm";
import type { TableModalMode } from "./RestaurantTableForm";
import { RestaurantTableList } from "./RestaurantTableList";
import "../restaurant-tables.css";

export function RestaurantTablesPanel() {
  const { session } = useAppShell();

  return (
    <TablesContent
      session={session}
      key={[
        session.business.id,
        session.membership.id,
        session.accessToken,
      ].join(":")}
    />
  );
}

function TablesContent({ session }: { session: AuthSession }) {
  const resource = useRestaurantTables(session);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState<{
    mode: TableModalMode;
    id?: string;
  } | null>(null);

  const close = useCallback(() => setModal(null), []);

  const query = search.trim().toLocaleLowerCase("es");

  const filtered =
    !!query || status !== "all" || !!resource.locationId;

  const hasActiveLocations = resource.locations.some(
    (location) => location.isActive
  );

  const rows = resource.tables
    .filter(
      (table) =>
        (!query ||
          (table.code + " " + table.name)
            .toLocaleLowerCase("es")
            .includes(query)) &&
        (status === "all" || table.isActive === (status === "active"))
    )
    .sort(
      (a, b) =>
        a.location.name.localeCompare(b.location.name, "es") ||
        a.code.localeCompare(b.code, "es", { numeric: true }) ||
        a.id.localeCompare(b.id, "es", { numeric: true })
    );

  if (resource.denied) {
    return (
      <section className="rt-panel">
        <h2>Mesas</h2>

        <div className="rt-card rt-empty" role="alert">
          <ShieldAlert size={28} aria-hidden="true" />
          <strong>{resource.denied}</strong>
        </div>
      </section>
    );
  }

  const newButton = (
    <Button
      size="sm"
      disabled={
        resource.loading ||
        !!resource.error ||
        !hasActiveLocations ||
        !!modal
      }
      onClick={() => setModal({ mode: "create" })}
    >
      <Plus size={16} aria-hidden="true" />
      Nueva mesa
    </Button>
  );

  return (
    <section className="rt-panel">
      <header className="rt-header">
        <div>
          <h2>Mesas</h2>
          <p>Administra las mesas físicas de cada punto de venta.</p>
        </div>

        {newButton}
      </header>

      {resource.notice.message && (
        <Alert variant={resource.notice.error ? "error" : "success"}>
          {resource.notice.message}
        </Alert>
      )}

      <div className="rt-card">
        <div className="rt-filters">
          <label className="rt-search">
            <span className="sr-only">
              Buscar por código o nombre
            </span>

            <Search size={16} aria-hidden="true" />

            <input
              type="search"
              placeholder="Buscar por código o nombre"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <SelectField
            label="Punto de venta"
            hideLabel
            value={resource.locationId}
            disabled={resource.loading || !!resource.error}
            onValueChange={resource.selectLocation}
            options={[
              {
                value: "",
                label: "Todos los puntos de venta",
              },
              ...resource.locations.map((location) => ({
                value: location.id,
                label:
                  tableLocationLabel(location.name) +
                  " · " +
                  location.code +
                  (location.isActive ? "" : " (inactiva)"),
              })),
            ]}
          />

          <SelectField
            label="Estado de la mesa"
            hideLabel
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "all", label: "Todos los estados" },
              { value: "active", label: "Activas" },
              { value: "inactive", label: "Inactivas" },
            ]}
          />
        </div>

        {resource.loading ? (
          <div className="rt-skeleton" role="status" aria-busy="true">
            <span className="sr-only">
              Cargando mesas y puntos de venta…
            </span>

            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} />
            ))}
          </div>
        ) : resource.error ? (
          <div className="rt-empty" role="alert">
            <span className="rt-empty-icon">
              <WifiOff size={24} aria-hidden="true" />
            </span>

            <strong>No pudimos cargar las mesas</strong>
            <p>{resource.error}</p>

            <Button
              size="sm"
              variant="secondary"
              onClick={resource.retry}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reintentar
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rt-empty">
            <span className="rt-empty-icon">
              <DiningTableIcon size={24} aria-hidden="true" />
            </span>

            <strong>
              {filtered
                ? "No hay resultados con estos filtros."
                : "Aún no tienes mesas registradas."}
            </strong>

            <p>
              {filtered
                ? "Cambia o limpia los filtros."
                : hasActiveLocations
                  ? "Crea la primera mesa y asígnala a un punto de venta."
                  : "Necesitas un punto de venta activo para crear mesas."}
            </p>

            {filtered ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  resource.selectLocation("");
                }}
              >
                Limpiar filtros
              </Button>
            ) : hasActiveLocations ? (
              newButton
            ) : (
              <Link
                className="rt-link"
                to="/configuracion?section=locations"
              >
                Ir a Sedes y planta
              </Link>
            )}
          </div>
        ) : (
          <RestaurantTableList
            key={[search, status, resource.locationId].join(":")}
            tables={rows}
            disabled={!!modal}
            onEdit={(table) =>
              setModal({
                mode: "edit",
                id: table.id,
              })
            }
            onToggle={(table) =>
              setModal({
                mode: table.isActive ? "deactivate" : "reactivate",
                id: table.id,
              })
            }
          />
        )}
      </div>

      {!resource.loading &&
        !resource.error &&
        resource.tables.length > 0 &&
        !hasActiveLocations && (
          <p>
            No hay puntos de venta activos para crear mesas.{" "}
            <Link
              className="rt-link"
              to="/configuracion?section=locations"
            >
              Ir a Sedes y planta
            </Link>
          </p>
        )}

      {modal && (
        <RestaurantTableForm
          session={session}
          mode={modal.mode}
          tableId={modal.id}
          initialLocationId={resource.locationId}
          onClose={close}
          onSaved={resource.saved}
          onError={resource.handleError}
        />
      )}
    </section>
  );
}
