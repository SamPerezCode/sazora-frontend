import { useId, useState } from "react";
import { Check, ReceiptText } from "lucide-react";

import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";

import { OrderStatusBadge } from "./OrderStatusBadge";
import type { Order } from "../schemas/sales.schema";
import { cents, money } from "../schemas/sales.schema";
import type { SalesResource } from "../hooks/useSales";
import type { SalesTable } from "../services/sales.service";
import { OrderPrintPanel } from "../../kitchen-flow/OrderPrintPanel";

interface Props {
  order: Order;
  table?: SalesTable;
  resource?: SalesResource;
}

export function OrderSummaryView({ order, table, resource }: Props) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);

  const active = order.items.filter(
    (item) => item.status === "ACTIVE"
  );

  const cancelled = order.items.filter(
    (item) => item.status === "CANCELLED"
  );

  const pending = Object.values(resource?.drafts[order.id] ?? {});

  const blocked =
    !!resource &&
    (resource.busy ||
      resource.uncertain ||
      !!resource.error ||
      resource.accessLost);

  const service =
    order.serviceType === "TABLE"
      ? `${table?.name ?? "Mesa"}${
          table?.code ? ` · ${table.code}` : ""
        }`
      : "Pedido para recoger";

  const closingText =
    order.serviceType === "TAKEAWAY"
      ? "El pedido se cerrará y saldrá del listado de pedidos activos. Su historial se conservará."
      : table?.continuityOnly || table?.isActive === false
        ? "La cuenta se cerrará. La mesa seguirá fuera del listado de mesas disponibles para nuevas órdenes. Su historial se conservará."
        : "La cuenta se cerrará y la mesa quedará libre. Su historial se conservará.";

  return (
    <>
      {resource?.error && (
        <div className="mp-dialog-content">
          <Alert>{resource.error}</Alert>

          <Button
            variant="secondary"
            disabled={resource.busy}
            onClick={resource.retry}
          >
            Actualizar cuenta
          </Button>
        </div>
      )}

      {resource?.notice && !confirming && (
        <p className="mp-notice" role="status">
          {resource.notice}
        </p>
      )}

      {resource?.uncertain && !confirming && (
        <div className="mp-dialog-content" role="alert">
          <p>
            Hay una operación pendiente de verificar. Revisa la cuenta
            antes de continuar.
          </p>

          <Button
            variant="secondary"
            disabled={resource.busy}
            onClick={() => void resource.reconcile()}
          >
            Actualizar y verificar
          </Button>

          {resource.uncertainAdditions && (
            <div className="sales-form-actions">
              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={() => void resource.reconcile("applied")}
              >
                Ya aparecen las adiciones
              </Button>

              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={() => void resource.reconcile("not-applied")}
              >
                Las adiciones no se guardaron
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mp-summary-layout">
        <section className="mp-summary-detail">
          <h3>Resumen de la cuenta</h3>

          <dl className="mp-summary-meta">
            <div>
              <dt>Orden</dt>
              <dd>#{order.id}</dd>
            </div>

            <div>
              <dt>Servicio</dt>
              <dd>{service}</dd>
            </div>

            <div>
              <dt>Punto de venta</dt>
              <dd>
                {order.location.name} · {order.location.code}
              </dd>
            </div>
          </dl>

          <div className="mp-table-scroll">
            <table className="mp-summary-table">
              <caption className="sr-only">
                Productos de la cuenta {order.id}
              </caption>

              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Cant.</th>
                  <th scope="col">Precio unit.</th>
                  <th scope="col">Importe</th>
                </tr>
              </thead>

              <tbody>
                {active.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      {item.productName}
                      {item.notes && <small>{item.notes}</small>}
                    </th>

                    <td>{item.quantity}</td>
                    <td>{money(cents(item.unitPrice))}</td>
                    <td>{money(cents(item.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    Subtotal
                  </th>
                  <td>{money(cents(order.subtotal))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {cancelled.length > 0 && (
            <details className="sales-cancelled">
              <summary>Productos cancelados</summary>
              <p>No se incluyen en el subtotal.</p>

              {cancelled.map((item) => (
                <p key={item.id}>
                  {item.quantity} × {item.productName} ·{" "}
                  {item.cancellationReason || "Sin motivo registrado"}
                </p>
              ))}
            </details>
          )}

          {pending.length > 0 && (
            <div className="mp-warning" role="alert">
              <p>
                Hay adiciones locales sin enviar. Revísalas y
                descártalas antes de cerrar.
              </p>

              <ul>
                {pending.map((item, index) => (
                  <li key={index}>
                    {item.quantity} × {item.name}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </li>
                ))}
              </ul>

              <Button
                variant="secondary"
                disabled={blocked}
                onClick={() => resource?.discardAdditions(order.id)}
              >
                Descartar adiciones sin enviar
              </Button>
            </div>
          )}
        </section>

        <aside className="mp-summary-totals">
          <small>Subtotal de productos</small>
          <strong>{money(cents(order.subtotal))}</strong>
          <p>Suma de los productos consumidos.</p>

          <div className="mp-badges">
            <OrderStatusBadge status={order.status} />
            <span className="mp-neutral">
              Sin información de pago
            </span>
          </div>

          <p>El cierre de la cuenta no registra un pago.</p>
          {resource && (
            <OrderPrintPanel
              orderId={order.id}
              printing={resource.printing}
              disabled={blocked}
            />
          )}
        </aside>
      </div>

      <footer className="mp-summary-footer">
        <div>
          <small>
            Subtotal ·{" "}
            {active.reduce((sum, item) => sum + item.quantity, 0)}{" "}
            unidades
          </small>

          <strong>{money(cents(order.subtotal))}</strong>
        </div>

        {resource && order.status === "DELIVERED" && (
          <Button
            disabled={blocked || pending.length > 0}
            onClick={() => setConfirming(true)}
          >
            <Check size={16} />
            Cerrar cuenta
          </Button>
        )}
      </footer>

      {confirming && resource && (
        <BottomSheet
          id={id}
          open
          variant="modal"
          title={`¿Cerrar la cuenta #${order.id}?`}
          className="mp-dialog"
          busy={resource.busy}
          onClose={() => setConfirming(false)}
        >
          <div className="mp-dialog-content">
            <p>{closingText}</p>

            <div className="mp-summary-meta">
              <ReceiptText size={20} />
              <strong>
                {service} · {money(cents(order.subtotal))}
              </strong>
            </div>

            <p>Esta acción no registra un pago.</p>

            {resource.notice && (
              <p role="status">{resource.notice}</p>
            )}

            {resource.uncertain && (
              <div role="alert">
                <p>
                  El resultado debe verificarse antes de volver a
                  cerrar.
                </p>

                <Button
                  variant="secondary"
                  disabled={resource.busy}
                  onClick={() => void resource.reconcile()}
                >
                  Verificar operación
                </Button>
              </div>
            )}

            <div className="sales-form-actions">
              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={() => setConfirming(false)}
              >
                Volver
              </Button>

              <Button
                loading={resource.busy}
                loadingText="Cerrando…"
                disabled={blocked || pending.length > 0}
                onClick={async () => {
                  const ok = await resource.action(
                    `/orders/${order.id}/close`,
                    "POST"
                  );

                  if (ok) setConfirming(false);
                }}
              >
                Cerrar cuenta
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
