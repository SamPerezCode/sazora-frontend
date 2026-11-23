import { useCallback } from "react";

import { useRouteState } from "../../../hooks/useRouteState";
import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";

import { cashDate } from "../../cash/utils/cash-format";

import { useRemote } from "../hooks/usePublicOrders";

import { operationKeys } from "../../../lib/operations-sync";

import {
  cents,
  money,
  type Order,
  type OrderSummary,
} from "../schemas/sales.schema";

import type { SalesScope } from "../services/sales.service";

import {
  getQuickSales,
  isQuickSale,
  quickSaleLabel,
} from "../services/quick-sale.service";

import {
  CHANNELS,
  PAYMENT_LABELS,
  PREORDER_FILTERS,
  preorderRows,
  type PreorderFilter,
} from "../utils/preorders";

export function PaymentBadge({
  status,
}: {
  status: Order["paymentStatus"];
}) {
  return (
    <span
      className="preorder-payment"
      data-status={status ?? "UNKNOWN"}
    >
      {status ? PAYMENT_LABELS[status] : "Pago por consultar"}
    </span>
  );
}

export function PreorderList({
  orders,
  disabled,
  onOpen,
  scope,
}: {
  orders: OrderSummary[];
  disabled: boolean;
  onOpen: (id: string) => void;
  scope: SalesScope;
}) {
  const { session, settings } = useAppShell();

  const [filter, setFilter] = useRouteState<PreorderFilter>(
    "preorderFilter",
    "ALL"
  );

  const [source, setSource] = useRouteState<"ALL" | "QUICK">(
    "preorderSource",
    "ALL"
  );

  const [storedPage, setPage] = useRouteState<number>("quickPage", 1);

  const page =
    Number.isSafeInteger(storedPage) && storedPage > 0
      ? storedPage
      : 1;

  const quick = source === "QUICK";

  const load = useCallback(
    (signal: AbortSignal) =>
      quick
        ? getQuickSales(session.accessToken, scope, page, signal)
        : Promise.resolve(null),
    [quick, session.accessToken, scope, page]
  );

  const remote = useRemote(load, {
    token: session.accessToken,
    keys: quick ? [operationKeys.orders] : [],
    paused: disabled,
    pollMs: quick ? 15000 : 0,
  });

  const rows = quick
    ? (remote.data?.orders ?? [])
    : preorderRows(orders, filter);

  const count = quick
    ? (remote.data?.pagination.total ?? 0)
    : preorderRows(orders, "ALL").length;

  const zone = settings.data?.timezone ?? "America/Bogota";

  return (
    <section className="preorders" aria-label="Pedidos y caja rápida">
      <div className="mp-section-heading">
        <div>
          <h3>
            Pedidos para recoger, caja rápida y domicilio{" "}
            <span className="mp-neutral">{count}</span>
          </h3>

          <p>
            Se pagan antes de entregarse o enviarse a preparación.
          </p>

          <small>
            {quick
              ? "Caja rápida incluye órdenes activas, cerradas y canceladas del punto de venta."
              : "Los filtros de estado incluyen las órdenes activas del punto de venta."}
          </small>
        </div>
      </div>

      <div
        className="preorder-filters"
        role="group"
        aria-label="Filtrar pedidos"
      >
        {PREORDER_FILTERS.map(([value, label]) => (
          <Button
            key={value}
            size="compact"
            variant={!quick && filter === value ? "primary" : "soft"}
            aria-pressed={!quick && filter === value}
            onClick={() => {
              setSource("ALL");
              setFilter(value);
            }}
          >
            {label}
          </Button>
        ))}

        <Button
          size="compact"
          variant={quick ? "primary" : "soft"}
          aria-pressed={quick}
          onClick={() => {
            setSource("QUICK");
            setPage(1);
          }}
        >
          Caja rápida
        </Button>
      </div>

      {quick && remote.error && (
        <div role="alert">
          <p>{remote.error}</p>

          <Button onClick={remote.reload} disabled={disabled}>
            Reintentar
          </Button>
        </div>
      )}

      {quick && remote.loading ? (
        <p role="status">Consultando caja rápida…</p>
      ) : rows.length ? (
        <div
          className="preorder-track"
          role="region"
          aria-label="Pedidos del más reciente al más antiguo"
          tabIndex={0}
        >
          {rows.map((order) => (
            <article key={order.id} className="preorder-card">
              <div className="mp-card-line">
                <strong>Pedido #{order.id}</strong>

                <strong>
                  {order.total
                    ? money(cents(order.total))
                    : "Total por consultar"}
                </strong>
              </div>

              <small>
                {isQuickSale(order)
                  ? "Caja rápida"
                  : order.serviceType === "DELIVERY"
                    ? "A domicilio"
                    : "Para recoger"}
              </small>

              <div className="mp-badges">
                <PaymentBadge status={order.paymentStatus} />

                <span className="mp-neutral">
                  {quickSaleLabel(order)}
                </span>
              </div>

              {isQuickSale(order) && (
                <small>
                  {order.fulfillmentSummary
                    ? order.fulfillmentSummary.requiresPreparation
                      ? "Requiere preparación"
                      : "Entrega inmediata"
                    : "Preparación por consultar"}
                </small>
              )}

              <small>{cashDate(order.createdAt, zone)}</small>

              <p>
                {order.customerName?.trim() || "Cliente ocasional"}
              </p>

              <small>
                {order.sourceChannel
                  ? CHANNELS[order.sourceChannel]
                  : "Origen no informado"}
              </small>

              <Button
                variant="soft"
                size="compact"
                disabled={disabled}
                onClick={() => onOpen(order.id)}
              >
                {order.status === "OPEN" ? "Continuar" : "Ver orden"}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        !remote.error && (
          <div className="mp-empty">
            No hay pedidos con este filtro.
          </div>
        )
      )}

      {quick && (
        <div className="sales-form-actions">
          <Button
            variant="soft"
            disabled={disabled || remote.loading || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>

          <span>
            Página {page} de{" "}
            {Math.max(1, remote.data?.pagination.totalPages ?? 1)}
          </span>

          <Button
            variant="soft"
            disabled={
              disabled ||
              remote.loading ||
              page >= (remote.data?.pagination.totalPages ?? 1)
            }
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </section>
  );
}
