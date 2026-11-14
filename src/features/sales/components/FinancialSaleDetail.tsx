import { useCallback, useState } from "react";
import { Ban } from "lucide-react";
import { VoidSaleDialog } from "./VoidSaleDialog";
import { Link } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import {
  hasEveryPermission,
  hasPermission,
} from "../../auth/utils/permissions";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashDate, cashMoney } from "../../cash/utils/cash-format";

import { saleLabels } from "../schemas/financial-sales.schema";
import { getFinancialSaleOverview } from "../services/financial-sales.service";
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
    (signal: AbortSignal) =>
      getFinancialSaleOverview(session, id, signal),
    [session, id]
  );

  const resource = useCashResource(loader);
  const row = resource.data;

  const [voidTarget, setVoidTarget] = useState<{
    id: string;
    locationId: string;
  } | null>(null);

  const [notice, setNotice] = useState("");

  const canVoid = hasEveryPermission(session, [
    "sales.void",
    "cash.sessions.read",
  ]);

  function onVoided() {
    setVoidTarget(null);
    setNotice("Venta anulada.");
    resource.reload();
  }

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

      {notice && (
        <p className="fh-success" role="status">
          {notice}
        </p>
      )}

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

            <div className="fh-sale-actions">
              <span className="por-badge" data-status={row.status}>
                {saleLabels[row.status]}
              </span>

              {canVoid && row.status === "COMPLETED" && (
                <Button
                  variant="secondary"
                  className="fh-void-button"
                  onClick={() => {
                    setNotice("");
                    setVoidTarget({
                      id: row.id,
                      locationId: row.locationId,
                    });
                  }}
                >
                  <Ban size={16} aria-hidden="true" />
                  Anular venta
                </Button>
              )}
            </div>
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
              <h3>Totales financieros</h3>

              <dl className="fh-totals">
                {(
                  [
                    ["Neto", row.netSubtotal],
                    ["Impuestos", row.taxTotal],
                    ["Descuentos", row.discountTotal],
                    ["Propina", row.tipTotal],
                    ["Total original", row.total],
                    [
                      "Total devuelto",
                      row.summary.refundedTotalAmount,
                    ],
                    ["Total anulado", row.summary.voidedAmount],
                    [
                      "Total vigente de la venta",
                      row.summary.effectiveTotalAmount,
                    ],
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
            <section className="fh-void-record">
              <h3>Anulación</h3>

              <dl className="por-details">
                <div>
                  <dt>Motivo</dt>
                  <dd>{row.voidReason ?? "Sin motivo informado"}</dd>
                </div>

                <div>
                  <dt>Usuario</dt>
                  <dd>
                    {row.summary.voidedBy?.fullName ?? "No informado"}
                  </dd>
                </div>

                <div>
                  <dt>Fecha</dt>
                  <dd>{cashDate(row.voidedAt, zone)}</dd>
                </div>
              </dl>
            </section>
          )}
        </>
      )}
      {voidTarget && canVoid && (
        <VoidSaleDialog
          saleId={voidTarget.id}
          locationId={voidTarget.locationId}
          onClose={() => {
            setVoidTarget(null);
            resource.reload();
          }}
          onVoided={onVoided}
        />
      )}
    </section>
  );
}
