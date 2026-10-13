import { useState } from "react";
import {
  Eye,
  Factory,
  MapPin,
  Pencil,
  Plus,
  Power,
  Store,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Alert } from "../../../components/feedback/Alert";
import { SelectField } from "../../../components/forms/SelectField";
import { useAdminResource } from "../../../hooks/useAdminResource";
import { useInventoryRealtime } from "../../../hooks/useInventoryRealtime";
import { getLocations } from "../services/organization.service";
import { locationTypes } from "../schemas/organization.schema";
import type { BusinessLocation } from "../schemas/organization.schema";
import { ConfigurationState } from "./ConfigurationState";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import {
  LocationCapabilities,
  LocationDialog,
} from "./LocationDialog";

export function LocationsPanel() {
  const { session } = useAppShell();
  const resource = useAdminResource(getLocations, "locations");

  const [type, setType] = useState("ALL");
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

  const items = resource.data;

  const visible = (items ?? [])
    .filter(
      (item) =>
        (type === "ALL" || item.locationType === type) &&
        (activity === "ALL" ||
          item.isActive === (activity === "ACTIVE"))
    )
    .sort(
      (a, b) => Number(b.id === savedId) - Number(a.id === savedId)
    );

  function saved(location: BusinessLocation) {
    setAction(null);
    setType("ALL");
    setActivity("ALL");
    setSavedId(location.id);
    setNotice(
      "Ubicación " + location.name + " guardada correctamente."
    );
    resource.refresh();
  }

  const create = (
    <Button onClick={() => setAction({ kind: "create" })}>
      <Plus size={16} />
      Nueva ubicación
    </Button>
  );

  return (
    <section className="configuration-section">
      <header className="configuration-heading">
        <div>
          <h2>Sedes y planta</h2>
          <p>
            Administra los lugares físicos propios donde opera la
            organización.
          </p>
        </div>

        {create}
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          {
            label: "Plantas / bodegas",
            Icon: Factory,
            count: items?.filter(
              (item) => item.locationType === "PRODUCTION_WAREHOUSE"
            ).length,
          },
          {
            label: "Puntos de venta",
            Icon: Store,
            count: items?.filter(
              (item) => item.locationType === "POINT_OF_SALE"
            ).length,
          },
          {
            label: "Ubicaciones activas",
            Icon: MapPin,
            count: items?.filter((item) => item.isActive).length,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="configuration-card flex items-center gap-3 p-4 md:block"
          >
            <metric.Icon
              aria-hidden="true"
              size={22}
              className="shrink-0 text-accent"
            />

            <div className="min-w-0 md:mt-2">
              <strong className="block text-xl font-bold leading-none">
                {metric.count ?? "—"}
              </strong>

              <p className="mt-1 text-xs leading-snug">
                {metric.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="configuration-filters">
        <SelectField
          label="Tipo de ubicación"
          value={type}
          onValueChange={setType}
          options={[
            { value: "ALL", label: "Todas las ubicaciones" },
            ...locationTypes,
          ]}
        />

        <SelectField
          label="Estado"
          value={activity}
          onValueChange={setActivity}
          options={[
            { value: "ALL", label: "Activas e inactivas" },
            { value: "ACTIVE", label: "Solo activas" },
            { value: "INACTIVE", label: "Solo inactivas" },
          ]}
        />
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      {resource.pending || resource.error ? (
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

          <Button
            variant="secondary"
            onClick={() => {
              setType("ALL");
              setActivity("ALL");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className="configuration-table-wrap">
          <table className="configuration-table">
            <thead>
              <tr>
                {[
                  "Código",
                  "Nombre",
                  "Tipo",
                  "Dirección",
                  "Capacidades",
                  "Estado",
                  "Acciones",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visible.map((location) => (
                <tr
                  key={location.id}
                  className="configuration-location-row"
                  data-inactive={!location.isActive}
                  data-highlight={location.id === savedId}
                >
                  <td data-label="Código">{location.code}</td>

                  <td data-label="Nombre">
                    <strong>{location.name}</strong>
                  </td>

                  <td data-label="Tipo">
                    {
                      locationTypes.find(
                        (item) => item.value === location.locationType
                      )?.label
                    }
                  </td>

                  <td data-label="Dirección">
                    {[location.address, location.municipalityName]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>

                  <td data-label="Capacidades">
                    <LocationCapabilities location={location} />
                  </td>

                  <td data-label="Estado">
                    <span className="configuration-status">
                      {location.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>

                  <td
                    data-label="Acciones"
                    className="configuration-location-actions"
                  >
                    <ActionMenu
                      appearance="compact"
                      label={"Acciones de " + location.name}
                      actions={[
                        {
                          id: "detail",
                          label: "Ver detalle",
                          icon: <Eye size={16} />,
                          onSelect: () =>
                            setAction({
                              kind: "detail",
                              id: location.id,
                            }),
                        },
                        {
                          id: "edit",
                          label: "Editar ubicación",
                          icon: <Pencil size={16} />,
                          onSelect: () =>
                            setAction({
                              kind: "edit",
                              id: location.id,
                            }),
                        },
                        {
                          id: "status",
                          label: location.isActive
                            ? "Desactivar ubicación"
                            : "Reactivar",
                          icon: <Power size={16} />,
                          danger: location.isActive,
                          separatorBefore: true,
                          onSelect: () =>
                            setAction({
                              kind: "status",
                              id: location.id,
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

      {action && (
        <LocationDialog
          key={action.kind + ":" + (action.id ?? "new")}
          action={action}
          onSaved={saved}
          onClose={() => {
            setAction(null);
            resource.refresh();
          }}
        />
      )}
    </section>
  );
}
