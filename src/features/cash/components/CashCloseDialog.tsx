import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { useCashResource } from "../hooks/useCashResource";
import { useCashClose } from "../hooks/useCashClose";

import {
  cashAmountInput,
  closeSessionInput,
  type CashSession,
  type Reconciliation,
} from "../schemas/cash.schema";

import {
  canCloseCash,
  readCloseReconciliation,
} from "../services/cash-close.service";

import {
  countPreview,
  centsDecimal,
  type CashCountDraft,
} from "../utils/cash-count";

import { CashTotals } from "./CashPanels";

import {
  CashCloseTotals,
  CashDifference,
  CashOtherPayments,
} from "./CashCountPanel";

type Props = {
  id: string;
  close: () => void;
  saved: (row: CashSession, submitted: boolean) => void;
  initial?: CashCountDraft;
};

export function CashCloseDialog(props: Props) {
  const { session } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) =>
      readCloseReconciliation(props.id, session, signal),
    [props.id, session]
  );

  const resource = useCashResource(loader);

  if (resource.data) {
    return <CloseForm {...props} data={resource.data} />;
  }

  return (
    <BottomSheet
      id="cash-close-loading"
      open
      variant="modal"
      className="cash-dialog cash-close-dialog"
      title="Cerrar turno"
      onClose={props.close}
    >
      <div className="cash-stack">
        {resource.loading && (
          <p role="status">Consultando conciliación…</p>
        )}

        {resource.error && (
          <>
            <p role="alert" className="cash-negative">
              {resource.error}
            </p>

            <Button onClick={resource.reload}>
              Reintentar consulta
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function CloseForm({
  data,
  close,
  saved,
  initial,
}: Props & {
  data: Reconciliation;
}) {
  const { session } = useAppShell();

  const [counted, setCounted] = useState(initial?.counted ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const flow = useCashClose(session, data, saved, !!initial);
  const row = flow.data.cashSession;

  const input = closeSessionInput.safeParse({
    countedCashAmount: counted,
    closingNotes: notes,
  });

  const preview = cashAmountInput.safeParse(counted).success
    ? countPreview(
        counted.trim(),
        flow.data.movements.calculatedExpectedCashAmount
      )
    : null;

  const allowed = canCloseCash(row, session);

  const valid =
    allowed &&
    input.success &&
    preview &&
    !preview.error &&
    !flow.busy &&
    !flow.uncertain;

  const draft = { counted, notes };

  return (
    <BottomSheet
      id="cash-close"
      open
      variant="modal"
      className="cash-dialog cash-close-dialog"
      title={
        flow.review ? "Confirmar cierre y arqueo" : "Cerrar turno"
      }
      busy={flow.busy}
      onClose={close}
    >
      <p className="cash-dialog-subtitle">
        {row.cashRegister.name} · {row.cashRegister.location.name}
      </p>

      <form
        className="cash-stack"
        onSubmit={(event) => {
          event.preventDefault();

          if (valid) {
            void flow.run(flow.review ? "confirm" : "review", draft);
          }
        }}
      >
        {!allowed && (
          <p role="alert">
            Este turno está cerrado o no tienes permiso para cerrarlo.
          </p>
        )}

        <CashCloseTotals data={flow.data} />

        {flow.review ? (
          <CashTotals
            currency={row.currencyCode}
            rows={[
              ["Efectivo contado", counted.trim()],
              [
                "Diferencia preliminar",
                preview?.difference === null ||
                preview?.difference === undefined
                  ? null
                  : centsDecimal(preview.difference),
              ],
            ]}
          />
        ) : (
          <TextField
            label="Efectivo contado"
            inputMode="decimal"
            required
            data-dialog-initial-focus
            value={counted}
            disabled={flow.busy || flow.uncertain || !allowed}
            error={
              counted && !cashAmountInput.safeParse(counted).success
                ? "Usa un importe no negativo con máximo dos decimales."
                : undefined
            }
            onChange={(event) => setCounted(event.target.value)}
          />
        )}

        {preview && !preview.error && (
          <div>
            <CashDifference
              value={preview.difference}
              currency={row.currencyCode}
            />
          </div>
        )}

        {preview?.error && (
          <p role="alert" className="cash-negative">
            {preview.error}
          </p>
        )}

        <CashOtherPayments data={flow.data} />

        {flow.review ? (
          <>
            {notes.trim() && (
              <p className="cash-count-notes">
                <span className="cash-muted">Observaciones: </span>
                {notes.trim()}
              </p>
            )}

            <p className="cash-muted">
              El turno cerrado no podrá modificarse. El servidor
              calculará el arqueo definitivo al confirmar.
            </p>
          </>
        ) : (
          <div className="cash-notes-field">
            <TextAreaField
              label="Observaciones"
              value={notes}
              maxLength={500}
              disabled={flow.busy || flow.uncertain || !allowed}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        )}

        {flow.error && (
          <p role="alert" className="cash-negative">
            {flow.error}
          </p>
        )}

        {(flow.uncertain || row.status === "CLOSED") && (
          <Button
            variant="secondary"
            disabled={flow.busy}
            onClick={() => void flow.run("verify", draft)}
          >
            Consultar estado del turno
          </Button>
        )}

        <footer className="cash-actions">
          <Button
            variant="secondary"
            disabled={flow.busy}
            onClick={
              flow.review && !flow.uncertain ? flow.back : close
            }
          >
            {flow.review && !flow.uncertain ? "Atrás" : "Cancelar"}
          </Button>

          <Button
            type="submit"
            loading={flow.busy}
            loadingText="Procesando…"
            disabled={!valid}
          >
            {flow.review ? "Confirmar cierre" : "Revisar arqueo"}
          </Button>
        </footer>
      </form>
    </BottomSheet>
  );
}
