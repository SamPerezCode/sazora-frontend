import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type {
  CheckoutInput,
  CheckoutSale,
} from "../schemas/checkout.schema";
import {
  findCheckout,
  orderFingerprint,
  readCheckout,
  submitCheckout,
  type CheckoutData,
} from "../services/checkout.service";

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
  const [sale, setSale] = useState<CheckoutSale | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function confirm(input: CheckoutInput) {
    if (controller.current || review || uncertain || sale) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    let posted = false;

    try {
      const fresh = await readCheckout(
        session,
        data.order.id,
        data.order.locationId,
        current.signal
      );

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
          before.paymentType !== after.paymentType
        ) {
          throw new Error(
            "Cambió una forma de pago. Revisa los datos antes de cobrar."
          );
        }
      }

      posted = true;

      const result = await submitCheckout(
        session,
        data.order.locationId,
        input,
        current.signal
      );

      if (!current.signal.aborted) {
        setSale(result);
        recorded();
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        const unknown =
          posted &&
          (!(cause instanceof ApiError) ||
            cause.status === 0 ||
            cause.status >= 500 ||
            cause.status === 408);

        setUncertain(unknown);
        setReview(true);
        setError(
          (cause instanceof Error
            ? cause.message
            : "No se pudo completar el cobro.") +
            (unknown
              ? " El resultado no está confirmado. Usa Verificar venta; no envíes otro cobro."
              : "")
        );
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  async function verify() {
    if (controller.current || sale) return;

    const current = new AbortController();
    controller.current = current;
    setBusy(true);

    try {
      const result = await findCheckout(
        session,
        data.order.id,
        data.order.locationId,
        current.signal
      );

      if (!current.signal.aborted) {
        if (result) {
          setSale(result);
          setError("");
          recorded();
        } else {
          setError(
            "No se encontró una venta confirmada para esta orden. Puedes volver a verificar; no se enviará otro cobro."
          );
        }
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible verificar la venta."
        );
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  return {
    busy,
    error,
    review,
    uncertain,
    sale,
    confirm,
    verify,
  };
}
