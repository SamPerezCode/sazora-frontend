import { STATUS_LABELS } from "../schemas/sales.schema";

import type { Order } from "../schemas/sales.schema";

export function OrderStatusBadge({
  status,
}: {
  status: Order["status"] | "FREE";
}) {
  return (
    <span className="sales-board-status" data-status={status}>
      {status === "FREE" ? "Libre" : STATUS_LABELS[status]}
    </span>
  );
}
