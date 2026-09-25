import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Check } from "lucide-react";

interface CheckboxProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "type"
> {
  label: ReactNode;
}

export function Checkbox({
  label,
  className = "",
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={[
        "inline-flex min-h-[var(--checkbox-min-height,2rem)] items-center gap-[var(--checkbox-gap,0.75rem)] text-[length:var(--checkbox-font-size,0.75rem)] text-muted",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <span className="relative inline-flex size-[var(--checkbox-size,1.25rem)] shrink-0">
        {" "}
        <input
          {...props}
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-input-border bg-surface peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent"
        />
        <Check
          aria-hidden="true"
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute inset-0 m-auto text-on-accent opacity-0 peer-checked:opacity-100"
        />
      </span>

      {label}
    </label>
  );
}
