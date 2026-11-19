import { ContextLink } from "../ContextLink";

import { useAppShell } from "../../../../app/layout/shell-context";

import {
  hasEveryPermission,
  hasPermission,
} from "../../../auth/utils/permissions";

import type { Delivery } from "../../schemas/public-orders.schema";

export function DeliveryLinks({ row }: { row: Delivery }) {
  const { session } = useAppShell();

  return (
    <div className="por-actions">
      {hasEveryPermission(session, [
        "orders.read",
        "tables.read",
        "catalog.read",
      ]) && (
        <ContextLink
          to={
            "/ventas?orderId=" +
            row.orderId +
            "&requestId=" +
            row.publicOrderRequestId
          }
        >
          Abrir pedido
        </ContextLink>
      )}

      {hasPermission(session, "public_orders.read") && (
        <ContextLink
          to={
            "/pedidos-publicos?solicitud=" + row.publicOrderRequestId
          }
        >
          Ver solicitud
        </ContextLink>
      )}
    </div>
  );
}
