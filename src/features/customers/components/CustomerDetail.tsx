import { useCallback, useState } from "react";

import {
  Archive,
  ArchiveRestore,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";

import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";

import { hasPermission } from "../../auth/utils/permissions";

import {
  useRemote,
  useMutation,
} from "../../sales/hooks/usePublicOrders";

import { Notice } from "../../reports/components/ReportUI";

import { amount, dateTime } from "../utils/customers.format";

import {
  channel,
  type CustomerChange,
} from "../schemas/customers.schema";

import {
  getCustomer,
  customerKey,
  changeCustomer,
  refreshCustomer,
} from "../services/customers.service";

import { CustomerHistory } from "./CustomerHistory";

export function CustomerDetail({
  id,
  currency,
  timezone,
  onClose,
}: {
  id: string;
  currency: string | null;
  timezone: string | null;
  onClose: () => void;
}) {
  const { session } = useAppShell();

  const load = useCallback(
    (signal: AbortSignal) => getCustomer(session, id, signal),
    [session, id]
  );

  const resource = useRemote(load, {
    token: session.accessToken,
    keys: [customerKey(id)],
  });

  const mutation = useMutation();

  const [change, setChange] = useState<CustomerChange | null>(null);

  const [notice, setNotice] = useState("");

  const row = resource.data;
  const canManage = hasPermission(session, "customers.manage");

  const date = (value: string | null) =>
    value ? dateTime(value, timezone) : "—";

  const title = !change
    ? ""
    : change.kind === "status"
      ? change.value
        ? "¿Reactivar este cliente?"
        : "¿Archivar este cliente?"
      : change.value
        ? "Registrar autorización comercial"
        : "Retirar autorización comercial";

  const confirmLabel = !change
    ? ""
    : change.kind === "status"
      ? change.value
        ? "Reactivar cliente"
        : "Archivar cliente"
      : change.value
        ? "Confirmar autorización"
        : "Retirar autorización";

  return (
    <>
      <BottomSheet
        id={"customer-" + id}
        open
        variant="modal"
        className="cc-dialog"
        title={row?.legalName || "Detalle del cliente"}
        busy={mutation.busy}
        onClose={onClose}
      >
        <div className="cc-scroll">
          {resource.loading && (
            <LoadingState message="Consultando cliente…" />
          )}

          {resource.error && (
            <Alert>
              {resource.error}
              <Button onClick={resource.reload}>Reintentar</Button>
            </Alert>
          )}

          {notice && <p role="status">{notice}</p>}

          {row && (
            <>
              <div className="cc-line">
                <span
                  className="cc-badge"
                  data-tone={row.isActive ? "good" : "warn"}
                >
                  {row.isActive ? "Activo" : "Archivado"}
                </span>

                <span className="cc-muted">Cliente #{row.id}</span>
              </div>

              {!row.isActive && (
                <Notice>
                  Este cliente está archivado. Su historial y
                  consentimiento continúan disponibles.
                </Notice>
              )}

              <dl className="cc-info">
                {[
                  ["Teléfono original", row.billingPhone || "—"],
                  [
                    "Teléfono normalizado",
                    row.normalizedPhone || "—",
                  ],
                  ["Correo", row.billingEmail || "—"],
                  [
                    "Primer canal de adquisición",
                    channel(row.acquisitionSourceChannel),
                  ],
                  [
                    "Último canal utilizado",
                    channel(row.lastSourceChannel),
                  ],
                  ["Primera interacción", date(row.firstSeenAt)],
                  ["Última interacción", date(row.lastSeenAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>

              <section className="cc-stack">
                <h3>Resumen comercial</h3>

                <dl className="cc-info">
                  <div>
                    <dt>Pedidos</dt>
                    <dd>{row.orderCount}</dd>
                  </div>

                  <div>
                    <dt>Ventas</dt>
                    <dd>{row.saleCount}</dd>
                  </div>

                  <div>
                    <dt>Primera compra</dt>
                    <dd>{date(row.firstPurchaseAt)}</dd>
                  </div>

                  <div>
                    <dt>Última compra</dt>
                    <dd>{date(row.lastPurchaseAt)}</dd>
                  </div>
                </dl>

                <dl className="cc-amounts">
                  <div>
                    <dt>Total vendido antes de devoluciones</dt>
                    <dd>{amount(row.grossSalesTotal, currency)}</dd>
                  </div>

                  <div>
                    <dt>Total devuelto</dt>
                    <dd>{amount(row.refundedTotal, currency)}</dd>
                  </div>

                  <div>
                    <dt>Compra efectiva</dt>
                    <dd>
                      {amount(row.effectiveSalesTotal, currency)}
                    </dd>
                  </div>
                </dl>

                <p className="cc-muted">
                  Compra efectiva: ventas no anuladas menos
                  devoluciones.
                </p>
              </section>

              <section className="cc-card cc-stack">
                <div className="cc-line">
                  <h3>Comunicaciones comerciales</h3>

                  <span
                    className="cc-badge"
                    data-tone={
                      row.marketingConsent ? "good" : "neutral"
                    }
                  >
                    {row.marketingConsent
                      ? "Autorizado"
                      : "No autorizado"}
                  </span>
                </div>

                <p className="cc-muted">
                  El teléfono usado para atender pedidos no constituye
                  autorización para enviar publicidad.
                </p>

                {row.marketingConsent && row.marketingConsentAt && (
                  <p>Autorizado el {date(row.marketingConsentAt)}.</p>
                )}

                {canManage ? (
                  <Button
                    variant="soft"
                    disabled={mutation.busy}
                    onClick={() => {
                      setNotice("");
                      setChange({
                        kind: "marketing-consent",
                        value: !row.marketingConsent,
                      });
                    }}
                  >
                    {row.marketingConsent ? (
                      <ShieldOff size={16} />
                    ) : (
                      <ShieldCheck size={16} />
                    )}

                    {row.marketingConsent
                      ? "Retirar autorización"
                      : "Registrar autorización"}
                  </Button>
                ) : (
                  <small className="cc-muted">
                    Solo consulta. No tienes permiso para modificar el
                    consentimiento.
                  </small>
                )}
              </section>

              <CustomerHistory
                id={id}
                currency={currency}
                timezone={timezone}
              />
            </>
          )}
        </div>

        <footer className="cc-footer">
          <Button
            variant="soft"
            disabled={mutation.busy}
            onClick={onClose}
          >
            Volver al listado
          </Button>

          {row && canManage && (
            <Button
              variant="soft"
              disabled={mutation.busy}
              onClick={() => {
                setNotice("");
                setChange({
                  kind: "status",
                  value: !row.isActive,
                });
              }}
            >
              {row.isActive ? (
                <Archive size={16} />
              ) : (
                <ArchiveRestore size={16} />
              )}

              {row.isActive
                ? "Archivar cliente"
                : "Reactivar cliente"}
            </Button>
          )}
        </footer>
      </BottomSheet>

      {change && (
        <BottomSheet
          id={"customer-confirm-" + id}
          open
          variant="modal"
          className="cc-dialog cc-confirm"
          title={title}
          busy={mutation.busy}
          onClose={() => setChange(null)}
        >
          <div className="cc-scroll cc-stack">
            <p>
              {change.kind === "status"
                ? change.value
                  ? "El cliente volverá a aparecer como activo. Su historial y consentimiento se conservan."
                  : "Archivar no elimina al cliente ni sus pedidos o ventas. Su consentimiento comercial no cambia."
                : change.value
                  ? "Confirma que el cliente autorizó expresamente el envío de comunicaciones comerciales. El historial de pedidos y ventas se conserva."
                  : "Se retirará la autorización para comunicaciones comerciales. El historial de pedidos y ventas se conserva."}
            </p>

            {mutation.error && <Alert>{mutation.error}</Alert>}
          </div>

          <footer className="cc-footer">
            <Button
              variant="soft"
              disabled={mutation.busy}
              onClick={() => setChange(null)}
            >
              Cancelar
            </Button>

            <Button
              variant={change.value ? "primary" : "danger"}
              loading={mutation.busy}
              disabled={!canManage || resource.loading || !row}
              onClick={() =>
                void mutation.run(
                  (signal) =>
                    changeCustomer(session, id, change, signal),
                  () => {
                    setChange(null);
                    setNotice("Cliente actualizado.");
                  },
                  () => refreshCustomer(session, id)
                )
              }
            >
              {confirmLabel}
            </Button>
          </footer>
        </BottomSheet>
      )}
    </>
  );
}
