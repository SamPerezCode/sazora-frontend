import { useId } from "react";

import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { cashDate, cashMoney } from "../../cash/utils/cash-format";

import type { PreorderPaymentBatch } from "../services/preorder-payments.service";

import { PaymentBadge } from "./PreorderList";

export function PreorderPaymentDetailDialog({
  orderId,
  batch,
  timeZone,
  busy,
  onClose,
  onRefund,
}: {
  orderId: string;
  batch: PreorderPaymentBatch;
  timeZone: string;
  busy: boolean;
  onClose: () => void;
  onRefund?: () => void;
}) {
  const id = useId();

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      className="preorder-dialog pp-detail-dialog"
      title="Detalle del pago"
      busy={busy}
      onClose={onClose}
    >
      <div className="pp-content">
        <p className="pp-subtitle">Orden #{orderId}</p>

        <PaymentBadge status={batch.status} />

        <dl className="pp-facts">
          <div>
            <dt>Verificado</dt>
            <dd>{cashDate(batch.verifiedAt, timeZone)}</dd>
          </div>

          <div>
            <dt>Total pagado originalmente</dt>
            <dd>{cashMoney(batch.paidTotal, "COP")}</dd>
          </div>

          <div>
            <dt>Cambio entregado</dt>
            <dd>{cashMoney(batch.changeTotal, "COP")}</dd>
          </div>
        </dl>

        {batch.status === "REFUNDED" && (
          <p className="preorder-banner" data-danger>
            Este lote figura devuelto. Los importes siguientes
            corresponden a los pagos originales.
          </p>
        )}

        {batch.payments.map((payment) => (
          <section className="pp-payment" key={payment.id}>
            <div className="pp-line">
              <strong>{payment.paymentMethodName}</strong>
              <strong>{cashMoney(payment.amount, "COP")}</strong>
            </div>

            {payment.reference && (
              <small>Referencia original: {payment.reference}</small>
            )}

            {payment.notes && <p>Observaciones: {payment.notes}</p>}
          </section>
        ))}
      </div>

      <footer className="pp-footer">
        <div className="sales-form-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cerrar
          </Button>

          {onRefund && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={onRefund}
            >
              Devolver pago
            </Button>
          )}
        </div>
      </footer>
    </BottomSheet>
  );
}
