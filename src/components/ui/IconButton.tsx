import type { ComponentPropsWithoutRef } from "react";

type IconButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "aria-label"
> & {
  label: string;
  variant?: "surface" | "sidebar";
};

export function IconButton({
  label,
  type = "button",
  variant = "surface",
  className = "",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      className={[
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border",
        variant === "surface"
          ? "border-outline bg-surface text-heading shadow-sm enabled:hover:bg-secondary"
          : "border-transparent bg-transparent text-slate-300 enabled:hover:bg-white/10",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
