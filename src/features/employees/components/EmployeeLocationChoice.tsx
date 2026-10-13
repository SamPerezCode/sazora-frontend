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
        "grid min-w-0 grid-cols-1 gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] " +
        (isDefault
          ? "border-accent/50 bg-accent/10"
          : "border-outline") +
        (location.isActive ? "" : " opacity-60")
      }
    >
      <Checkbox
        name={groupId + "-locations"}
        value={location.id}
        checked={checked}
        disabled={locked || !location.isActive}
        className="w-full min-w-0 [--checkbox-size:1.125rem] sm:col-start-1 sm:row-start-1"
        label={
          <span className="block min-w-0">
            <span className="block break-words text-sm font-semibold leading-snug text-heading">
              {location.name}
            </span>

            <span className="mt-1 block break-words text-xs font-normal text-muted">
              {location.code}
            </span>
          </span>
        }
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />

      <div className="min-w-0 space-y-2 pl-8 sm:col-start-1 sm:row-start-2">
        {recommendation && (
          <p className="text-xs font-semibold text-accent">
            {recommendation}
          </p>
        )}

        <span className="inline-flex max-w-full items-center gap-1 rounded-2xl bg-secondary px-2 py-1 text-[0.6875rem] font-semibold leading-snug text-heading">
          <Icon aria-hidden="true" size={12} className="shrink-0" />

          {employeeLocationTypeLabels[location.locationType]}
        </span>

        {location.address && (
          <p className="break-words text-xs leading-relaxed text-muted">
            {location.address}
          </p>
        )}

        {!location.isActive && (
          <p className="text-xs font-semibold leading-relaxed text-muted">
            {formerlyAssigned
              ? "Esta ubicación está inactiva. La asignación será retirada al guardar."
              : "Esta ubicación está inactiva."}
          </p>
        )}
      </div>

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
            "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 sm:col-start-2 sm:row-start-1 sm:row-span-2 sm:min-h-9 sm:w-auto sm:self-start " +
            (isDefault
              ? "border-accent bg-accent text-on-accent"
              : "border-outline text-muted enabled:hover:border-accent enabled:hover:text-heading")
          }
        >
          <Star
            aria-hidden="true"
            size={14}
            className="shrink-0"
            fill={isDefault ? "currentColor" : "none"}
          />

          <span>
            {isDefault
              ? "Predeterminada"
              : "Usar como predeterminada"}
          </span>
        </button>
      )}
    </div>
  );
}
