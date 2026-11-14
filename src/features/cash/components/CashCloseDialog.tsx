import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../hooks/useCashResource";
import { useCashMutation } from "../hooks/useCashMutation";
import { closeSessionInput } from "../schemas/cash.schema";
import type { CashSession } from "../schemas/cash.schema";
import {
  readCashSession,
  closeSession,
} from "../services/cash.service";
import { cashCents, cashMoney } from "../utils/cash-format";
import { CashBalance } from "./CashPanels";

export function CashCloseDialog({
  id,
  close,
  saved,
}: {
  id: string;
  close: () => void;
  saved: (row: CashSession) => void;
}) {
  const { session } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) => readCashSession(id, session, signal),
    [id, session]
  );

  const resource = useCashResource(loader);
  const mutation = useCashMutation();

  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);

  const data = resource.data?.reconciliation;

  const body = closeSessionInput.safeParse({
    countedCashAmount: counted,
    closingNotes: notes,
  });

  const allowed =
    data?.cashSession.status === "OPEN" &&
    hasPermission(session, "cash.sessions.close");

  const disabled =
    mutation.busy ||
    mutation.uncertain ||
    resource.loading ||
    !allowed ||
    !body.success;

  const difference =
    data && body.success
      ? cashCents(body.data.countedCashAmount) -
        cashCents(data.movements.calculatedExpectedCashAmount)
      : null;

  function submit() {
    if (disabled) return;

    if (!review) {
      setReview(true);
      resource.reload();
      return;
    }

    void mutation.run(
      (signal) =>
        closeSession(
          id,
          {
            countedCashAmount: counted,
            closingNotes: notes,
          },
          session,
          signal
        ),
      saved
    );
  }

  return (
    <BottomSheet
      id="cash-close"
      open
      variant="modal"
      className="cash-dialog"
      title={
        review ? "Revisar arqueo y cerrar turno" : "Cerrar turno"
      }
      busy={mutation.busy}
      onClose={close}
    >
      <form
        className="cash-stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {resource.loading && (
          <p role="status">Consultando el saldo del turno…</p>
        )}

        {(resource.error || mutation.error) && (
          <p role="alert" className="cash-negative">
            {resource.error || mutation.error}
          </p>
        )}

        {resource.error && (
          <Button variant="secondary" onClick={resource.reload}>
            Reintentar consulta
          </Button>
        )}

        {data && (
          <>
            <p>
              {data.cashSession.cashRegister.name} ·{" "}
              {data.cashSession.currencyCode}
            </p>

            {!allowed && (
              <p>
                Este turno está cerrado o no tienes permiso para
                cerrarlo.
              </p>
            )}

            <CashBalance data={data} />

            <TextField
              label="Efectivo contado"
              inputMode="decimal"
              value={counted}
              disabled={review || mutation.busy}
              onChange={(event) => setCounted(event.target.value)}
              required
            />

            <small>
              Sin separadores de miles; usa punto para los decimales.
            </small>

            <section className="cash-note">
              <h3>Otros medios registrados · solo lectura</h3>

              {data.paymentMethods
                .filter((payment) => payment.paymentType !== "CASH")
                .map((payment) => (
                  <div
                    className="cash-line"
                    key={payment.paymentMethodCode}
                  >
                    <span>{payment.paymentMethodName}</span>
                    <strong>
                      {cashMoney(
                        payment.netAmount,
                        data.cashSession.currencyCode
                      )}
                    </strong>
                  </div>
                ))}

              <p>
                Estos medios no se suman al efectivo esperado ni al
                efectivo contado.
              </p>
            </section>

            <TextAreaField
              label="Observaciones"
              value={notes}
              maxLength={500}
              disabled={review || mutation.busy}
              onChange={(event) => setNotes(event.target.value)}
            />

            {review && (
              <>
                <div className="cash-line">
                  <strong>Diferencia preliminar</strong>
                  <strong>
                    {difference === null
                      ? "—"
                      : cashMoney(
                          difference,
                          data.cashSession.currencyCode
                        )}
                  </strong>
                </div>

                <p>
                  El cierre guardará el efectivo contado y las
                  observaciones. El servidor calculará la diferencia
                  definitiva con los movimientos registrados al
                  cerrar.
                </p>
              </>
            )}
          </>
        )}

        <div className="cash-actions">
          <Button
            variant="secondary"
            disabled={mutation.busy}
            onClick={close}
          >
            Cancelar
          </Button>

          {review && (
            <Button
              variant="secondary"
              disabled={mutation.busy}
              onClick={() => setReview(false)}
            >
              Corregir conteo
            </Button>
          )}

          <Button
            type="submit"
            loading={mutation.busy}
            disabled={disabled}
          >
            {review ? "Confirmar cierre" : "Revisar arqueo"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
