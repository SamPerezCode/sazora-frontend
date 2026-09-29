import type { ComponentPropsWithoutRef } from "react";

export function Card({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      {...props}
      className={`min-w-0 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6 ${className}`}
    />
  );
}
