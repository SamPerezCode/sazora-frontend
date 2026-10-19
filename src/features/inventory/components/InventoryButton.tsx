import type { ComponentPropsWithoutRef } from "react";
import { LoaderCircle } from "lucide-react";

type Props = ComponentPropsWithoutRef<"button"> & {
  variant?:
    | "primary"
    | "secondary"
    | "soft"
    | "ghost"
    | "cancel"
    | "danger";
  size?: "md" | "sm" | "compact" | "icon";
  loading?: boolean;
  loadingText?: string;
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
}: Props) {
  const tones = {
    primary:
      "border-transparent bg-accent text-on-accent hover:brightness-95",
    secondary:
      "border-outline bg-surface text-heading hover:bg-secondary",
    soft: "border-transparent bg-secondary text-heading hover:brightness-95",
    ghost:
      "border-transparent bg-transparent text-muted hover:bg-secondary/50 hover:text-heading",
    cancel:
      "border-outline bg-surface text-heading hover:bg-secondary",
    danger:
      "border-red-500/40 bg-transparent text-red-600 hover:bg-red-500/10 dark:text-red-400",
  };

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex max-w-full shrink-0 items-center justify-center gap-2",
        "rounded-xl border font-medium leading-none whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [&>svg]:shrink-0",
        size === "icon"
          ? "h-10 w-10 min-w-10 flex-none p-0"
          : size === "compact"
            ? "h-9 w-fit px-3 text-[14px]"
            : "h-10 w-fit px-4 text-[16px]",
        tones[variant],
        className,
      ].join(" ")}
    >
      {loading ? (
        <>
          <LoaderCircle
            size={17}
            aria-hidden
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
