import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { ApiError } from "../../../lib/http/client";

import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";

import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashCents, cashMoney } from "../../cash/utils/cash-format";
import { LockKeyhole, Plus } from "lucide-react";
import { PreorderPaymentFields } from "./PreorderPaymentFields";
import {
  calculateCheckout,
  newPayment,
} from "../utils/checkout-calculation";

import type { Order } from "../schemas/sales.schema";
import type { SalesResource } from "../hooks/useSales";

import { getOrder, type SalesScope } from "../services/sales.service";

import {
  readPreorderPayment,
  readPreorderPaymentOptions,
  writePreorderPayment,
} from "../services/preorder-payments.service";

import "../checkout.css";

export function PreorderPaymentDialog({
  mode,
  order,
  scope,
  resource,
  onClose: close,
}: {
  mode: "pay" | "refund";
  order: Order;
  scope: SalesScope;
  resource: Pick<SalesResource, "busy" | "paymentOperation">;
  onClose: () => void;
}) {
  const { session } = useAppShell();
  const id = useId();

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [options, batch] = await Promise.all([
        readPreorderPaymentOptions(
          session,
          scope,
          signal,
          mode === "pay"
        ),
        mode === "refund"
          ? readPreorderPayment(session, order.id, signal)
          : null,
      ]);

      return { ...options, batch };
    },
    [session, scope, mode, order.id]
  );

  const result = useCashResource(load);

  const [payments, setPayments] = useState(() => [
    {
      ...newPayment(),
      amount: order.total ?? "",
    },
  ]);

  const [observations, setObservations] = useState("");

  const [refundNotes, setRefundNotes] = useState<
    Record<string, string>
  >({});

  const [confirmedRefund, setConfirmedRefund] = useState(false);

  const [cashSessionId, setCashSessionId] = useState("");

  const [reason, setReason] = useState("");

  const [references, setReferences] = useState<
    Record<string, string>
  >({});

  const [error, setErrorState] = useState("");
  const [intent, setIntentState] = useState<{
    body: unknown;
    total: string;
  } | null>(null);

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  function setError(value: string) {
    if (mounted.current) {
      setErrorState(value);
    }
  }

  function setIntent(value: typeof intent) {
    if (mounted.current) {
      setIntentState(value);
    }
  }

  function onClose() {
    if (mounted.current) {
      close();
    }
  }

  const lock = useRef(false);
  const data = result.data;

  const preview = calculateCheckout(
    payments.map((payment) => ({
      ...payment,
      notes: observations,
    })),
    data?.methods ?? [],
    order.total ?? "0"
  );

  const cashRequired =
    mode === "pay" ||
    !!data?.batch?.payments.some((payment) => payment.affectsCash);

  const frozen = resource.busy || !!intent;

  async function check() {
    if (lock.current || resource.busy) return;

    lock.current = true;

    try {
      await resource.paymentOperation(async () => {
        try {
          const current = await getOrder(
            session.accessToken,
            order.id,
            scope
          );

          const complete =
            mode === "pay"
              ? ["VERIFIED", "CONSUMED"].includes(
                  current.paymentStatus ?? ""
                )
              : current.paymentStatus === "REFUNDED";

          if (complete) {
            setIntent(null);
            onClose();

            return mode === "pay"
              ? "Pago verificado."
              : "Pago devuelto.";
          }

          if (
            mode === "refund" &&
            current.paymentStatus === "VERIFIED"
          ) {
            const batch = await readPreorderPayment(
              session,
              order.id,
              new AbortController().signal
            );

            if (batch?.status === "VERIFIED") {
              setIntent(null);
            }
          }

          setError(
            "La operación todavía no figura aplicada. Revisa el estado antes de volver a intentarla."
          );

          return "Estado del pago consultado.";
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo consultar el pago."
          );

          return "No se pudo verificar la operación.";
        }
      });
    } finally {
      lock.current = false;
    }
  }

  async function submit() {
    if (!data || lock.current || resource.busy || !order.total) {
      return;
    }

    let attempt = intent;

    if (!attempt) {
      if (
        cashRequired &&
        !data.sessions.some((row) => row.id === cashSessionId)
      ) {
        setError("Selecciona un turno abierto de esta ubicación.");

        return;
      }

      if (mode === "pay") {
        if (!preview.valid) {
          setError(preview.error);
          return;
        }

        attempt = {
          total: order.total,
          body: {
            cashSessionId,
            idempotencyKey: crypto.randomUUID(),
            payments: preview.payments,
          },
        };
      } else {
        if (
          !data.batch ||
          data.batch.status !== "VERIFIED" ||
          !data.batch.payments.length
        ) {
          setError(
            "No se encontró un pago verificado para devolver."
          );

          return;
        }

        if (!confirmedRefund) {
          setError(
            "Confirma que verificaste los medios y valores que serán devueltos."
          );
          return;
        }

        if (reason.trim().length < 5 || reason.trim().length > 500) {
          setError("El motivo debe tener entre 5 y 500 caracteres.");

          return;
        }

        if (
          data.batch.payments.some(
            (payment) =>
              payment.requiresReference &&
              !references[payment.id]?.trim()
          )
        ) {
          setError(
            "Completa las referencias obligatorias de devolución."
          );

          return;
        }

        attempt = {
          total: order.total,
          body: {
            ...(cashRequired ? { cashSessionId } : {}),
            reason: reason.trim(),
            payments: data.batch.payments.map((payment) => ({
              orderPaymentId: payment.id,
              reference: references[payment.id]?.trim() || null,
              notes: refundNotes[payment.id]?.trim() || null,
            })),
          },
        };
      }

      setIntent(attempt);
    }

    const pending = attempt;

    lock.current = true;
    setError("");

    try {
      await resource.paymentOperation(async () => {
        try {
          const current = await getOrder(
            session.accessToken,
            order.id,
            scope
          );

          const alreadyDone =
            mode === "pay"
              ? ["VERIFIED", "CONSUMED"].includes(
                  current.paymentStatus ?? ""
                )
              : current.paymentStatus === "REFUNDED";

          if (!alreadyDone) {
            if (
              !current.total ||
              cashCents(current.total) !== cashCents(pending.total)
            ) {
              setIntent(null);

              throw new Error(
                "El total cambió. Revisa la orden y los valores antes de pagar."
              );
            }

            await writePreorderPayment(
              session,
              scope,
              order.id,
              mode,
              pending.body
            );

            const updated = await getOrder(
              session.accessToken,
              order.id,
              scope
            );

            if (
              mode === "refund"
                ? updated.paymentStatus !== "REFUNDED"
                : !["VERIFIED", "CONSUMED"].includes(
                    updated.paymentStatus ?? ""
                  )
            ) {
              throw new Error(
                "La operación fue recibida. Falta verificar el estado actualizado del pago."
              );
            }
          }

          setIntent(null);
          onClose();

          return mode === "pay"
            ? "Pago verificado."
            : "Pago devuelto.";
        } catch (cause) {
          if (
            cause instanceof ApiError &&
            cause.code === "ORDER_ALREADY_PAID"
          ) {
            try {
              const current = await getOrder(
                session.accessToken,
                order.id,
                scope
              );

              if (
                ["VERIFIED", "CONSUMED"].includes(
                  current.paymentStatus ?? ""
                )
              ) {
                setIntent(null);
                onClose();

                return "El pago ya estaba registrado. Orden actualizada.";
              }
            } catch {
              // Conserva la intención hasta consultar el resultado.
            }
          }

          const uncertain =
            !(cause instanceof ApiError) ||
            cause.status === 0 ||
            cause.status >= 500 ||
            [
              "ORDER_ALREADY_PAID",
              "IDEMPOTENCY_KEY_CONFLICT",
            ].includes(cause.code);

          if (!uncertain) {
            setIntent(null);
          }

          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo completar la operación."
          );

          return "Revisa el resultado del pago antes de continuar.";
        }
      });
    } finally {
      lock.current = false;
    }
  }

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      className="preorder-dialog pp-operation-dialog"
      title={
        mode === "pay"
          ? "Registrar y verificar pago"
          : "Devolver pago anticipado"
      }
      busy={frozen}
      onClose={onClose}
    >
      <div className="pp-content">
        <p className="pp-subtitle">
          Orden #{order.id} ·{" "}
          {mode === "pay"
            ? "El pago debe cubrir el total completo."
            : "Devolución completa"}
        </p>

        {result.loading && (
          <p role="status">Consultando medios de pago y turnos…</p>
        )}

        {result.error && (
          <div role="alert">
            <p>{result.error}</p>

            <Button variant="secondary" onClick={result.reload}>
              Reintentar consulta
            </Button>
          </div>
        )}

        {data && (
          <>
            {mode === "refund" && (
              <p className="pp-warning">
                <LockKeyhole size={16} aria-hidden="true" />
                Después de devolver el pago, la orden no podrá
                editarse y deberá cancelarse completamente.
              </p>
            )}

            <div className={mode === "pay" ? "pp-grid" : "pp-stack"}>
              <div className="pp-total">
                <small>
                  {mode === "pay"
                    ? "Total de la orden"
                    : "Total que se devolverá"}
                </small>

                <strong>
                  {cashMoney(
                    mode === "refund"
                      ? (data.batch?.paidTotal ?? null)
                      : (order.total ?? null),
                    "COP"
                  )}
                </strong>
              </div>

              {cashRequired && (
                <SelectField
                  label={
                    mode === "pay"
                      ? "Turno de caja"
                      : "Turno de caja para el efectivo"
                  }
                  value={cashSessionId}
                  required
                  disabled={frozen}
                  options={data.sessions.map((row) => ({
                    value: row.id,
                    label:
                      row.cashRegister.name +
                      " · Turno #" +
                      row.id +
                      (mode === "refund" &&
                      row.expectedCashAmount !== null
                        ? " · efectivo esperado " +
                          cashMoney(
                            row.expectedCashAmount,
                            row.currencyCode
                          )
                        : ""),
                  }))}
                  onValueChange={setCashSessionId}
                  placeholder="Selecciona un turno"
                />
              )}
            </div>

            {cashRequired && !data.sessions.length && (
              <p role="alert">
                Necesitas un turno abierto accesible en esta
                ubicación.
              </p>
            )}

            {mode === "pay" ? (
              <>
                {payments.map((payment, index) => (
                  <PreorderPaymentFields
                    key={payment.key}
                    payment={payment}
                    index={index}
                    methods={data.methods.filter(
                      (method) => method.isActive
                    )}
                    disabled={frozen}
                    removable={payments.length > 1}
                    onChange={(next) =>
                      setPayments((rows) =>
                        rows.map((row) =>
                          row.key === next.key ? next : row
                        )
                      )
                    }
                    onRemove={() =>
                      setPayments((rows) =>
                        rows.filter((row) => row.key !== payment.key)
                      )
                    }
                  />
                ))}

                <Button
                  variant="soft"
                  size="compact"
                  disabled={frozen || payments.length >= 20}
                  onClick={() =>
                    setPayments((rows) => [...rows, newPayment()])
                  }
                >
                  <Plus size={16} aria-hidden="true" />
                  Agregar otra forma de pago
                </Button>

                <label className="sales-label">
                  Observaciones (opcional)
                  <textarea
                    rows={2}
                    maxLength={500}
                    disabled={frozen}
                    value={observations}
                    onChange={(event) =>
                      setObservations(event.target.value)
                    }
                  />
                </label>
              </>
            ) : (
              <>
                {!data.batch && (
                  <p role="alert">
                    No hay un lote de pago disponible.
                  </p>
                )}

                {data.batch?.payments.map((payment) => {
                  const required = payment.requiresReference;

                  return (
                    <section className="pp-payment" key={payment.id}>
                      <div className="pp-line">
                        <strong>{payment.paymentMethodName}</strong>

                        <strong>
                          {cashMoney(payment.amount, "COP")}
                        </strong>
                      </div>

                      {required && (
                        <TextField
                          label="Referencia de devolución"
                          required
                          disabled={frozen}
                          maxLength={120}
                          value={references[payment.id] ?? ""}
                          onChange={(event) =>
                            setReferences((current) => ({
                              ...current,
                              [payment.id]: event.target.value,
                            }))
                          }
                        />
                      )}

                      <TextField
                        label="Observaciones (opcional)"
                        disabled={frozen}
                        maxLength={500}
                        value={refundNotes[payment.id] ?? ""}
                        onChange={(event) =>
                          setRefundNotes((current) => ({
                            ...current,
                            [payment.id]: event.target.value,
                          }))
                        }
                      />
                    </section>
                  );
                })}

                <label className="sales-label">
                  Motivo general *
                  <textarea
                    rows={2}
                    required
                    minLength={5}
                    maxLength={500}
                    disabled={frozen}
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                  />
                </label>

                <label className="pp-check">
                  <input
                    type="checkbox"
                    disabled={frozen}
                    checked={confirmedRefund}
                    onChange={(event) =>
                      setConfirmedRefund(event.target.checked)
                    }
                  />

                  <span>
                    He verificado los medios y valores que serán
                    devueltos.
                  </span>
                </label>
              </>
            )}
          </>
        )}

        {error && (
          <p className="pp-error" role="alert">
            {error}
          </p>
        )}

        {intent && !resource.busy && (
          <p role="status">
            Hay una operación por verificar. Conservamos sus datos
            para evitar duplicados.
          </p>
        )}
      </div>

      <footer className="pp-footer">
        {mode === "pay" && data && (
          <dl className="pp-summary" aria-live="polite">
            <div>
              <dt>Total distribuido</dt>
              <dd>{cashMoney(preview.paid, "COP")}</dd>
            </div>

            <div>
              <dt>
                {preview.remaining < 0n
                  ? "Exceso aplicado"
                  : "Saldo pendiente"}
              </dt>

              <dd>
                {cashMoney(
                  preview.remaining < 0n
                    ? -preview.remaining
                    : preview.remaining,
                  "COP"
                )}
              </dd>
            </div>

            <div>
              <dt>Cambio</dt>
              <dd>{cashMoney(preview.change, "COP")}</dd>
            </div>
          </dl>
        )}

        <div className="sales-form-actions">
          <Button
            variant="secondary"
            disabled={frozen}
            onClick={onClose}
          >
            {mode === "pay" ? "Cancelar" : "Volver"}
          </Button>

          {intent && (
            <Button
              variant="secondary"
              disabled={resource.busy}
              onClick={() => void check()}
            >
              Consultar resultado
            </Button>
          )}

          <Button
            variant={mode === "refund" ? "danger" : "primary"}
            loading={resource.busy}
            disabled={
              !data ||
              !order.total ||
              (mode === "refund" && (!!intent || !confirmedRefund))
            }
            onClick={() => void submit()}
          >
            {intent
              ? "Reintentar el mismo pago"
              : mode === "pay"
                ? "Confirmar pago"
                : "Devolver pago completo"}
          </Button>
        </div>
      </footer>
    </BottomSheet>
  );
}
