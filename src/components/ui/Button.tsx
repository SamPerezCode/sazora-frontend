import type { ComponentPropsWithoutRef } from "react";
import { LoaderCircle } from "lucide-react";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  loading?: boolean;
  loadingText?: string;
}

const variants = {
  primary:
    "bg-accent text-on-accent shadow-[0_12px_24px_-10px] shadow-accent/30 enabled:hover:brightness-95",
  secondary:
    "border border-outline bg-surface text-heading enabled:hover:bg-secondary",
};

const sizes = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-[var(--form-control-height,2.75rem)] px-5 text-[length:var(--button-font-size,0.875rem)] lg:min-h-[var(--form-control-height,3.5rem)]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText = "Procesando…",
  disabled,
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--button-radius,1rem)] font-semibold",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
    >
      {loading ? (
        <>
          <LoaderCircle
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
            className="motion-safe:animate-spin"
          />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
