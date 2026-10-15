import { Ban, ChefHat, CircleCheck, Clock } from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { Order } from "../schemas/sales.schema";

import { STATUS_LABELS } from "../schemas/sales.schema";

type BadgeStatus = Order["status"] | "FREE";

const STATUS_ICONS: Record<BadgeStatus, LucideIcon> = {
  FREE: CircleCheck,
  OPEN: Clock,
  CONFIRMED: ChefHat,
  DELIVERED: CircleCheck,
  CLOSED: Clock,
  CANCELLED: Ban,
};

export function OrderStatusBadge({
  status,
}: {
  status: BadgeStatus;
}) {
  const Icon = STATUS_ICONS[status];

  return (
    <span className="sales-board-status" data-status={status}>
      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
      {status === "FREE" ? "Libre" : STATUS_LABELS[status]}
    </span>
  );
}
