import { useCallback } from "react";
import { Link } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashDate, cashMoney } from "../../cash/utils/cash-format";

import { saleLabels } from "../schemas/financial-sales.schema";
import { getFinancialSale } from "../services/financial-sales.service";

export function FinancialSaleDetail({
  id,
  back,
}: {
  id: string;
  back: () => void;
}) {
  const { session, settings } = useAppShell();
  const zone = settings.data?.timezone ?? "America/Bogota";

  const loader = useCallback(
    (signal: AbortSignal) => getFinancialSale(session, id, signal),
    [session, id]
  );

  const resource = useCashResource(loader);
  const row = resource.data;

  return (
    <section className="por-page fh-page">
      <div className="por-toolbar">
        <Button variant="secondary" onClick={back}>
          Regresar al historial
        </Button>

        <Button
          variant="secondary"
          onClick={resource.reload}
          disabled={resource.loading}
        >
          Actualizar
        </Button>
      </div>

      {resource.loading && <p role="status">Consultando venta…</p>}

      {resource.error && (
        <p role="alert" className="por-error">
          {resource.error}
        </p>
      )}

      {row && (
        <>
          <div className="por-toolbar">
            <h2>Venta #{row.id}</h2>

            <span className="por-badge" data-status={row.status}>
              {saleLabels[row.status]}
            </span>
          </div>

          <div className="fh-columns">
            <section className="por-stack">
              <h3>Información general</h3>

              <dl className="por-details">
                <div>
                  <dt>Orden</dt>
                  <dd>#{row.orderId}</dd>
                </div>
                <div>
                  <dt>Turno</dt>
                  <dd>#{row.cashSessionId}</dd>
                </div>
                <div>
                  <dt>Ubicación</dt>
                  <dd>{row.location.name}</dd>
                </div>
                <div>
                  <dt>Cajero</dt>
                  <dd>{row.soldBy.fullName}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{cashDate(row.soldAt, zone)}</dd>
                </div>
              </dl>

              {hasPermission(session, "cash.sessions.read") && (
                <Link
                  className="por-link"
                  to={"/cajas?turno=" + row.cashSessionId}
                >
                  Consultar turno de caja
                </Link>
              )}
            </section>

            <section>
              <h3>Totales originales</h3>

              <dl className="fh-totals">
                {(
                  [
                    ["Neto", row.netSubtotal],
                    ["Impuestos", row.taxTotal],
                    ["Descuentos", row.discountTotal],
                    ["Propina", row.tipTotal],
                    ["Total original", row.total],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{cashMoney(value, row.currencyCode)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className="por-stack">
            <h3>Productos e impuestos registrados</h3>

            {row.items.map((item) => (
              <article className="fh-line" key={item.id}>
                <div>
                  <strong>
                    {item.quantity} × {item.productName}
                  </strong>

                  <small>
                    {cashMoney(item.unitPrice, row.currencyCode)} /
                    unidad · {item.taxName ?? "Sin impuesto"}
                  </small>
                </div>

                <div>
                  <small>
                    Neto{" "}
                    {cashMoney(item.lineNetTotal, row.currencyCode)} ·
                    Impuesto{" "}
                    {cashMoney(item.lineTaxTotal, row.currencyCode)}
                  </small>

                  <strong>
                    {cashMoney(item.lineTotal, row.currencyCode)}
                  </strong>
                </div>
              </article>
            ))}
          </section>

          <section className="por-stack">
            <h3>Pagos originales</h3>

            {row.payments.map((payment) => (
              <article className="fh-line" key={payment.id}>
                <div>
                  <strong>{payment.paymentMethodName}</strong>

                  <small>
                    {cashDate(payment.paidAt, zone)} ·{" "}
                    {payment.processedBy.fullName}
                  </small>

                  <small>
                    Referencia: {payment.reference ?? "—"}
                  </small>
                </div>

                <dl className="fh-totals">
                  {(
                    [
                      ["Aplicado", payment.amount],
                      ["Entregado", payment.tenderedAmount],
                      ["Cambio", payment.changeAmount],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{cashMoney(value, row.currencyCode)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </section>

          {row.status === "VOIDED" && (
            <section className="por-error">
              <h3>Anulación</h3>
              <p>{row.voidReason ?? "Sin motivo informado"}</p>
              <small>{cashDate(row.voidedAt, zone)}</small>
            </section>
          )}
        </>
      )}
    </section>
  );
}
