import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";

import type {
  RefundItemDraft,
  RefundPaymentDraft,
} from "../schemas/refund.schema";
import type { RefundContext } from "../services/refund.service";
import {
  micros,
  refundMoney,
  returnedPayment,
  returnedQuantity,
  refundPlan,
  refundPayments,
} from "../utils/refund-calculation";

export function RefundItems({
  data,
  drafts,
  change,
}: {
  data: RefundContext;
  drafts: RefundItemDraft[];
  change: (next: RefundItemDraft) => void;
}) {
  return (
    <>
      {drafts.map((draft) => {
        const item = data.sale.items.find(
          (row) => row.id === draft.saleItemId
        )!;

        const returned = returnedQuantity(data.refunds, item.id);
        const available = item.quantity - returned;

        return (
          <section className="refund-item" key={item.id}>
            <h3>{item.productName}</h3>

            <small>
              Cantidad comprada {item.quantity} · Ya devuelta{" "}
              {returned}
              {" · "}Disponible {available}
            </small>

            <TextField
              label="Cantidad a devolver"
              type="number"
              min={0}
              max={Math.min(available, 65535)}
              step={1}
              disabled={available <= 0}
              value={draft.quantity}
              onChange={(event) =>
                change({ ...draft, quantity: event.target.value })
              }
            />

            <label className="refund-check">
              <input
                type="checkbox"
                checked={draft.restoreInventory}
                disabled={available <= 0}
                onChange={(event) =>
                  change({
                    ...draft,
                    restoreInventory: event.target.checked,
                  })
                }
              />
              Restaurar al inventario
            </label>

            <small>
              La restauración se solicitará únicamente si seleccionas
              esta opción.
            </small>
          </section>
        );
      })}
    </>
  );
}

export function RefundPayments({
  data,
  drafts,
  total,
  change,
}: {
  data: RefundContext;
  drafts: RefundPaymentDraft[];
  total: bigint;
  change: (next: RefundPaymentDraft) => void;
}) {
  return (
    <>
      <p>
        Total calculado a devolver:{" "}
        <strong>{refundMoney(total, data.sale.currencyCode)}</strong>
      </p>

      <small>
        Distribuye el reembolso entre los pagos originales. Deja en
        cero los que no utilizarás.
      </small>

      {drafts.map((draft) => {
        const payment = data.sale.payments.find(
          (row) => row.id === draft.salePaymentId
        )!;

        const available =
          micros(payment.amount) -
          returnedPayment(data.refunds, payment.id);

        return (
          <section className="refund-item" key={payment.id}>
            <h3>
              {payment.paymentMethodName} · Pago #{payment.id}
            </h3>

            <small>
              Disponible para reembolsar:{" "}
              {refundMoney(available, data.sale.currencyCode)}
            </small>

            <div className="refund-grid">
              <TextField
                label="Valor a devolver"
                inputMode="decimal"
                disabled={available <= 0}
                value={draft.amount}
                onChange={(event) =>
                  change({ ...draft, amount: event.target.value })
                }
              />

              <TextField
                label={
                  payment.requiresReference
                    ? "Referencia obligatoria"
                    : "Referencia (opcional)"
                }
                disabled={available <= 0}
                maxLength={120}
                value={draft.reference}
                onChange={(event) =>
                  change({ ...draft, reference: event.target.value })
                }
              />

              <TextField
                label="Notas (opcional)"
                disabled={available <= 0}
                maxLength={500}
                value={draft.notes}
                onChange={(event) =>
                  change({ ...draft, notes: event.target.value })
                }
              />
            </div>
          </section>
        );
      })}
    </>
  );
}

export function RefundReview({
  data,
  plan,
  paymentPlan,
  cashSessionId,
  setCashSessionId,
  reason,
  setReason,
  accepted,
  setAccepted,
  disabled,
}: {
  data: RefundContext;
  plan: ReturnType<typeof refundPlan>;
  paymentPlan: ReturnType<typeof refundPayments>;
  cashSessionId: string;
  setCashSessionId: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <>
      <SelectField
        label="Turno abierto de esta ubicación"
        placeholder="Seleccionar turno"
        value={cashSessionId}
        disabled={disabled}
        options={data.sessions.map((row) => ({
          value: row.id,
          label: "#" + row.id + " · " + row.cashRegister.name,
        }))}
        onValueChange={setCashSessionId}
      />

      <label className="refund-reason">
        Motivo obligatorio (entre 5 y 500 caracteres)
        <textarea
          minLength={5}
          maxLength={500}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <dl className="refund-totals">
        {(
          [
            ["Neto calculado", plan.net],
            ["Impuesto calculado", plan.tax],
            ["Total calculado", plan.total],
            ["Costo", plan.cost],
            ["Efectivo que saldrá de caja", paymentPlan.cash],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{refundMoney(value, data.sale.currencyCode)}</dd>
          </div>
        ))}
      </dl>

      <small>
        El servidor comprobará estos importes al registrar la
        devolución.
      </small>

      <h3>Productos devueltos e inventario</h3>

      {plan.items.map((item) => (
        <p key={item.saleItemId}>
          {item.quantity} ×{" "}
          {
            data.sale.items.find((row) => row.id === item.saleItemId)
              ?.productName
          }
          {" · "}
          {item.restoreInventory
            ? "Restauración solicitada"
            : "Sin restauración"}
        </p>
      ))}

      <h3>Devolución del dinero por pago original</h3>

      {paymentPlan.payments.map((payment) => (
        <p key={payment.salePaymentId}>
          {
            data.sale.payments.find(
              (row) => row.id === payment.salePaymentId
            )?.paymentMethodName
          }
          {" · "}
          {refundMoney(payment.amount, data.sale.currencyCode)}
          {payment.reference && " · Ref. " + payment.reference}
        </p>
      ))}

      <label className="refund-check">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        Confirmo la devolución de los productos y el reembolso del
        dinero.
      </label>
    </>
  );
}
