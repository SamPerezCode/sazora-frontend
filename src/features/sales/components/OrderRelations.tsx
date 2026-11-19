import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { knownRequest } from "../../../lib/operations-sync";

import { hasPermission } from "../../auth/utils/permissions";

import { useRemote } from "../hooks/usePublicOrders";

import { listDeliveries } from "../services/deliveries.service";
import { readRequest } from "../services/public-orders.service";

import type { Order } from "../schemas/sales.schema";

import { ContextLink } from "./ContextLink";

export function RelatedDeliveryLink({
  orderId,
  requestId,
}: {
  orderId: string;
  requestId?: string;
}) {
  const { session } = useAppShell();

  const token = session.accessToken;

  const allowed = hasPermission(session, "deliveries.read");

  const loader = useCallback(
    async (signal: AbortSignal) => {
      if (!allowed) return null;

      const rows = await listDeliveries(token, signal);

      const matches = rows.filter(
        (row) =>
          row.orderId === orderId &&
          (!requestId || row.publicOrderRequestId === requestId)
      );

      return matches.length === 1 ? matches[0] : null;
    },
    [allowed, token, orderId, requestId]
  );

  const resource = useRemote(loader, {
    token,
    keys: ["deliveries"],
  });

  if (!allowed) return null;

  if (resource.loading) {
    return <small role="status">Consultando domicilio…</small>;
  }

  if (resource.error) {
    return <small role="status">{resource.error}</small>;
  }

  if (!resource.data) {
    return <small>No hay un domicilio vinculado disponible.</small>;
  }

  return (
    <ContextLink to={"/domicilios?deliveryId=" + resource.data.id}>
      Ver domicilio
    </ContextLink>
  );
}

export function OrderRelations({ order }: { order: Order }) {
  const { session } = useAppShell();
  const [params] = useSearchParams();

  const token = session.accessToken;

  const allowed =
    order.sourceChannel === "PUBLIC_MENU" &&
    hasPermission(session, "public_orders.read");

  const candidate =
    params.get("requestId") ?? knownRequest(token, order.id);

  const loader = useCallback(
    async (signal: AbortSignal) => {
      if (!allowed || !candidate || !/^[1-9]\d*$/.test(candidate)) {
        return null;
      }

      const result = await readRequest(
        candidate,
        token,
        signal,
        false
      );

      return result.request.orderId === order.id
        ? result.request.id
        : null;
    },
    [allowed, candidate, token, order.id]
  );

  const resource = useRemote(loader, {
    token,
    keys: [
      "orders:" + order.id,
      ...(candidate ? ["requests:" + candidate] : []),
    ],
  });

  return (
    <>
      {allowed && resource.loading && (
        <small>Consultando solicitud…</small>
      )}

      {allowed && resource.data && (
        <ContextLink
          to={"/pedidos-publicos?solicitud=" + resource.data}
        >
          Ver solicitud
        </ContextLink>
      )}

      {allowed && resource.error && (
        <small role="status">{resource.error}</small>
      )}

      {order.serviceType === "DELIVERY" && (
        <RelatedDeliveryLink orderId={order.id} />
      )}
    </>
  );
}
