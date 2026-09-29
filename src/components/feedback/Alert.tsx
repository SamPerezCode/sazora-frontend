import type { ComponentPropsWithoutRef } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

interface AlertProps extends ComponentPropsWithoutRef<"div"> {
  variant?: "error" | "success";
}

const variants = {
  error: "border-danger/35 bg-danger/10 text-heading",
  success:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200",
};

export function Alert({
  children,
  variant = "error",
  className = "",
  ...props
}: AlertProps) {
  const Icon = variant === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      {...props}
      role={variant === "success" ? "status" : "alert"}
      aria-atomic="true"
      className={[
        "flex items-start gap-3 rounded-2xl border p-4",
        "text-sm leading-relaxed",
        variants[variant],
        className,
      ].join(" ")}
    >
      <Icon
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className={[
          "mt-0.5 shrink-0",
          variant === "error"
            ? "text-danger dark:text-[#efa38f]"
            : "",
        ].join(" ")}
      />

      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}
