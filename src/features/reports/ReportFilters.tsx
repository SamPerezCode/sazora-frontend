import { SelectField } from "../../components/forms/SelectField";
import { Button } from "../../components/ui/Button";

import type {
  ReportFilters as Filters,
  ReportTab,
} from "./reports.schema";

import {
  serviceLabels,
  eventLabels,
  modeLabels,
} from "./reports.format";

import type { DateShortcut } from "./reports.format";

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  tab: ReportTab;
  draft: Filters;
  errors: Record<string, string>;

  employees: FilterOption[];
  areas: FilterOption[];

  employeesLoading: boolean;
  areasLoading: boolean;

  onChange: (key: keyof Filters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onShortcut: (value: DateShortcut) => void;
}

export function ReportFilters({
  tab,
  draft,
  errors,
  employees,
  areas,
  employeesLoading,
  areasLoading,
  onChange,
  onApply,
  onClear,
  onShortcut,
}: Props) {
  const select = (
    key: keyof Filters,
    label: string,
    options: FilterOption[],
    disabled = false
  ) => (
    <SelectField
      label={label}
      value={draft[key]}
      options={options}
      error={errors[key]}
      disabled={disabled}
      onValueChange={(value) => onChange(key, value)}
    />
  );

  const choices = (labels: Record<string, string>, all: string) => [
    { value: "", label: all },
    ...Object.entries(labels).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  return (
    <form
      className="rp-card rp-filters"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="rp-filter-grid">
        {(["from", "to"] as const).map((key) => (
          <label key={key} className="rp-field">
            {key === "from" ? "Desde" : "Hasta"}

            <input
              type="date"
              value={draft[key]}
              aria-invalid={!!errors[key]}
              aria-describedby={
                errors[key] ? `rp-${key}-error` : undefined
              }
              onChange={(event) => onChange(key, event.target.value)}
            />

            {errors[key] && (
              <small id={`rp-${key}-error`} role="alert">
                {errors[key]}
              </small>
            )}
          </label>
        ))}

        {tab === "kitchen" &&
          select(
            "preparationAreaId",
            "Área de preparación",
            [{ value: "", label: "Todas las áreas" }, ...areas],
            areasLoading
          )}

        {select(
          "serviceType",
          "Modalidad",
          choices(serviceLabels, "Todas")
        )}

        {tab === "sales" &&
          select(
            "openedByMembershipId",
            "Empleado",
            [
              { value: "", label: "Todos los empleados" },
              ...employees,
            ],
            employeesLoading
          )}

        {tab === "cancellations" && (
          <>
            {select(
              "eventType",
              "Tipo de cancelación",
              choices(eventLabels, "Todas")
            )}

            {select(
              "cancelledByMembershipId",
              "Responsable",
              [
                { value: "", label: "Todos los responsables" },
                ...employees,
              ],
              employeesLoading
            )}
          </>
        )}

        {tab === "kitchen" &&
          select(
            "workflowMode",
            "Modo de cocina",
            choices(modeLabels, "Todos")
          )}
      </div>

      <div className="rp-shortcuts">
        <button type="button" onClick={() => onShortcut("today")}>
          Hoy
        </button>

        <button type="button" onClick={() => onShortcut("week")}>
          Últimos 7 días
        </button>

        <button type="button" onClick={() => onShortcut("month")}>
          Este mes
        </button>

        <button type="button" onClick={() => onShortcut("previous")}>
          Mes anterior
        </button>
      </div>

      <div className="rp-actions">
        <Button
          type="button"
          variant="soft"
          className="rp-clear-button"
          onClick={onClear}
        >
          Limpiar
        </Button>

        <Button type="submit" className="rp-apply-button">
          Aplicar filtros
        </Button>
      </div>
    </form>
  );
}
