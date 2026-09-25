import { useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface TextFieldProps extends ComponentPropsWithoutRef<"input"> {
  label: string;
  error?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  trailing?: ReactNode;
}

export function TextField({
  id,
  label,
  error,
  icon: Icon,
  action,
  trailing,
  className = "",
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const description = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-[var(--field-gap,0.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="text-[length:var(--field-label-size,0.6875rem)] font-semibold uppercase tracking-widest text-muted"
        >
          {label}
        </label>

        {action}
      </div>

      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-[var(--field-icon-left,1rem)] size-[var(--field-icon-size,1rem)] top-1/2 -translate-y-1/2 text-muted"
          />
        )}

        <input
          {...props}
          id={inputId}
          aria-invalid={error ? true : invalid}
          aria-describedby={description || undefined}
          className={[
            "h-[var(--form-control-height,2.75rem)] w-full min-w-0 rounded-2xl border bg-surface/50 text-[length:var(--field-font-size,1rem)] text-heading lg:h-[var(--form-control-height,3.5rem)] lg:text-[length:var(--field-font-size,0.875rem)]",
            "placeholder:text-muted/70",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "dark:bg-secondary/60",
            Icon ? "pl-[var(--field-padding-start,2.75rem)]" : "pl-4",
            trailing ? "pr-12" : "pr-4",
            error
              ? "border-danger"
              : "border-white/80 dark:border-input-border/70",
            className,
          ].join(" ")}
        />

        {trailing && (
          <div className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </div>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          className="text-xs leading-relaxed text-danger dark:text-heading"
        >
          {error}
        </p>
      )}
    </div>
  );
}
