import { Factory, Star, Store } from "lucide-react";
import { Checkbox } from "../../../components/forms/Checkbox";
import type { BusinessLocation } from "../../business/schemas/organization.schema";
import { employeeLocationTypeLabels } from "../schemas/employee-location.schema";

interface Props {
  location: BusinessLocation;
  groupId: string;
  checked: boolean;
  isDefault: boolean;
  locked: boolean;
  formerlyAssigned: boolean;
  recommendation?: string;
  onToggle: (checked: boolean) => void;
  onDefault: () => void;
}

export function EmployeeLocationChoice({
  location,
  groupId,
  checked,
  isDefault,
  locked,
  formerlyAssigned,
  recommendation,
  onToggle,
  onDefault,
}: Props) {
  const Icon =
    location.locationType === "POINT_OF_SALE" ? Store : Factory;

  return (
    <div
      className={
        "rounded-2xl border p-3 " +
        (isDefault
          ? "border-accent/50 bg-accent/10"
          : "border-outline") +
        (location.isActive ? "" : " opacity-60")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Checkbox
          name={groupId + "-locations"}
          value={location.id}
          checked={checked}
          disabled={locked || !location.isActive}
          className="min-w-0 flex-1 [--checkbox-size:1.125rem]"
          label={
            <span className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
              {location.name}{" "}
              <span className="text-xs font-normal text-muted">
                {location.code}
              </span>
            </span>
          }
          onChange={(event) => onToggle(event.currentTarget.checked)}
        />

        {location.isActive && (
          <button
            type="button"
            disabled={locked || !checked}
            aria-pressed={isDefault}
            aria-label={
              (isDefault
                ? "Ubicación predeterminada: "
                : "Usar como predeterminada: ") + location.name
            }
            onClick={onDefault}
            className={
              "ml-7 inline-flex min-h-9 items-center justify-center gap-1 rounded-2xl border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 sm:ml-0 " +
              (isDefault
                ? "border-accent bg-accent text-on-accent"
                : "border-outline text-muted enabled:hover:border-accent enabled:hover:text-heading")
            }
          >
            <Star
              aria-hidden="true"
              size={14}
              fill={isDefault ? "currentColor" : "none"}
            />

            {isDefault
              ? "Predeterminada"
              : "Usar como predeterminada"}
          </button>
        )}
      </div>

      <div className="ml-7 mt-1 space-y-1">
        {recommendation && (
          <p className="text-xs font-semibold text-accent">{recommendation}</p>
        )}
        <span className="inline-flex items-center gap-1 rounded-2xl bg-secondary px-2 py-1 text-[0.6875rem] font-semibold leading-none text-heading">
          <Icon aria-hidden="true" size={12} />
          {employeeLocationTypeLabels[location.locationType]}
        </span>

        {location.address && (
          <p className="text-xs text-muted">{location.address}</p>
        )}

        {!location.isActive && (
          <p className="text-xs font-semibold text-muted">
            {formerlyAssigned
              ? "Esta ubicación está inactiva. La asignación será retirada al guardar."
              : "Esta ubicación está inactiva."}
          </p>
        )}
      </div>
    </div>
  );
}
