import { useId } from "react";
import type { ComponentPropsWithoutRef } from "react";

interface TextAreaFieldProps extends ComponentPropsWithoutRef<"textarea"> {
  label: string;
  error?: string;
}

export function TextAreaField({
  label,
  error,
  id,
  className = "",
  "aria-describedby": describedBy,
  ...props
}: TextAreaFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-xs font-semibold uppercase text-muted"
      >
        {label}
      </label>

      <textarea
        {...props}
        id={inputId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={
          [describedBy, error ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={[
          "min-h-28 w-full rounded-2xl border bg-transparent p-3",
          "text-[length:var(--textarea-font-size,1rem)] text-heading sm:text-[length:var(--textarea-font-size,0.875rem)]",
          "focus:outline-2 focus:outline-accent disabled:opacity-60",
          error ? "border-danger" : "border-outline",
          className,
        ].join(" ")}
      />

      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
