import { CircleDollarSign } from "lucide-react";
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
  onCheckout?: () => void;
}

export function OrderSummaryView({
  order,
  table,
  resource,
  onCheckout,
}: Props) {
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
      resource.loading ||
      resource.uncertain ||
      !!resource.error ||
      resource.accessLost);

  const service =
    order.serviceType === "TABLE"
      ? `${table?.name ?? "Mesa"}${table?.code ? ` · ${table.code}` : ""}`
      : order.serviceType === "DELIVERY"
        ? "Domicilio"
        : "Pedido para recoger";

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

      {resource?.notice && (
        <p className="mp-notice" role="status">
          {resource.notice}
        </p>
      )}

      {resource?.uncertain && (
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
            {order.status === "DELIVERED" && (
              <span className="mp-neutral">Pendiente de cobro</span>
            )}
          </div>

          {onCheckout && order.status === "DELIVERED" && (
            <p>Registra los pagos con «Cobrar y cerrar cuenta».</p>
          )}

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

        {resource && order.status === "DELIVERED" && onCheckout && (
          <Button
            disabled={blocked || pending.length > 0}
            onClick={onCheckout}
          >
            <CircleDollarSign size={16} />
            Cobrar y cerrar cuenta
          </Button>
        )}
      </footer>
    </>
  );
}
