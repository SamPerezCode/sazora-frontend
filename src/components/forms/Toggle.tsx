import { useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface ToggleProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "size" | "children" | "defaultChecked"
> {
  label: ReactNode;
  checked: boolean;
  description?: string;
  error?: string;
}

export function Toggle({
  label,
  checked,
  description,
  error,
  disabled,
  id,
  className = "",
  "aria-describedby": describedBy,
  ...props
}: ToggleProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;

  return (
    <label
      htmlFor={inputId}
      className={[
        "flex min-h-11 w-full items-center justify-between gap-4",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] leading-relaxed text-heading">
          {label}
        </span>

        {description && (
          <span
            id={descriptionId}
            className="mt-1 block text-xs leading-relaxed text-muted"
          >
            {description}
          </span>
        )}

        {error && (
          <span
            id={errorId}
            className="mt-1 block text-xs text-danger dark:text-[#efa38f]"
          >
            {error}
          </span>
        )}
      </span>

      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          {...props}
          id={inputId}
          type="checkbox"
          role="switch"
          checked={checked}
          aria-checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={
            [
              describedBy,
              description ? descriptionId : undefined,
              error ? errorId : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="peer sr-only"
        />

        <span
          aria-hidden="true"
          className={[
            "absolute inset-0 rounded-full border border-outline bg-secondary",
            "transition-colors",
            "peer-checked:border-accent peer-checked:bg-accent",
            "peer-focus-visible:outline-2",
            "peer-focus-visible:outline-offset-4",
            "peer-focus-visible:outline-accent",
            "peer-disabled:opacity-50",
            "motion-reduce:transition-none",
          ].join(" ")}
        />

        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute left-1 top-1",
            "size-4 rounded-full bg-muted",
            "transition-transform duration-200",
            "peer-checked:translate-x-5",
            "peer-checked:bg-on-accent",
            "peer-disabled:opacity-50",
            "motion-reduce:transition-none",
          ].join(" ")}
        />
      </span>
    </label>
  );
}
