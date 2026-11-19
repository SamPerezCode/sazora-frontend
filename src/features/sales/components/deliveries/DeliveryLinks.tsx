import { Link } from "react-router";

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
        <Link
          className="por-link"
          to={"/ventas?orderId=" + row.orderId}
        >
          Abrir pedido
        </Link>
      )}

      {hasPermission(session, "public_orders.read") && (
        <Link
          className="por-link"
          to={
            "/pedidos-publicos?solicitud=" + row.publicOrderRequestId
          }
        >
          Ver solicitud
        </Link>
      )}
    </div>
  );
}
