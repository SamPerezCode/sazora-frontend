import type { ComponentPropsWithoutRef } from "react";
import { CircleAlert } from "lucide-react";

export function Alert({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border border-danger/35 bg-danger/10 p-4 text-sm leading-relaxed text-heading ${className}`}
    >
      <CircleAlert
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0"
      />
      <div>{children}</div>
    </div>
  );
}
