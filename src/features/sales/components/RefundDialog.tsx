import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useCashResource } from "../../cash/hooks/useCashResource";

import { refundInput } from "../schemas/refund.schema";
import {
  readRefundContext,
  type RefundContext,
} from "../services/refund.service";
import {
  refundPlan,
  refundPayments,
} from "../utils/refund-calculation";
import { useRefundMutation } from "../hooks/useRefundMutation";
import {
  RefundItems,
  RefundPayments,
  RefundReview,
} from "./RefundSteps";

import "../refund.css";

type Props = {
  saleId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function RefundDialog(props: Props) {
  const { session } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) =>
      readRefundContext(session, props.saleId, signal),
    [session, props.saleId]
  );

  const resource = useCashResource(loader);

  if (resource.data) {
    return (
      <RefundForm
        {...props}
        data={resource.data}
        reload={resource.reload}
      />
    );
  }

  return (
    <BottomSheet
      id="refund-loading"
      open
      variant="modal"
      className="refund-dialog"
      title="Registrar devolución"
      onClose={props.onClose}
    >
      <div className="refund-body">
        {resource.loading && (
          <p role="status">Consultando venta y devoluciones…</p>
        )}

        {resource.error && (
          <>
            <p role="alert">{resource.error}</p>
            <Button onClick={resource.reload}>Reintentar</Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function RefundForm({
  data,
  reload,
  onClose,
  onCreated,
}: Props & {
  data: RefundContext;
  reload: () => void;
}) {
  const { session } = useAppShell();

  const [step, setStep] = useState(1);

  const [items, setItems] = useState(() =>
    data.sale.items.map((item) => ({
      saleItemId: item.id,
      quantity: "0",
      restoreInventory: false,
    }))
  );

  const [payments, setPayments] = useState(() =>
    data.sale.payments.map((payment) => ({
      salePaymentId: payment.id,
      amount: "",
      reference: "",
      notes: "",
    }))
  );

  const [cashSessionId, setCashSessionId] = useState(
    data.sessions.length === 1 ? data.sessions[0].id : ""
  );

  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);

  const mutation = useRefundMutation(session, data, onCreated);
  const plan = refundPlan(data.sale, data.refunds, items);
  const paymentPlan = refundPayments(
    data.sale,
    data.refunds,
    payments,
    plan.total
  );

  const parsed = refundInput.safeParse({
    cashSessionId,
    reason,
    items: plan.items,
    payments: paymentPlan.payments,
  });

  const blocked =
    mutation.busy ||
    mutation.review ||
    !["COMPLETED", "PARTIALLY_REFUNDED"].includes(data.sale.status);

  const stepError =
    step === 1 ? plan.error : plan.error || paymentPlan.error;

  const valid =
    !blocked &&
    !stepError &&
    (step !== 3 ||
      (accepted &&
        parsed.success &&
        data.sessions.some((row) => row.id === cashSessionId)));

  const titles = [
    "Selecciona los productos que devuelve el cliente",
    "Distribuye el reembolso",
    "Revisa y confirma la devolución",
  ];

  return (
    <BottomSheet
      id="refund"
      open
      variant="modal"
      className="refund-dialog"
      title={"Paso " + step + " de 3 · " + titles[step - 1]}
      busy={mutation.busy}
      onClose={onClose}
    >
      <p className="refund-subtitle">
        Venta #{data.sale.id} · {data.sale.location.name}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (!valid) return;

          if (step < 3) {
            setStep(step + 1);
          } else if (parsed.success) {
            void mutation.confirm(parsed.data);
          }
        }}
      >
        <fieldset className="refund-body" disabled={blocked}>
          {step === 1 && (
            <RefundItems
              data={data}
              drafts={items}
              change={(next) =>
                setItems((rows) =>
                  rows.map((row) =>
                    row.saleItemId === next.saleItemId ? next : row
                  )
                )
              }
            />
          )}

          {step === 2 && (
            <RefundPayments
              data={data}
              drafts={payments}
              total={plan.total}
              change={(next) =>
                setPayments((rows) =>
                  rows.map((row) =>
                    row.salePaymentId === next.salePaymentId
                      ? next
                      : row
                  )
                )
              }
            />
          )}

          {step === 3 && (
            <RefundReview
              data={data}
              plan={plan}
              paymentPlan={paymentPlan}
              cashSessionId={cashSessionId}
              setCashSessionId={setCashSessionId}
              reason={reason}
              setReason={setReason}
              accepted={accepted}
              setAccepted={setAccepted}
              disabled={blocked}
            />
          )}
        </fieldset>

        {!["COMPLETED", "PARTIALLY_REFUNDED"].includes(
          data.sale.status
        ) && (
          <p role="alert" className="refund-error">
            La venta ya no admite devoluciones.
          </p>
        )}

        {!data.sessions.length && (
          <p role="alert" className="refund-error">
            Necesitas abrir un turno en esta ubicación antes de
            confirmar.
            <Button
              variant="secondary"
              disabled={mutation.busy || mutation.uncertain}
              onClick={reload}
            >
              Consultar nuevamente
            </Button>
          </p>
        )}

        {stepError && !mutation.error && (
          <p className="refund-error" role="status">
            {stepError}
          </p>
        )}

        {mutation.error && (
          <p className="refund-error" role="alert">
            {mutation.error}
          </p>
        )}

        {mutation.review && (
          <div className="refund-actions">
            <Button
              variant="secondary"
              disabled={mutation.busy}
              onClick={() => void mutation.verify()}
            >
              Consultar devoluciones
            </Button>

            <Button
              variant="secondary"
              disabled={mutation.busy}
              onClick={onClose}
            >
              Ver historial de devoluciones
            </Button>

            {!mutation.uncertain && (
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={reload}
              >
                Revisar datos
              </Button>
            )}
          </div>
        )}

        <footer className="refund-footer">
          <Button
            variant="secondary"
            disabled={mutation.busy}
            onClick={
              step === 1
                ? onClose
                : () => {
                    setAccepted(false);
                    setStep(step - 1);
                  }
            }
          >
            {step === 1 ? "Cancelar" : "Atrás"}
          </Button>

          <Button
            type="submit"
            disabled={!valid}
            loading={mutation.busy}
            loadingText="Procesando…"
          >
            {step === 3 ? "Confirmar devolución" : "Continuar"}
          </Button>
        </footer>
      </form>
    </BottomSheet>
  );
}
