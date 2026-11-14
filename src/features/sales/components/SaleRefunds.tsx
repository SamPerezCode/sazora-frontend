import { useCallback, useState } from "react";
import { Link } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashDate } from "../../cash/utils/cash-format";

import type { Refund } from "../schemas/refund.schema";
import { getRefund } from "../services/refund.service";
import { refundMoney } from "../utils/refund-calculation";

import "../refund.css";

export function SaleRefunds({
  saleId,
  rows,
  currency,
}: {
  saleId: string;
  rows: Refund[] | null;
  currency: string;
}) {
  const { settings } = useAppShell();
  const [selected, setSelected] = useState<string | null>(null);
  const zone = settings.data?.timezone ?? "America/Bogota";

  return (
    <section className="por-stack">
      <h3>Devoluciones</h3>

      {rows === null ? (
        <p>No tienes permiso para consultar las devoluciones.</p>
      ) : !rows.length ? (
        <p>No hay devoluciones registradas.</p>
      ) : (
        rows.map((row) => (
          <article className="refund-history-row" key={row.id}>
            <div>
              <strong>
                Devolución #{row.id} ·{" "}
                {row.refundKind === "FULL" ? "Total" : "Parcial"}
              </strong>

              <small>
                {row.reason} · {row.processedBy.fullName} ·{" "}
                {cashDate(row.refundedAt, zone)}
              </small>
            </div>

            <strong>{refundMoney(row.totalAmount, currency)}</strong>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelected(row.id)}
            >
              Ver devolución
            </Button>
          </article>
        ))
      )}

      {selected && (
        <RefundDetail
          saleId={saleId}
          refundId={selected}
          currency={currency}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function RefundDetail({
  saleId,
  refundId,
  currency,
  onClose,
}: {
  saleId: string;
  refundId: string;
  currency: string;
  onClose: () => void;
}) {
  const { session, settings } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) =>
      getRefund(session, saleId, refundId, signal),
    [session, saleId, refundId]
  );

  const resource = useCashResource(loader);
  const row = resource.data;

  return (
    <BottomSheet
      id="refund-detail"
      open
      variant="modal"
      className="refund-dialog"
      title={"Devolución #" + refundId}
      onClose={onClose}
    >
      <div className="refund-body">
        {resource.loading && (
          <p role="status">Consultando devolución…</p>
        )}

        {resource.error && (
          <>
            <p role="alert">{resource.error}</p>
            <Button onClick={resource.reload}>Reintentar</Button>
          </>
        )}

        {row && (
          <>
            <p>
              {row.refundKind === "FULL"
                ? "Devolución total"
                : "Devolución parcial"}
            </p>

            <dl className="refund-metadata">
              <div>
                <dt>Motivo</dt>
                <dd>{row.reason}</dd>
              </div>
              <div>
                <dt>Usuario</dt>
                <dd>{row.processedBy.fullName}</dd>
              </div>
              <div>
                <dt>Turno</dt>
                <dd>#{row.cashSessionId}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {cashDate(
                    row.refundedAt,
                    settings.data?.timezone ?? "America/Bogota"
                  )}
                </dd>
              </div>
            </dl>

            <dl className="refund-totals">
              {(
                [
                  ["Neto", row.netAmount],
                  ["Impuesto", row.taxAmount],
                  ["Total", row.totalAmount],
                  ["Costo", row.costAmount],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{refundMoney(value, currency)}</dd>
                </div>
              ))}
            </dl>

            <h3>Productos e inventario</h3>

            {row.items.map((item) => (
              <p key={item.id}>
                {item.quantity} × {item.productName} ·{" "}
                {item.inventoryMovementId
                  ? "Restaurado · Movimiento #" +
                    item.inventoryMovementId
                  : item.restoreInventory
                    ? "Restauración solicitada · Sin movimiento registrado"
                    : "Sin restauración"}
              </p>
            ))}

            <h3>Dinero devuelto por pago original</h3>

            {row.payments.map((payment) => (
              <div key={payment.id}>
                <p>
                  {payment.paymentMethodName} ·{" "}
                  {refundMoney(payment.amount, currency)} · Ref.{" "}
                  {payment.reference ?? "—"}
                </p>

                {payment.notes && <small>{payment.notes}</small>}

                {payment.cashMovementId && (
                  <small>
                    Movimiento de caja #{payment.cashMovementId}
                  </small>
                )}
              </div>
            ))}

            {hasPermission(session, "cash.sessions.read") && (
              <Link
                className="por-link"
                to={"/cajas?turno=" + row.cashSessionId}
                onClick={onClose}
              >
                Consultar turno del reembolso
              </Link>
            )}
          </>
        )}
      </div>

      <footer className="refund-footer">
        <Button onClick={onClose}>Cerrar</Button>
      </footer>
    </BottomSheet>
  );
}
