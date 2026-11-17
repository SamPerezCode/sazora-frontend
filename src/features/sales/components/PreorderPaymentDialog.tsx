import { useCallback, useId, useRef, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { ApiError } from "../../../lib/http/client";

import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";

import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashMoney } from "../../cash/utils/cash-format";

import { CheckoutPayment } from "./CheckoutPayment";

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
  onClose,
}: {
  mode: "pay" | "refund";
  order: Order;
  scope: SalesScope;
  resource: SalesResource;
  onClose: () => void;
}) {
  const { session } = useAppShell();
  const id = useId();

  const load = useCallback(
    async (signal: AbortSignal) => {
      const [options, batch] = await Promise.all([
        readPreorderPaymentOptions(session, scope, signal),

        mode === "refund"
          ? readPreorderPayment(session, order.id, signal)
          : null,
      ]);

      return { ...options, batch };
    },
    [session, scope, mode, order.id]
  );

  const result = useCashResource(load);

  const [payments, setPayments] = useState(() => [newPayment()]);

  const [cashSessionId, setCashSessionId] = useState("");

  const [reason, setReason] = useState("");

  const [references, setReferences] = useState<
    Record<string, string>
  >({});

  const [error, setError] = useState("");

  const [intent, setIntent] = useState<{
    body: unknown;
    total: string;
  } | null>(null);

  const lock = useRef(false);
  const data = result.data;

  const preview = calculateCheckout(
    payments,
    data?.methods ?? [],
    order.total ?? "0"
  );

  const unknownMethod = data?.batch?.payments.some(
    (payment) =>
      !data.methods.some(
        (method) => method.id === payment.paymentMethodId
      )
  );

  const cashRequired =
    mode === "pay" ||
    !!unknownMethod ||
    !!data?.batch?.payments.some(
      (payment) =>
        data.methods.find(
          (method) => method.id === payment.paymentMethodId
        )?.affectsCash
    );

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

        if (unknownMethod) {
          setError(
            "No se pudo consultar la configuración de todos los medios originales."
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
              data.methods.find(
                (method) => method.id === payment.paymentMethodId
              )?.requiresReference && !references[payment.id]?.trim()
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
              notes: null,
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
            if (current.total !== pending.total) {
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
      className="preorder-dialog"
      title={
        mode === "pay"
          ? "Registrar y verificar pago"
          : "Devolver pago completo"
      }
      busy={frozen}
      onClose={onClose}
    >
      <div className="preorder-content">
        {result.loading && (
          <p role="status">Consultando medios de pago y turnos…</p>
        )}

        {result.error && <p role="alert">{result.error}</p>}

        {result.error && (
          <Button variant="secondary" onClick={result.reload}>
            Reintentar consulta
          </Button>
        )}

        {data && (
          <>
            <strong>
              Total:{" "}
              {order.total
                ? cashMoney(order.total, "COP")
                : "No disponible"}
            </strong>

            {cashRequired && (
              <SelectField
                label="Turno abierto de esta ubicación"
                value={cashSessionId}
                disabled={frozen}
                options={data.sessions.map((row) => ({
                  value: row.id,
                  label: `#${row.id} · ${row.cashRegister.name}`,
                }))}
                onValueChange={setCashSessionId}
                placeholder="Selecciona un turno"
              />
            )}

            {cashRequired && !data.sessions.length && (
              <p role="alert">
                Necesitas un turno abierto accesible en esta
                ubicación.
              </p>
            )}

            {mode === "pay" ? (
              <>
                {payments.map((payment, index) => (
                  <fieldset
                    key={payment.key}
                    disabled={frozen}
                    className="preorder-fieldset"
                  >
                    <CheckoutPayment
                      payment={payment}
                      index={index}
                      currency="COP"
                      methods={data.methods.filter(
                        (method) => method.isActive
                      )}
                      removable={payments.length > 1}
                      disabled={frozen}
                      change={(next) =>
                        setPayments((rows) =>
                          rows.map((row) =>
                            row.key === next.key ? next : row
                          )
                        )
                      }
                      remove={() =>
                        setPayments((rows) =>
                          rows.filter(
                            (row) => row.key !== payment.key
                          )
                        )
                      }
                      referenceLabel="Referencia o dato para identificar el pago"
                      referencePlaceholder="Ej. NEQUI-7890, nombre del pagador o últimos 4 dígitos"
                      showOptionalReference
                    />
                  </fieldset>
                ))}

                <Button
                  variant="secondary"
                  disabled={frozen || payments.length >= 20}
                  onClick={() =>
                    setPayments((rows) => [...rows, newPayment()])
                  }
                >
                  Agregar medio de pago
                </Button>

                <p>
                  Aplicado: {cashMoney(preview.paid, "COP")}
                  {" · "}
                  Cambio: {cashMoney(preview.change, "COP")}
                </p>
              </>
            ) : (
              <>
                <TextField
                  label="Motivo de devolución"
                  value={reason}
                  minLength={5}
                  maxLength={500}
                  disabled={frozen}
                  onChange={(event) => setReason(event.target.value)}
                />

                {data.batch?.payments.map((payment) => (
                  <div key={payment.id}>
                    <p>
                      {payment.paymentMethodName}
                      {" · "}
                      {cashMoney(payment.amount, "COP")}
                    </p>

                    <TextField
                      label="Referencia de devolución"
                      disabled={frozen}
                      required={
                        data.methods.find(
                          (method) =>
                            method.id === payment.paymentMethodId
                        )?.requiresReference
                      }
                      maxLength={120}
                      value={references[payment.id] ?? ""}
                      onChange={(event) =>
                        setReferences({
                          ...references,
                          [payment.id]: event.target.value,
                        })
                      }
                    />
                  </div>
                ))}

                <p>
                  Se devolverá el pago completo por sus medios
                  originales.
                </p>
              </>
            )}
          </>
        )}

        {error && <p role="alert">{error}</p>}

        {intent && !resource.busy && (
          <p role="status">
            Hay una operación por verificar. Conservamos sus datos
            para evitar duplicados.
          </p>
        )}

        <div className="sales-form-actions">
          <Button
            variant="secondary"
            disabled={frozen}
            onClick={onClose}
          >
            Cancelar
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
            loading={resource.busy}
            disabled={
              !data || !order.total || (mode === "refund" && !!intent)
            }
            onClick={() => void submit()}
          >
            {intent
              ? "Reintentar el mismo pago"
              : mode === "pay"
                ? "Verificar pago"
                : "Confirmar devolución"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
