import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";

import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";

import {
  hasEveryPermission,
  hasPermission,
  canAccessLocation,
} from "../../auth/utils/permissions";

import { useRemote } from "../../sales/hooks/usePublicOrders";

import { ContextLink } from "../../sales/components/ContextLink";
import { OrderStatusBadge } from "../../sales/components/OrderStatusBadge";
import { PaymentBadge } from "../../sales/components/PreorderList";

import { SERVICE_LABELS } from "../../sales/schemas/sales.schema";
import { saleLabels } from "../../sales/schemas/financial-sales.schema";

import { Pager } from "../../reports/components/ReportUI";

import { amount, dateTime } from "../utils/customers.format";
import { channel } from "../schemas/customers.schema";

import {
  customerKey,
  getCustomerOrders,
  getCustomerSales,
} from "../services/customers.service";

import "../../sales/sales-board.css";
import "../../sales/preorders.css";
import "../../sales/public-orders.css";

export function CustomerHistory({
  id,
  currency,
  timezone,
}: {
  id: string;
  currency: string | null;
  timezone: string | null;
}) {
  const [tab, setTab] = useState<"orders" | "sales">("orders");
  const [pages, setPages] = useState({ orders: 1, sales: 1 });

  return (
    <section
      className="cc-history"
      aria-label="Historial del cliente"
    >
      <div
        className="cc-tabs"
        role="group"
        aria-label="Tipo de historial"
      >
        {(["orders", "sales"] as const).map((value) => (
          <Button
            key={value}
            variant={tab === value ? "secondary" : "soft"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "orders" ? "Pedidos" : "Ventas"}
          </Button>
        ))}
      </div>

      <HistoryRows
        key={tab}
        id={id}
        tab={tab}
        page={pages[tab]}
        currency={currency}
        timezone={timezone}
        onPage={(page) =>
          setPages((previous) => ({
            ...previous,
            [tab]: page,
          }))
        }
      />
    </section>
  );
}

function HistoryRows({
  id,
  tab,
  page,
  currency,
  timezone,
  onPage,
}: {
  id: string;
  tab: "orders" | "sales";
  page: number;
  currency: string | null;
  timezone: string | null;
  onPage: (page: number) => void;
}) {
  const { session } = useAppShell();

  const load = useCallback(
    async (signal: AbortSignal) =>
      tab === "orders"
        ? {
            kind: "orders" as const,
            data: await getCustomerOrders(session, id, page, signal),
          }
        : {
            kind: "sales" as const,
            data: await getCustomerSales(session, id, page, signal),
          },
    [session, id, page, tab]
  );

  const resource = useRemote(load, {
    token: session.accessToken,
    keys: [customerKey(id)],
  });

  const result = resource.data;

  return (
    <div className="cc-stack">
      {resource.loading && (
        <LoadingState message="Consultando historial…" />
      )}

      {resource.error && (
        <Alert>
          {resource.error}
          <Button onClick={resource.reload}>Reintentar</Button>
        </Alert>
      )}

      {result?.kind === "orders" && (
        <>
          {!result.data.orders.length && (
            <p className="cc-empty">
              Este cliente no tiene pedidos registrados.
            </p>
          )}

          {result.data.orders.map((row) => (
            <article className="cc-card" key={row.id}>
              <div className="cc-line">
                <strong>Pedido #{row.id}</strong>
                <OrderStatusBadge status={row.status} />
              </div>

              <p className="cc-muted">
                {dateTime(row.createdAt, timezone)}
                {" · "}
                {row.location.name}
                {" · "}
                {SERVICE_LABELS[row.serviceType]}
                {" · "}
                {channel(row.sourceChannel)}
              </p>

              <div className="cc-line">
                <PaymentBadge status={row.paymentStatus} />
                <strong>
                  Subtotal: {amount(row.subtotal, currency)}
                </strong>
              </div>

              {hasEveryPermission(session, [
                "orders.read",
                "tables.read",
                "catalog.read",
              ]) && canAccessLocation(session, row.locationId) ? (
                <ContextLink
                  to={
                    "/ventas?orderId=" +
                    row.id +
                    "&pos=" +
                    row.locationId
                  }
                >
                  Ver pedido
                </ContextLink>
              ) : (
                <small className="cc-muted">
                  Sin acceso al detalle operativo de este pedido.
                </small>
              )}
            </article>
          ))}
        </>
      )}

      {result?.kind === "sales" && (
        <>
          {!result.data.sales.length && (
            <p className="cc-empty">
              Este cliente no tiene ventas registradas.
            </p>
          )}

          {result.data.sales.map((row) => (
            <article className="cc-card" key={row.id}>
              <div className="cc-line">
                <strong>Venta #{row.id}</strong>

                <span className="por-badge" data-status={row.status}>
                  {saleLabels[row.status]}
                </span>
              </div>

              <p className="cc-muted">
                {dateTime(row.soldAt, timezone)}
                {" · "}
                {row.location.name}
                {" · "}
                {SERVICE_LABELS[row.serviceType]}
                {" · "}
                {channel(row.sourceChannel)}
              </p>

              <dl className="cc-amounts">
                <div>
                  <dt>Total original</dt>
                  <dd>{amount(row.total, row.currencyCode)}</dd>
                </div>

                <div>
                  <dt>Devuelto</dt>
                  <dd>
                    {amount(
                      row.refundedTotalAmount,
                      row.currencyCode
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Compra efectiva</dt>
                  <dd>
                    {amount(
                      row.effectiveTotalAmount,
                      row.currencyCode
                    )}
                  </dd>
                </div>
              </dl>

              {hasPermission(session, "orders.read") &&
              canAccessLocation(session, row.locationId) ? (
                <ContextLink to={"/historial-ventas?venta=" + row.id}>
                  Ver venta
                </ContextLink>
              ) : (
                <small className="cc-muted">
                  Sin acceso al detalle de esta venta.
                </small>
              )}
            </article>
          ))}
        </>
      )}

      {result && (
        <Pager pagination={result.data.pagination} onPage={onPage} />
      )}
    </div>
  );
}
