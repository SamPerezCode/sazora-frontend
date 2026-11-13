import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { SelectField } from "../../../components/forms/SelectField";
import { Toggle } from "../../../components/forms/Toggle";
import { calendarToday } from "../../../components/forms/calendar-date";
import { Button } from "../../../components/ui/Button";
import { useAdminResource } from "../../../hooks/useAdminResource";
import { hasPermission } from "../../auth/utils/permissions";
import { getTaxWorkspace } from "../../taxes/services/tax-class.service";
import {
  currentTaxRate,
  taxPercentage,
} from "../../taxes/schemas/tax-class.schema";

interface Props {
  value: string;
  priceIncludesTax: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  priceError?: string;
  onTaxChange?: (value: string) => void;
  onIncludesTaxChange?: (value: boolean) => void;
}

export function ProductTaxFields({
  value,
  priceIncludesTax,
  disabled = false,
  readOnly = false,
  error,
  priceError,
  onTaxChange,
  onIncludesTaxChange,
}: Props) {
  const { session } = useAppShell();
  const canRead = hasPermission(session, "taxes.read");
  const resource = useAdminResource(
    getTaxWorkspace,
    "product-tax-options",
    "taxes.read",
    true
  );
  const classes = resource.data?.taxClasses ?? [];
  const selected = classes.find((item) => item.id === value);
  const rate =
    selected && resource.data
      ? currentTaxRate(
          selected,
          calendarToday(resource.data.timezone)
        )
      : undefined;

  const options = [
    { value: "", label: "Sin impuesto" },
    ...classes
      .filter((item) => item.isActive || item.id === value)
      .map((item) => ({
        value: item.id,
        label: item.name + (item.isActive ? "" : " · Inactivo"),
        disabled: !item.isActive,
      })),
  ];

  if (value && !selected) {
    options.push({
      value,
      label: "Impuesto asignado · " + value,
      disabled: true,
    });
  }

  return (
    <section className="product-form-section">
      <h3>Impuestos</h3>

      {readOnly ? (
        <dl className="product-tax-summary">
          <div>
            <dt>Clase de impuesto</dt>
            <dd>
              {value
                ? (selected?.name ?? "Impuesto asignado · " + value)
                : "Sin impuesto"}
            </dd>
          </div>
          <div>
            <dt>El precio incluye impuesto</dt>
            <dd>{priceIncludesTax ? "Sí" : "No"}</dd>
          </div>
        </dl>
      ) : (
        <>
          <SelectField
            label="Clase de impuesto"
            value={value}
            options={options}
            placeholder="Selecciona una clase de impuesto"
            disabled={
              disabled ||
              !canRead ||
              resource.pending ||
              !!resource.error
            }
            error={error}
            onValueChange={(next) => onTaxChange?.(next)}
          />
          <Toggle
            label="El precio incluye impuesto"
            checked={priceIncludesTax}
            disabled={disabled}
            error={priceError}
            onChange={(event) =>
              onIncludesTaxChange?.(event.currentTarget.checked)
            }
          />
        </>
      )}

      {!canRead ? (
        <p className="product-modal-help">
          No tienes permiso para consultar las clases de impuesto. Se
          conserva la asignación actual.
        </p>
      ) : resource.error ? (
        <Alert>
          <p>{resource.error}</p>
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled || resource.pending}
            onClick={resource.refresh}
          >
            Reintentar impuestos
          </Button>
        </Alert>
      ) : resource.pending ? (
        <p role="status" className="product-modal-help">
          Consultando impuestos…
        </p>
      ) : selected ? (
        <p className="product-modal-help">
          {!selected.isActive
            ? "La clase asignada está inactiva."
            : rate
              ? "Tarifa vigente: " + taxPercentage(rate.rate)
              : "Esta clase no tiene una tarifa vigente."}
        </p>
      ) : null}
    </section>
  );
}
