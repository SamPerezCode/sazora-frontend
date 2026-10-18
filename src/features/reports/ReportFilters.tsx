import { SelectField } from "../../components/forms/SelectField";
import { Button } from "../../components/ui/Button";
import { DateField } from "../../components/forms/DateField";

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
  timeZone: string;

  onChange: (key: keyof Filters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onShortcut: (value: DateShortcut) => void;
}

export function ReportFilters({
  tab,
  timeZone,
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
        <DateField
          className="rp-field"
          label="Desde"
          value={draft.from}
          max={draft.to || undefined}
          timeZone={timeZone}
          error={errors.from}
          clearable={false}
          onValueChange={(value) => onChange("from", value)}
        />

        <DateField
          className="rp-field"
          label="Hasta"
          value={draft.to}
          min={draft.from || undefined}
          timeZone={timeZone}
          error={errors.to}
          clearable={false}
          onValueChange={(value) => onChange("to", value)}
        />

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
