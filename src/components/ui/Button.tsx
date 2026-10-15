import type { ComponentPropsWithoutRef } from "react";
import { LoaderCircle } from "lucide-react";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "soft" | "cancel" | "danger";

  size?: "sm" | "md" | "compact" | "icon";
  loading?: boolean;
  loadingText?: string;
}

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
      data-variant={variant}
      data-size={size}
      className={`ui-button ${className}`.trim()}
    >
      {loading ? (
        <>
          <LoaderCircle
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
            className="motion-safe:animate-spin"
          />

          <span className={size === "icon" ? "sr-only" : undefined}>
            {loadingText}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
