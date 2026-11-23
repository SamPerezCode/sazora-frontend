import { useEffect, useRef, useState } from "react";

import type { AuthSession } from "../../auth/types/auth.types";

import { invalidateRelated } from "../../../lib/operations-sync";

import type {
  CheckoutInput,
  CheckoutSale,
} from "../schemas/checkout.schema";

import {
  orderFingerprint,
  readCheckout,
  recoverTableCheckout,
  submitCheckout,
  type CheckoutData,
} from "../services/checkout.service";

import { calculateCheckout } from "../utils/checkout-calculation";

export function useCheckoutMutation(
  session: AuthSession,
  data: CheckoutData,
  recorded: () => void
) {
  const controller = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [closed, setClosed] = useState(false);

  const [sale, setSale] = useState<CheckoutSale | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function accept(
    result: Awaited<ReturnType<typeof recoverTableCheckout>>,
    detail = ""
  ) {
    setSale(result.sale);
    setClosed(result.closed);
    setUncertain(false);
    setReview(!result.closed);

    setError(
      result.closed
        ? ""
        : detail +
            (detail ? " " : "") +
            (result.order.status === "DELIVERED"
              ? "No se encontró una venta y la orden sigue entregada. Revisa los datos actualizados antes de intentar cobrar."
              : "La orden está en estado " +
                result.order.status +
                ". Actualiza la cuenta; no se enviará ningún cobro.")
    );
  }

  async function recover(signal: AbortSignal, detail = "") {
    const result = await recoverTableCheckout(
      session,
      data.order.id,
      data.order.locationId,
      signal
    );

    if (!signal.aborted) {
      accept(result, detail);
      recorded();
    }
  }

  async function confirm(input: CheckoutInput) {
    if (controller.current || review || uncertain || sale || closed) {
      return;
    }

    const current = new AbortController();

    controller.current = current;

    setBusy(true);
    setError("");

    let posted = false;

    try {
      if (input.orderId !== data.order.id) {
        throw new Error(
          "El cobro no corresponde a la cuenta abierta."
        );
      }

      const fresh = await readCheckout(
        session,
        data.order.id,
        data.order.locationId,
        current.signal
      );

      if (fresh.order.status === "CLOSED") {
        await recover(current.signal);
        return;
      }

      if (
        fresh.order.serviceType !== "TABLE" ||
        fresh.order.sourceChannel !== "IN_PERSON" ||
        fresh.order.status !== "DELIVERED" ||
        fresh.order.paymentStatus !== "PENDING"
      ) {
        throw new Error(
          "La mesa no está disponible para un nuevo cobro."
        );
      }

      if (
        orderFingerprint(fresh.order) !== orderFingerprint(data.order)
      ) {
        throw new Error(
          "La cuenta cambió. Revisa sus datos antes de cobrar."
        );
      }

      if (
        !fresh.sessions.some((row) => row.id === input.cashSessionId)
      ) {
        throw new Error("El turno seleccionado ya no está abierto.");
      }

      for (const payment of input.payments) {
        const before = data.methods.find(
          (row) => row.id === payment.paymentMethodId
        );

        const after = fresh.methods.find(
          (row) => row.id === payment.paymentMethodId
        );

        if (
          !before ||
          !after ||
          before.requiresReference !== after.requiresReference ||
          before.allowsChange !== after.allowsChange ||
          before.affectsCash !== after.affectsCash ||
          before.paymentType !== after.paymentType
        ) {
          throw new Error(
            "Cambió una forma de pago. Revisa los datos antes de cobrar."
          );
        }
      }

      const calculation = calculateCheckout(
        input.payments.map((payment, index) => ({
          key: String(index),
          paymentMethodId: payment.paymentMethodId,
          amount: payment.amount,
          tenderedAmount: payment.tenderedAmount ?? "",
          reference: payment.reference ?? "",
          notes: payment.notes ?? "",
        })),
        fresh.methods,
        fresh.order.total
      );

      if (!calculation.valid) {
        throw new Error(calculation.error);
      }

      posted = true;

      const result = await submitCheckout(
        session,
        data.order.locationId,
        {
          ...input,
          payments: calculation.payments,
        },
        current.signal
      );

      if (!current.signal.aborted) {
        setSale(result);
        setClosed(true);
        setReview(false);
        setUncertain(false);

        recorded();
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        const detail =
          cause instanceof Error
            ? cause.message
            : "No se pudo completar el cobro.";

        setReview(true);
        setUncertain(posted);
        setError(detail);

        if (posted) {
          try {
            await recover(current.signal, detail);
          } catch (recovery) {
            if (!current.signal.aborted) {
              setError(
                detail +
                  " No fue posible verificar el resultado: " +
                  (recovery instanceof Error
                    ? recovery.message
                    : "error de consulta") +
                  ". Usa Verificar venta; no envíes otro cobro."
              );
            }
          }
        }
      }
    } finally {
      if (posted) {
        invalidateRelated(session.accessToken, {
          orderId: data.order.id,
        });
      }

      if (!current.signal.aborted) {
        setBusy(false);
      }

      controller.current = null;
    }
  }

  async function verify() {
    if (controller.current || sale || closed) return;

    const current = new AbortController();

    controller.current = current;

    setBusy(true);

    try {
      await recover(current.signal);
    } catch (cause) {
      if (!current.signal.aborted) {
        setReview(true);

        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible verificar la venta."
        );
      }
    } finally {
      if (!current.signal.aborted) {
        setBusy(false);
      }

      controller.current = null;
    }
  }

  return {
    busy,
    error,
    review,
    uncertain,
    closed,
    sale,
    confirm,
    verify,
  };
}
