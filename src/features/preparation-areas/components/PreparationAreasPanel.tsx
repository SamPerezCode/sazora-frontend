import { useCallback, useState } from "react";
import { Link } from "react-router";
import {
  ChefHat,
  MapPin,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  areaLocationGroups,
  locationLabel,
} from "../schemas/preparation-area.schema";
import { usePreparationAreas } from "../hooks/usePreparationAreas";
import { PreparationAreaForm } from "./PreparationAreaForm";
import type { AreaMode } from "./PreparationAreaForm";
import { AreaLocationChips } from "./PreparationAreaLocations";
import "../preparation-areas.css";

export function PreparationAreasPanel() {
  const { session } = useAppShell();

  return (
    <AreasContent
      key={`${session.business.id}:${session.membership.id}:${session.accessToken}`}
      session={session}
    />
  );
}

function AreasContent({ session }: { session: AuthSession }) {
  const resource = usePreparationAreas(session);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState<{
    mode: AreaMode;
    id?: string;
  } | null>(null);

  const close = useCallback(() => setModal(null), []);

  const query = search.trim().toLocaleLowerCase("es");
  const filtered =
    !!query || status !== "all" || !!resource.locationId;

  const rows = resource.areas
    .filter(
      (area) =>
        (!query ||
          `${area.name} ${area.description ?? ""}`
            .toLocaleLowerCase("es")
            .includes(query)) &&
        (status === "all" || area.isActive === (status === "active"))
    )
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.name.localeCompare(b.name, "es")
    );

  const hasActiveLocations = resource.locations.some(
    (location) => location.isActive
  );

  const createDisabled =
    resource.loading ||
    !!resource.error ||
    !hasActiveLocations ||
    !!modal;

  const locationsLink = (
    <Link to="/configuracion?section=locations">
      Ir a Sedes y planta
    </Link>
  );

  if (resource.denied) {
    return (
      <Alert>
        No tienes permisos para administrar las áreas de preparación.
        Se ha solicitado una actualización de tu acceso.
      </Alert>
    );
  }

  const newButton = (
    <Button
      size="sm"
      disabled={createDisabled}
      onClick={() => setModal({ mode: "create" })}
    >
      <Plus size={16} aria-hidden="true" />
      Nueva área
    </Button>
  );

  return (
    <section className="pa-panel">
      <header className="pa-header">
        <div>
          <h2>Áreas de preparación</h2>
          <p>
            Define qué áreas reciben productos y comandas, y en cuáles
            ubicaciones funcionan.
          </p>
        </div>

        {newButton}
      </header>

      {resource.notice.message && (
        <Alert variant={resource.notice.error ? "error" : "success"}>
          {resource.notice.message}
        </Alert>
      )}

      {!resource.loading &&
        !resource.error &&
        resource.locations.length > 0 &&
        !hasActiveLocations && (
          <div className="pa-warning" role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              No hay ubicaciones activas disponibles. Activa una sede
              o planta antes de configurar las áreas. {locationsLink}
            </span>
          </div>
        )}

      <div className="pa-filters">
        <label className="pa-search">
          <span className="sr-only">
            Buscar por nombre o descripción
          </span>

          <Search size={16} aria-hidden="true" />

          <input
            type="search"
            placeholder="Buscar por nombre o descripción"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span className="sr-only">Filtrar por ubicación</span>

          <select
            value={resource.locationId}
            disabled={resource.loading || !!resource.error}
            onChange={(event) =>
              resource.selectLocation(event.target.value)
            }
          >
            <option value="">Todas las ubicaciones</option>

            {areaLocationGroups.map((group) => (
              <optgroup key={group.type} label={group.label}>
                {resource.locations
                  .filter(
                    (location) => location.locationType === group.type
                  )
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {locationLabel(location.name)} · {location.code}
                      {location.isActive ? "" : " (inactiva)"}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Filtrar por estado</span>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </label>
      </div>

      {resource.loading ? (
        <div className="pa-skeleton" role="status" aria-busy="true">
          <span className="sr-only">
            Cargando áreas y ubicaciones…
          </span>

          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} />
          ))}
        </div>
      ) : resource.error ? (
        <div className="pa-empty" role="alert">
          <WifiOff size={28} aria-hidden="true" />

          <strong>No pudimos cargar las áreas de preparación.</strong>

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
      ) : resource.locations.length === 0 ? (
        <div className="pa-empty">
          <MapPin size={28} aria-hidden="true" />

          <strong>Primero debes crear una sede o planta.</strong>

          <p>
            Las áreas de preparación necesitan al menos una ubicación
            donde funcionar.
          </p>

          {locationsLink}
        </div>
      ) : rows.length === 0 ? (
        <div className="pa-empty">
          <ChefHat size={28} aria-hidden="true" />

          <strong>
            {filtered
              ? "No hay resultados con estos filtros."
              : "Aún no tienes áreas de preparación."}
          </strong>

          <p>
            {filtered
              ? "Cambia o limpia los filtros para ver otras áreas."
              : "Crea áreas como Cocina, Barra o Panadería y asígnalas a tus sedes."}
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
          ) : (
            newButton
          )}
        </div>
      ) : (
        <div className="pa-table-wrap">
          <table className="pa-table">
            <caption className="sr-only">
              Áreas de preparación y ubicaciones asignadas
            </caption>

            <colgroup>
              <col className="pa-col-name" />
              <col className="pa-col-description" />
              <col />
              <col className="pa-col-order" />
              <col className="pa-col-status" />
              <col className="pa-col-actions" />
            </colgroup>

            <thead>
              <tr>
                <th scope="col">Área</th>
                <th scope="col">Descripción</th>
                <th scope="col">Ubicaciones asignadas</th>
                <th scope="col">Orden</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((area) => (
                <tr key={area.id} data-inactive={!area.isActive}>
                  <td data-label="Área" className="pa-name">
                    <span>
                      <ChefHat size={16} aria-hidden="true" />
                      <strong>{area.name}</strong>
                    </span>
                  </td>

                  <td
                    data-label="Descripción"
                    className="pa-description"
                  >
                    {area.description || "Sin descripción"}
                  </td>

                  <td data-label="Ubicaciones asignadas">
                    <AreaLocationChips
                      locations={area.locations}
                      compact
                    />
                  </td>

                  <td data-label="Orden" className="pa-order">
                    {area.displayOrder}
                  </td>

                  <td data-label="Estado">
                    <span
                      className="pa-status"
                      data-active={area.isActive}
                    >
                      <span aria-hidden="true">●</span>
                      {area.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>

                  <td className="pa-actions">
                    <ActionMenu
                      appearance="compact"
                      label={`Acciones de ${area.name}`}
                      disabled={!!modal}
                      actions={[
                        {
                          id: "edit",
                          label: "Editar área",
                          icon: (
                            <Pencil size={16} aria-hidden="true" />
                          ),
                          onSelect: () =>
                            setModal({
                              mode: "edit",
                              id: area.id,
                            }),
                        },
                        {
                          id: "locations",
                          label: "Administrar ubicaciones",
                          icon: (
                            <MapPin size={16} aria-hidden="true" />
                          ),
                          onSelect: () =>
                            setModal({
                              mode: "locations",
                              id: area.id,
                            }),
                        },
                        {
                          id: "status",
                          label: area.isActive
                            ? "Desactivar"
                            : "Activar",
                          danger: area.isActive,
                          icon: (
                            <Power size={16} aria-hidden="true" />
                          ),
                          onSelect: () =>
                            setModal({
                              mode: "status",
                              id: area.id,
                            }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PreparationAreaForm
          session={session}
          mode={modal.mode}
          areaId={modal.id}
          initialLocationId={resource.locationId}
          onClose={close}
          onSaved={resource.saved}
          onError={resource.handleError}
        />
      )}
    </section>
  );
}
