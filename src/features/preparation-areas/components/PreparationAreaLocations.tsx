import { Factory, Store, TriangleAlert } from "lucide-react";
import {
  areaLocationGroups,
  locationLabel,
} from "../schemas/preparation-area.schema";
import type { AreaLocation } from "../schemas/preparation-area.schema";

export function AreaLocationChips({
  locations,
  compact = false,
}: {
  locations: AreaLocation[];
  compact?: boolean;
}) {
  const visible = compact ? locations.slice(0, 2) : locations;
  const hidden = compact ? locations.slice(2) : [];

  const chip = (location: AreaLocation) => {
    const Icon = !location.isActive
      ? TriangleAlert
      : location.locationType === "POINT_OF_SALE"
        ? Store
        : Factory;

    return (
      <span
        key={location.id}
        className="pa-chip"
        data-inactive={!location.isActive}
        data-plant={location.locationType === "PRODUCTION_WAREHOUSE"}
      >
        <Icon size={12} aria-hidden="true" />

        <span>
          {locationLabel(location.name)} · {location.code}
        </span>

        {!location.isActive && (
          <span className="sr-only"> (inactiva)</span>
        )}
      </span>
    );
  };

  return (
    <div className="pa-chips">
      {locations.length === 0 && (
        <span className="text-muted">Sin ubicaciones</span>
      )}

      {visible.map(chip)}

      {hidden.length > 0 && (
        <details className="pa-more">
          <summary
            aria-label={`Ver ${hidden.length} ubicaciones adicionales`}
          >
            +{hidden.length}
            {hidden.some((location) => !location.isActive) && (
              <TriangleAlert
                size={12}
                aria-label="Incluye ubicaciones inactivas"
              />
            )}
          </summary>

          <div className="pa-chips">{hidden.map(chip)}</div>
        </details>
      )}
    </div>
  );
}

export function AreaLocationPicker({
  locations,
  selected,
  changed,
  error,
  disabled,
  onChange,
}: {
  locations: AreaLocation[];
  selected: string[];
  changed: boolean;
  error?: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset
      className="pa-location-picker"
      disabled={disabled}
      aria-invalid={!!error}
    >
      <legend>Ubicaciones donde funciona *</legend>

      <span className="pa-selected-count" aria-live="polite">
        {selected.length} seleccionadas
      </span>

      {changed &&
        locations.some((location) => !location.isActive) && (
          <div className="pa-warning">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              Modificaste la lista: las asignaciones inactivas se
              retirarán al guardar.
            </span>
          </div>
        )}

      {areaLocationGroups.map((group) => {
        const rows = locations.filter(
          (location) => location.locationType === group.type
        );

        const Icon = group.type === "POINT_OF_SALE" ? Store : Factory;

        if (!rows.length) return null;

        return (
          <div key={group.type} className="pa-location-group">
            <h3>
              <Icon size={14} aria-hidden="true" />
              {group.label}
            </h3>

            {rows.map((location) => (
              <label
                key={location.id}
                className="pa-location-option"
                data-selected={selected.includes(location.id)}
                data-inactive={!location.isActive}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(location.id)}
                  disabled={!location.isActive || disabled}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, location.id]
                        : selected.filter((id) => id !== location.id)
                    )
                  }
                />

                <span>
                  <span className="pa-location-name">
                    <strong>{locationLabel(location.name)}</strong>

                    <span> · {location.code}</span>

                    {!location.isActive && (
                      <span className="pa-chip" data-inactive>
                        <TriangleAlert size={12} aria-hidden="true" />
                        Inactiva
                      </span>
                    )}
                  </span>

                  <small>{group.singular}</small>

                  {!location.isActive && (
                    <small className="pa-inactive-help">
                      Esta ubicación está inactiva. La asignación se
                      retirará si modificas y guardas la lista de
                      ubicaciones.
                    </small>
                  )}
                </span>
              </label>
            ))}
          </div>
        );
      })}

      {!locations.length && (
        <p>No hay ubicaciones activas disponibles.</p>
      )}

      {error && (
        <div className="pa-field-error" role="alert">
          {error}
        </div>
      )}
    </fieldset>
  );
}
