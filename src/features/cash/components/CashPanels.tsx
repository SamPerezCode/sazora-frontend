import type {
  CashMovement,
  CashSession,
  Reconciliation,
} from "../schemas/cash.schema";

import { movementLabels } from "../schemas/cash.schema";
import { cashDate, cashMoney } from "../utils/cash-format";

export function CashTotals({
  rows,
  currency,
}: {
  rows: ReadonlyArray<readonly [string, string | null]>;
  currency: string;
}) {
  return (
    <dl className="cash-totals">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{cashMoney(value, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CashBalance({ data }: { data: Reconciliation }) {
  const m = data.movements;

  return (
    <CashTotals
      currency={data.cashSession.currencyCode}
      rows={[
        ["Efectivo inicial", m.openingCashAmount],
        ["Ventas en efectivo", m.cashSaleAmount],
        ["Ingresos manuales", m.manualIncomeAmount],
        ["Retiros", m.withdrawalAmount],
        ["Gastos", m.expenseAmount],
        ["Reembolsos en efectivo", m.cashRefundAmount],
        ["Ajustes de entrada", m.adjustmentInAmount],
        ["Ajustes de salida", m.adjustmentOutAmount],
        ["Movimiento neto", m.movementNetAmount],
        [
          "Efectivo esperado calculado",
          m.calculatedExpectedCashAmount,
        ],
      ]}
    />
  );
}

export function CashSummary({
  data,
  timeZone,
}: {
  data: Reconciliation;
  timeZone: string;
}) {
  const s = data.cashSession;

  return (
    <div className="cash-columns">
      <CashBalance data={data} />

      <dl className="cash-metadata">
        {[
          ["Caja", s.cashRegister.name],
          ["Ubicación", s.cashRegister.location.name],
          ["Responsable", s.openedBy.fullName],
          ["Moneda", s.currencyCode],
          ["Apertura", cashDate(s.openedAt, timeZone)],
          ["Observaciones de apertura", s.openingNotes || "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CashReconciliation({
  data,
}: {
  data: Reconciliation;
}) {
  const c = data.commercial;
  const currency = data.cashSession.currencyCode;

  return (
    <div className="cash-stack">
      <p className="cash-muted">
        Solo el efectivo físico forma parte del efectivo esperado. Los
        demás medios se concilian por separado.
      </p>

      <div className="cash-columns">
        <section>
          <h3>Movimientos de efectivo</h3>
          <CashBalance data={data} />
        </section>

        <section>
          <h3>Actividad comercial</h3>

          <p>
            {c.grossSaleCount} ventas · {c.voidedSaleCount} anuladas ·{" "}
            {c.refundCount} devoluciones
          </p>

          <CashTotals
            currency={currency}
            rows={[
              ["Venta bruta", c.grossSaleAmount],
              ["Valor anulado", c.voidedSaleAmount],
              ["Valor devuelto", c.refundedAmount],
              ["Actividad comercial neta", c.netCommercialAmount],
            ]}
          />
        </section>
      </div>

      <section>
        <h3>Conciliación por medio de pago</h3>

        <div className="cash-table-wrap">
          <table className="cash-table">
            <thead>
              <tr>
                {[
                  "Medio",
                  "Recibido",
                  "Anulado",
                  "Devuelto",
                  "Neto",
                ].map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.paymentMethods.map((payment) => (
                <tr key={payment.paymentMethodCode}>
                  <td>{payment.paymentMethodName}</td>

                  {[
                    payment.receivedAmount,
                    payment.voidedAmount,
                    payment.refundedAmount,
                    payment.netAmount,
                  ].map((value, index) => (
                    <td key={index}>{cashMoney(value, currency)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data.paymentMethods.length && (
          <p>No hay medios registrados en este turno.</p>
        )}
      </section>
    </div>
  );
}

export function CashMovements({
  rows,
  currency,
  timeZone,
}: {
  rows: CashMovement[];
  currency: string;
  timeZone: string;
}) {
  return (
    <div>
      {!rows.length && <p>No hay movimientos en este turno.</p>}

      {rows.map((row) => (
        <article className="cash-movement" key={row.id}>
          <div>
            <strong>{movementLabels[row.movementType]}</strong>
            <p>{row.reason}</p>

            <small>
              {row.recordedBy.fullName} ·{" "}
              {cashDate(row.occurredAt, timeZone)}
            </small>

            {row.reference && <p>Referencia: {row.reference}</p>}

            {row.sourceType && (
              <p>
                {row.sourceType} · #{row.sourceId ?? "—"}
              </p>
            )}

            <small className="cash-badge">
              {["MANUAL_INCOME", "WITHDRAWAL", "EXPENSE"].includes(
                row.movementType
              )
                ? "Manual · Solo lectura"
                : "Automático · Solo lectura"}
            </small>
          </div>

          <strong
            className={
              row.direction === "IN"
                ? "cash-positive"
                : "cash-negative"
            }
          >
            {row.direction === "IN" ? "+" : "−"}
            {cashMoney(row.amount, currency)}
          </strong>
        </article>
      ))}
    </div>
  );
}

export function CashCount({
  session: s,
  timeZone,
}: {
  session: CashSession;
  timeZone: string;
}) {
  if (s.status !== "CLOSED") {
    return (
      <p>
        El arqueo definitivo estará disponible al cerrar el turno.
      </p>
    );
  }

  return (
    <div className="cash-columns">
      <CashTotals
        currency={s.currencyCode}
        rows={[
          ["Efectivo esperado al cerrar", s.expectedCashAmount],
          ["Efectivo contado", s.countedCashAmount],
          ["Diferencia", s.differenceAmount],
        ]}
      />

      <dl className="cash-metadata">
        <div>
          <dt>Cerrado por</dt>
          <dd>{s.closedBy?.fullName ?? "—"}</dd>
        </div>
        <div>
          <dt>Cierre</dt>
          <dd>{cashDate(s.closedAt, timeZone)}</dd>
        </div>
        <div>
          <dt>Observaciones</dt>
          <dd>{s.closingNotes || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
