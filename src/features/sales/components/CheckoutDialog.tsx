import { useCallback, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Link } from "react-router";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashCents, cashMoney } from "../../cash/utils/cash-format";
import { useCheckoutMutation } from "../hooks/useCheckoutMutation";
import { saleLabels } from "../schemas/financial-sales.schema";
import { preciseOrderMoney } from "../schemas/sales.schema";
import {
  readCheckout,
  type CheckoutData,
} from "../services/checkout.service";
import {
  calculateCheckout,
  decimal,
  newPayment,
} from "../utils/checkout-calculation";
import { CheckoutPayment } from "./CheckoutPayment";
import "../checkout.css";

type Props = {
  orderId: string;
  locationId: string;
  onClose: () => void;
  onRecorded: () => void;
};

export function CheckoutDialog(props: Props) {
  const { session } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) =>
      readCheckout(session, props.orderId, props.locationId, signal),
    [session, props.orderId, props.locationId]
  );

  const resource = useCashResource(loader);

  if (resource.data) {
    return (
      <CheckoutForm
        {...props}
        data={resource.data}
        reload={resource.reload}
      />
    );
  }

  return (
    <BottomSheet
      id="checkout-loading"
      open
      variant="modal"
      className="checkout-dialog"
      title="Cobrar y cerrar cuenta"
      onClose={props.onClose}
    >
      <div className="checkout-body">
        {resource.loading && (
          <p role="status">
            Consultando cuenta, turnos y formas de pago…
          </p>
        )}

        {resource.error && (
          <>
            <p role="alert" className="checkout-error">
              {resource.error}
            </p>
            <Button variant="secondary" onClick={resource.reload}>
              Reintentar consulta
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function CheckoutForm({
  data,
  reload,
  onClose,
  onRecorded,
}: Props & {
  data: CheckoutData;
  reload: () => void;
}) {
  const { session, settings } = useAppShell();
  const mutation = useCheckoutMutation(session, data, onRecorded);

  const [cashSessionId, setCashSessionId] = useState(
    data.sessions.length === 1 ? data.sessions[0].id : ""
  );

  const [payments, setPayments] = useState(() => [
    {
      ...newPayment(),
      amount: data.order.total,
    },
  ]);

  const selected = data.sessions.find(
    (row) => row.id === cashSessionId
  );

  const currency =
    selected?.currencyCode ?? settings.data?.currencyCode ?? "COP";

  const result = calculateCheckout(
    payments,
    data.methods,
    data.order.total
  );

  const order = data.order;
  const sale = mutation.sale;

  const blocked =
    mutation.busy ||
    mutation.review ||
    mutation.uncertain ||
    mutation.closed;
  const canSubmit =
    !blocked &&
    !!selected &&
    result.valid &&
    order.status === "DELIVERED" &&
    cashCents(order.total) > 0n;

  return (
    <BottomSheet
      id="checkout"
      open
      variant="modal"
      className="checkout-dialog"
      title={
        sale
          ? sale.status === "COMPLETED"
            ? "Cuenta cobrada y cerrada"
            : "Venta registrada"
          : mutation.closed
            ? "Orden cerrada"
            : "Cobrar y cerrar cuenta"
      }
      busy={mutation.busy || mutation.uncertain}
      onClose={onClose}
    >
      <p className="checkout-subtitle">
        Orden #{order.id} · {order.location.name}
      </p>

      {sale ? (
        <>
          <div className="checkout-success" role="status">
            <Check size={38} aria-hidden="true" />

            <h3>Venta #{sale.id}</h3>

            <p>Total {cashMoney(sale.total, sale.currencyCode)}</p>

            <small>{saleLabels[sale.status]}</small>

            <div className="checkout-receipt">
              {sale.payments.map((payment) => (
                <div className="checkout-row" key={payment.id}>
                  <span>
                    {payment.paymentMethodName}
                    {payment.reference && (
                      <small>Ref. {payment.reference}</small>
                    )}
                  </span>

                  <strong>
                    {cashMoney(payment.amount, sale.currencyCode)}
                  </strong>
                </div>
              ))}
            </div>

            <p>
              Cambio entregado:{" "}
              <strong>
                {cashMoney(sale.changeTotal, sale.currencyCode)}
              </strong>
            </p>

            <small>La cuenta quedó cerrada.</small>

            <Link
              to={"/historial-ventas?venta=" + sale.id}
              onClick={onClose}
            >
              Ver detalle de venta
            </Link>
          </div>

          <footer className="checkout-footer">
            <Button onClick={onClose}>Finalizar</Button>
          </footer>
        </>
      ) : mutation.closed ? (
        <>
          <div className="checkout-success" role="status">
            <Check size={38} aria-hidden="true" />

            <h3>La orden está cerrada</h3>

            <p>No se enviarán nuevos cobros.</p>

            <p>
              No fue posible recuperar el detalle de la venta. Puedes
              consultarlo en el historial.
            </p>
          </div>

          <footer className="checkout-footer">
            <Button onClick={onClose}>Finalizar</Button>
          </footer>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (canSubmit) {
              void mutation.confirm({
                orderId: order.id,
                cashSessionId,
                payments: result.payments,
              });
            }
          }}
        >
          <div className="checkout-body">
            <div className="checkout-items">
              {order.items
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <div className="checkout-row" key={item.id}>
                    <span>
                      {item.quantity} × {item.productName}
                    </span>
                    <strong>
                      {cashMoney(item.lineTotal, currency)}
                    </strong>
                  </div>
                ))}
            </div>

            <dl className="checkout-totals" aria-live="polite">
              {order.serviceType === "TABLE" && (
                <>
                  <div>
                    <dt>Subtotal neto</dt>
                    <dd>
                      {order.netSubtotal !== undefined
                        ? preciseOrderMoney(order.netSubtotal)
                        : "No disponible"}
                    </dd>
                  </div>

                  <div>
                    <dt>Impuestos</dt>
                    <dd>
                      {order.taxTotal !== undefined
                        ? preciseOrderMoney(order.taxTotal)
                        : "No disponible"}
                    </dd>
                  </div>
                </>
              )}
              {(
                [
                  ["Total de la cuenta", cashCents(order.total)],
                  ["Total aplicado", result.paid],
                  [
                    "Pendiente por pagar",
                    result.remaining > 0n ? result.remaining : 0n,
                  ],
                  ["Cambio", result.change],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {value === null
                      ? "No disponible"
                      : cashMoney(value, currency)}
                  </dd>
                </div>
              ))}
            </dl>

            {order.status !== "DELIVERED" && (
              <p role="alert" className="checkout-error">
                La orden ya no está entregada y disponible para
                cobrar. Estado: {order.status}.
                <Button
                  variant="secondary"
                  disabled={mutation.busy}
                  onClick={() => void mutation.verify()}
                >
                  Verificar venta
                </Button>
              </p>
            )}

            {cashCents(order.total) === 0n && (
              <p role="alert">
                El total es cero. La API actual requiere pagos
                positivos para registrar una venta.
              </p>
            )}

            {!data.sessions.length && (
              <div className="checkout-error" role="alert">
                <p>
                  No hay un turno de caja abierto en esta ubicación.
                </p>

                {hasPermission(session, "cash.sessions.open") && (
                  <Link to="/cajas" onClick={onClose}>
                    Ir a Cajas y turnos
                  </Link>
                )}
              </div>
            )}

            {!data.methods.length && (
              <p role="alert">No hay formas de pago activas.</p>
            )}

            <fieldset
              disabled={blocked || order.status !== "DELIVERED"}
            >
              <SelectField
                label="Turno de caja abierto"
                placeholder="Seleccionar turno"
                value={cashSessionId}
                disabled={blocked || order.status !== "DELIVERED"}
                options={data.sessions.map((row) => ({
                  value: row.id,
                  label: "#" + row.id + " · " + row.cashRegister.name,
                }))}
                onValueChange={setCashSessionId}
              />

              {payments.map((payment, index) => (
                <CheckoutPayment
                  key={payment.key}
                  payment={payment}
                  index={index}
                  methods={data.methods}
                  currency={currency}
                  removable={payments.length > 1}
                  disabled={blocked || order.status !== "DELIVERED"}
                  change={(next) =>
                    setPayments((previous) =>
                      previous.map((row) =>
                        row.key === next.key ? next : row
                      )
                    )
                  }
                  remove={() =>
                    setPayments((previous) =>
                      previous.filter(
                        (row) => row.key !== payment.key
                      )
                    )
                  }
                />
              ))}

              <Button
                variant="secondary"
                disabled={blocked || payments.length >= 20}
                onClick={() =>
                  setPayments((previous) => [
                    ...previous,
                    {
                      ...newPayment(),
                      amount:
                        result.remaining > 0n
                          ? decimal(result.remaining)
                          : "",
                    },
                  ])
                }
              >
                <Plus size={16} aria-hidden="true" />
                Agregar pago
              </Button>
            </fieldset>

            <small>
              Valores sin separadores de miles; usa punto para los
              decimales.
            </small>

            {result.error && !mutation.error && (
              <p role="status">{result.error}</p>
            )}

            {mutation.error && (
              <p role="alert" className="checkout-error">
                {mutation.error}
              </p>
            )}

            {mutation.review && (
              <div className="checkout-row">
                <Button
                  variant="secondary"
                  disabled={mutation.busy}
                  onClick={() => void mutation.verify()}
                >
                  Verificar venta
                </Button>

                {!mutation.uncertain && (
                  <Button
                    variant="secondary"
                    disabled={mutation.busy}
                    onClick={reload}
                  >
                    Revisar datos de la cuenta
                  </Button>
                )}
              </div>
            )}

            {!data.sessions.length && (
              <Button
                variant="secondary"
                disabled={mutation.busy || mutation.uncertain}
                onClick={reload}
              >
                Consultar turnos nuevamente
              </Button>
            )}
          </div>

          <footer className="checkout-footer">
            <Button
              variant="secondary"
              disabled={mutation.busy || mutation.uncertain}
              onClick={onClose}
            >
              Volver
            </Button>

            <Button
              type="submit"
              loading={mutation.busy}
              loadingText="Verificando…"
              disabled={!canSubmit}
            >
              Confirmar cobro y cerrar
            </Button>
          </footer>
        </form>
      )}
    </BottomSheet>
  );
}
