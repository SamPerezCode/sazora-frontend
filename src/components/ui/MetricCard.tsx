import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
          {label}
        </h2>

        <Icon
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
          className="text-accent"
        />
      </div>

      <p className="mt-2 break-words text-2xl font-bold tabular-nums text-heading">
        {value}
      </p>

      <p className="mt-1 text-xs leading-relaxed text-muted">
        {description}
      </p>
    </Card>
  );
}
