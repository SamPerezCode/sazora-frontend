import { useCallback, useId, useState } from "react";
import { Link } from "react-router";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashMoney } from "../../cash/utils/cash-format";
import { saleLabels } from "../schemas/financial-sales.schema";
import { voidSaleInput } from "../schemas/void-sale.schema";
import {
  readVoidOptions,
  voidCashAmount,
  type VoidOptions,
} from "../services/void-sale.service";
import { useVoidSale } from "../hooks/useVoidSale";
import "../void-sale.css";

type Props = {
  saleId: string;
  locationId: string;
  onClose: () => void;
  onVoided: () => void;
};

export function VoidSaleDialog(props: Props) {
  const { session } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) =>
      readVoidOptions(
        session,
        props.saleId,
        props.locationId,
        signal
      ),
    [session, props.saleId, props.locationId]
  );

  const resource = useCashResource(loader);

  if (resource.data) {
    return (
      <VoidSaleForm
        {...props}
        data={resource.data}
        reload={resource.reload}
      />
    );
  }

  return (
    <BottomSheet
      id="void-sale-loading"
      open
      variant="modal"
      className="void-dialog"
      title={"Anular venta #" + props.saleId}
      onClose={props.onClose}
    >
      <div className="void-body">
        {resource.loading && (
          <p role="status">Consultando venta y turnos abiertos…</p>
        )}

        {resource.error && (
          <>
            <p role="alert" className="void-error">
              {resource.error}
            </p>
            <Button variant="secondary" onClick={resource.reload}>
              Reintentar consulta
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function VoidSaleForm({
  data,
  reload,
  onClose,
  onVoided,
}: Props & {
  data: VoidOptions;
  reload: () => void;
}) {
  const { session } = useAppShell();
  const reasonId = useId();

  const [cashSessionId, setCashSessionId] = useState(
    data.sessions.length === 1 ? data.sessions[0].id : ""
  );

  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);

  const mutation = useVoidSale(session, data, onVoided);
  const sale = data.sale;

  const parsed = voidSaleInput.safeParse({
    cashSessionId,
    reason,
  });

  const blocked =
    mutation.busy || mutation.review || sale.status !== "COMPLETED";

  const canSubmit =
    !blocked &&
    accepted &&
    parsed.success &&
    data.sessions.some((row) => row.id === cashSessionId);

  return (
    <BottomSheet
      id="void-sale"
      open
      variant="modal"
      className="void-dialog"
      title={"Anular venta #" + sale.id}
      busy={mutation.busy}
      onClose={onClose}
    >
      <p className="void-subtitle">Reversión total de la venta</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (canSubmit && parsed.success) {
            void mutation.confirm(parsed.data);
          }
        }}
      >
        <div className="void-body">
          <dl className="void-totals">
            <div>
              <dt>Total a revertir</dt>
              <dd>{cashMoney(sale.total, sale.currencyCode)}</dd>
            </div>
            <div>
              <dt>Efectivo que saldrá de caja</dt>
              <dd>
                {cashMoney(voidCashAmount(sale), sale.currencyCode)}
              </dd>
            </div>
          </dl>

          <div className="void-payments">
            {sale.payments.map((payment) => (
              <p key={payment.id}>
                {payment.paymentMethodName} ·{" "}
                {cashMoney(payment.amount, sale.currencyCode)}
              </p>
            ))}
          </div>

          {sale.status !== "COMPLETED" && (
            <div role="alert" className="void-error">
              <p>
                Esta venta está{" "}
                {saleLabels[sale.status].toLowerCase()} y no puede
                anularse.
              </p>

              {sale.status === "VOIDED" && (
                <Button variant="secondary" onClick={onVoided}>
                  Ver venta anulada
                </Button>
              )}
            </div>
          )}

          {!data.sessions.length && (
            <div role="alert" className="void-error">
              <p>No hay turnos abiertos en esta ubicación.</p>

              {hasPermission(session, "cash.sessions.open") && (
                <Link to="/cajas" onClick={onClose}>
                  Ir a Cajas y turnos
                </Link>
              )}

              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={reload}
              >
                Consultar turnos nuevamente
              </Button>
            </div>
          )}

          <fieldset disabled={blocked}>
            <SelectField
              label="Turno abierto de esta ubicación"
              placeholder="Seleccionar turno"
              value={cashSessionId}
              disabled={blocked}
              options={data.sessions.map((row) => ({
                value: row.id,
                label: "#" + row.id + " · " + row.cashRegister.name,
              }))}
              onValueChange={setCashSessionId}
            />

            <div className="void-reason">
              <label htmlFor={reasonId}>
                Motivo obligatorio (mínimo 5 caracteres)
              </label>

              <textarea
                id={reasonId}
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-describedby={reasonId + "-help"}
              />

              {reason.length > 0 && reason.trim().length < 5 && (
                <small id={reasonId + "-help"} className="void-error">
                  Escribe al menos 5 caracteres sin contar espacios al
                  inicio y al final.
                </small>
              )}
            </div>

            <p className="void-note">
              La anulación revierte los movimientos de inventario de
              esta venta y registra la salida de efectivo indicada en
              el turno seleccionado.
            </p>

            <label className="void-confirm">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) =>
                  setAccepted(event.target.checked)
                }
              />
              <span>Confirmo la anulación total de esta venta.</span>
            </label>
          </fieldset>

          {mutation.error && (
            <p role="alert" className="void-error">
              {mutation.error}
            </p>
          )}

          {mutation.review && (
            <div className="void-actions">
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => void mutation.verify()}
              >
                Verificar anulación
              </Button>

              {!mutation.uncertain && (
                <Button
                  variant="secondary"
                  disabled={mutation.busy}
                  onClick={reload}
                >
                  Revisar venta y turnos
                </Button>
              )}
            </div>
          )}
        </div>

        <footer className="void-footer">
          <Button
            variant="secondary"
            disabled={mutation.busy}
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={!canSubmit}
            loading={mutation.busy}
            loadingText="Procesando…"
          >
            Confirmar anulación
          </Button>
        </footer>
      </form>
    </BottomSheet>
  );
}
