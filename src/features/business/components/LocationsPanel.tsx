import { useState } from "react";
import {
  Factory,
  Pencil,
  Plus,
  Power,
  Search,
  Store,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { hasPermission } from "../../auth/utils/permissions";
import { useAdminResource } from "../../../hooks/useAdminResource";
import { useInventoryRealtime } from "../../../hooks/useInventoryRealtime";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { getConfigurationLocations } from "../services/organization.service";
import { locationTypes } from "../schemas/organization.schema";
import type { BusinessLocation } from "../schemas/organization.schema";
import { ConfigurationState } from "./ConfigurationState";
import {
  LocationCapabilities,
  LocationDialog,
} from "./LocationDialog";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function LocationsPanel() {
  const { session } = useAppShell();
  const canManage = hasPermission(session, "locations.manage");

  const resource = useAdminResource(
    getConfigurationLocations,
    "configuration-locations",
    "locations.read",
    true
  );

  const [search, setSearch] = useState("");
  const [capability, setCapability] = useState("ALL");
  const [activity, setActivity] = useState("ALL");
  const [notice, setNotice] = useTimedMessage();
  const [savedId, setSavedId] = useState("");

  const [action, setAction] = useState<{
    kind: "create" | "edit" | "detail" | "status";
    id?: string;
  } | null>(null);

  useInventoryRealtime(session, () => {
    if (resource.pending || action) return false;

    resource.refresh();
    return true;
  });

  const query = normalize(search.trim());
  const items = resource.data;

  const visible = (items ?? []).filter(
    (item) =>
      (!query ||
        normalize(item.name).includes(query) ||
        normalize(item.code).includes(query)) &&
      (capability === "ALL" ||
        (capability === "INVENTORY" && item.isInventoryLocation) ||
        (capability === "PRODUCTION" && item.isProductionLocation) ||
        (capability === "SALES" && item.isSalesLocation)) &&
      (activity === "ALL" ||
        item.isActive === (activity === "ACTIVE"))
  );

  function clearFilters() {
    setSearch("");
    setCapability("ALL");
    setActivity("ALL");
  }

  function saved(location: BusinessLocation) {
    setAction(null);
    clearFilters();
    setSavedId(location.id);
    setNotice(
      "Ubicación " + location.name + " guardada correctamente."
    );
    resource.refresh();
  }

  const create = canManage ? (
    <Button size="sm" onClick={() => setAction({ kind: "create" })}>
      <Plus size={16} aria-hidden="true" />
      Nueva ubicación
    </Button>
  ) : null;

  return (
    <section className="configuration-section locations-panel">
      <header className="configuration-heading locations-heading">
        <h2>Sedes y planta</h2>
        {create}
      </header>

      <div className="locations-filters">
        <div className="locations-search">
          <TextField
            label="Buscar por nombre o código"
            type="search"
            icon={Search}
            placeholder="Buscar por nombre o código"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>

        <SelectField
          label="Capacidad"
          value={capability}
          onValueChange={setCapability}
          options={[
            { value: "ALL", label: "Todas las capacidades" },
            { value: "INVENTORY", label: "Inventario" },
            { value: "PRODUCTION", label: "Producción" },
            { value: "SALES", label: "Puede vender" },
          ]}
        />

        <SelectField
          label="Estado"
          value={activity}
          onValueChange={setActivity}
          options={[
            { value: "ALL", label: "Todos" },
            { value: "ACTIVE", label: "Activas" },
            { value: "INACTIVE", label: "Inactivas" },
          ]}
        />
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      {items !== undefined && resource.error && (
        <Alert>
          <p>
            No pudimos actualizar el listado. Se muestran los últimos
            datos consultados.
          </p>

          <p>{resource.error}</p>

          <Button variant="secondary" onClick={resource.refresh}>
            Reintentar
          </Button>
        </Alert>
      )}

      {items === undefined ? (
        <ConfigurationState
          pending={resource.pending}
          error={resource.error}
          onRetry={resource.refresh}
        />
      ) : !items?.length ? (
        <ConfigurationState>{create}</ConfigurationState>
      ) : !visible.length ? (
        <div className="configuration-card configuration-state">
          <h3>No hay ubicaciones con estos filtros</h3>

          <Button variant="secondary" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <ul className="locations-list" aria-label="Ubicaciones">
          {visible.map((location) => {
            const Icon =
              location.locationType === "POINT_OF_SALE"
                ? Store
                : Factory;

            return (
              <li
                key={location.id}
                className="locations-row"
                data-inactive={!location.isActive}
                data-highlight={location.id === savedId}
              >
                <Icon
                  className="locations-icon"
                  size={22}
                  aria-hidden="true"
                />

                <div className="locations-information">
                  <p className="locations-code">
                    {location.code} ·{" "}
                    {
                      locationTypes.find(
                        (type) => type.value === location.locationType
                      )?.label
                    }
                  </p>

                  <button
                    type="button"
                    className="locations-name"
                    aria-label={"Ver detalle de " + location.name}
                    onClick={() =>
                      setAction({
                        kind: "detail",
                        id: location.id,
                      })
                    }
                  >
                    {location.name}
                  </button>

                  <p className="locations-address">
                    {[
                      location.address || "Sin dirección",
                      location.municipalityName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  <div className="locations-badges">
                    <span
                      className="locations-status"
                      data-active={location.isActive}
                    >
                      {location.isActive ? "Activa" : "Inactiva"}
                    </span>

                    <LocationCapabilities location={location} />
                  </div>
                </div>

                {canManage && (
                  <div className="locations-actions">
                    <button
                      type="button"
                      aria-label={"Editar " + location.name}
                      title="Editar ubicación"
                      onClick={() =>
                        setAction({
                          kind: "edit",
                          id: location.id,
                        })
                      }
                    >
                      <Pencil size={17} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      aria-label={
                        (location.isActive
                          ? "Desactivar "
                          : "Activar ") + location.name
                      }
                      title={
                        location.isActive
                          ? "Desactivar ubicación"
                          : "Activar ubicación"
                      }
                      onClick={() =>
                        setAction({
                          kind: "status",
                          id: location.id,
                        })
                      }
                    >
                      <Power size={17} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {action && (
        <LocationDialog
          key={action.kind + ":" + (action.id ?? "new")}
          action={action}
          onSaved={saved}
          onClose={(refresh = false) => {
            setAction(null);

            if (refresh) {
              resource.refresh();
            }
          }}
        />
      )}
    </section>
  );
}
