import type { ComponentPropsWithoutRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../app/providers/theme-context";

type ThemeToggleButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "onClick"
>;

export function ThemeToggleButton({
  className = "",
  ...props
}: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";
  const label = isDark ? "Activar modo claro" : "Activar modo oscuro";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "group inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-[var(--theme-toggle-size,2.5rem)] items-center justify-center rounded-full border border-outline bg-surface text-heading shadow-sm group-hover:bg-secondary dark:border-outline/60 dark:bg-surface/60 dark:shadow-none"
      >
        <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
      </span>
    </button>
  );
}
