import { SelectField } from "../forms/SelectField";
import { Button } from "./Button";

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface ResponsiveFilterProps<T extends string> {
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function ResponsiveFilter<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: ResponsiveFilterProps<T>) {
  return (
    <div className="responsive-filter">
      <div
        className="responsive-filter-tabs"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            size="compact"
            variant={option.value === value ? "primary" : "soft"}
            aria-pressed={option.value === value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="responsive-filter-select">
        <SelectField
          label={label}
          value={value}
          options={options}
          disabled={disabled}
          onValueChange={(nextValue) => {
            const option = options.find(
              (entry) => entry.value === nextValue
            );

            if (option) {
              onChange(option.value);
            }
          }}
        />
      </div>
    </div>
  );
}
