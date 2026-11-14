import { useState } from "react";

import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { Button } from "../../../components/ui/Button";

import {
  cashAmountInput,
  closeSessionInput,
  type CashSession,
  type Reconciliation,
} from "../schemas/cash.schema";

import { cashDate, cashMoney } from "../utils/cash-format";

import {
  cashSum,
  countPreview,
  differenceKind,
  type CashCountDraft,
} from "../utils/cash-count";

import { CashTotals } from "./CashPanels";

import "../cash-close.css";

export function CashDifference({
  value,
  currency,
  amount = true,
}: {
  value: string | bigint | null;
  currency: string;
  amount?: boolean;
}) {
  const kind = differenceKind(value);

  const label = {
    exact: "Caja exacta",
    short: "Faltante",
    over: "Sobrante",
    unknown: "Sin arqueo definitivo",
  }[kind];

  return (
    <span
      className="cash-badge cash-count-badge"
      data-kind={kind}
      role="status"
    >
      {label}

      {amount && value !== null && (
        <>
          {" · "}
          {kind === "over" ? "+" : ""}
          {cashMoney(value, currency)}
        </>
      )}
    </span>
  );
}

export function CashCloseTotals({ data }: { data: Reconciliation }) {
  const m = data.movements;

  return (
    <CashTotals
      currency={data.cashSession.currencyCode}
      rows={[
        ["Efectivo inicial", m.openingCashAmount],
        ["Ventas netas en efectivo", m.cashSaleAmount],
        ["Entradas manuales de efectivo", m.manualIncomeAmount],
        [
          "Salidas de efectivo",
          cashSum(m.withdrawalAmount, m.expenseAmount),
        ],
        ["Reembolsos en efectivo", m.cashRefundAmount],
        ["Ajustes de entrada", m.adjustmentInAmount],
        ["Ajustes de salida", m.adjustmentOutAmount],
        ["Efectivo esperado en caja", m.calculatedExpectedCashAmount],
      ]}
    />
  );
}

export function CashOtherPayments({
  data,
}: {
  data: Reconciliation;
}) {
  const payments = data.paymentMethods.filter(
    (row) => row.paymentType !== "CASH"
  );

  return (
    <section className="cash-note cash-other-payments">
      <h3>Otros medios registrados · solo lectura</h3>

      {!payments.length && (
        <p className="cash-muted">No hay otros medios registrados.</p>
      )}

      <CashTotals
        currency={data.cashSession.currencyCode}
        rows={[
          ...payments.map(
            (row) =>
              [
                row.paymentMethodName + " neto",
                row.netAmount,
              ] as const
          ),
          [
            "Actividad comercial neta total",
            data.commercial.netCommercialAmount,
          ],
        ]}
      />

      <small className="cash-muted">
        Estos medios no se suman al efectivo esperado ni al efectivo
        contado.
      </small>
    </section>
  );
}

export function CashCountPanel({
  row,
  data,
  timeZone,
  allowed,
  onReview,
}: {
  row: CashSession;
  data?: Reconciliation;
  timeZone: string;
  allowed: boolean;
  onReview: (draft: CashCountDraft) => void;
}) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  const closed = row.status === "CLOSED";
  const m = data?.movements;

  const input = closeSessionInput.safeParse({
    countedCashAmount: counted,
    closingNotes: notes,
  });

  const preview =
    m && cashAmountInput.safeParse(counted).success
      ? countPreview(counted.trim(), m.calculatedExpectedCashAmount)
      : null;

  const complete = closed && data?.cashSession.status === "CLOSED";

  const available = !closed || complete;

  return (
    <section className="cash-count-panel">
      {closed && (
        <CashDifference
          value={row.differenceAmount}
          currency={row.currencyCode}
          amount={false}
        />
      )}

      <CashTotals
        currency={row.currencyCode}
        rows={[
          ["Efectivo inicial", row.openingCashAmount],
          [
            "Entradas de efectivo",
            available && m
              ? cashSum(
                  m.cashSaleAmount,
                  m.manualIncomeAmount,
                  m.adjustmentInAmount
                )
              : null,
          ],
          [
            "Salidas de efectivo",
            available && m
              ? cashSum(
                  m.withdrawalAmount,
                  m.expenseAmount,
                  m.cashRefundAmount,
                  m.adjustmentOutAmount
                )
              : null,
          ],
          [
            "Efectivo esperado",
            closed
              ? row.expectedCashAmount
              : (m?.calculatedExpectedCashAmount ?? null),
          ],
          ...(closed
            ? ([
                ["Efectivo contado", row.countedCashAmount],
                ["Diferencia", row.differenceAmount],
              ] as const)
            : []),
        ]}
      />

      <dl className="cash-metadata">
        <div>
          <dt>Abierto por</dt>
          <dd>{row.openedBy.fullName}</dd>
        </div>

        <div>
          <dt>Fecha de apertura</dt>
          <dd>{cashDate(row.openedAt, timeZone)}</dd>
        </div>

        {closed && (
          <>
            <div>
              <dt>Cerrado por</dt>
              <dd>{row.closedBy?.fullName ?? "—"}</dd>
            </div>

            <div>
              <dt>Fecha de cierre</dt>
              <dd>{cashDate(row.closedAt, timeZone)}</dd>
            </div>

            <div className="cash-count-notes">
              <dt>Observaciones</dt>
              <dd>{row.closingNotes || "—"}</dd>
            </div>
          </>
        )}
      </dl>

      {!closed && allowed && (
        <form
          className="cash-stack"
          onSubmit={(event) => {
            event.preventDefault();

            if (input.success && preview && !preview.error && data) {
              onReview({ counted, notes });
            }
          }}
        >
          <TextField
            label="Efectivo contado"
            inputMode="decimal"
            value={counted}
            required
            error={
              counted && !cashAmountInput.safeParse(counted).success
                ? "Usa un importe no negativo con máximo dos decimales."
                : undefined
            }
            onChange={(event) => setCounted(event.target.value)}
          />

          <small className="cash-muted">
            Sin separadores de miles; usa punto para los decimales.
          </small>

          {preview?.error && (
            <p role="alert" className="cash-negative">
              {preview.error}
            </p>
          )}

          {preview && !preview.error && (
            <div>
              <CashDifference
                value={preview.difference}
                currency={row.currencyCode}
              />

              <small className="cash-muted">
                {" "}
                Diferencia preliminar.
              </small>
            </div>
          )}

          <div className="cash-notes-field">
            <TextAreaField
              label="Observaciones"
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="cash-actions">
            <Button
              type="submit"
              disabled={!input.success || !preview || !!preview.error}
            >
              Cerrar turno
            </Button>
          </div>
        </form>
      )}

      {!closed && !allowed && (
        <p className="cash-muted">
          El arqueo definitivo estará disponible al cerrar el turno.
        </p>
      )}
    </section>
  );
}
