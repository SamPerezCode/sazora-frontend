import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { VoidSaleInput } from "../schemas/void-sale.schema";
import { getFinancialSale } from "../services/financial-sales.service";
import {
  readVoidOptions,
  voidFinancialSale,
  voidFingerprint,
  type VoidOptions,
} from "../services/void-sale.service";

export function useVoidSale(
  session: AuthSession,
  data: VoidOptions,
  onVoided: () => void
) {
  const controller = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => () => controller.current?.abort(), []);

  async function confirm(input: VoidSaleInput) {
    if (controller.current || review) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    let posted = false;

    try {
      const fresh = await readVoidOptions(
        session,
        data.sale.id,
        data.sale.locationId,
        current.signal
      );

      if (fresh.sale.status === "VOIDED") {
        onVoided();
        return;
      }

      if (
        fresh.sale.status !== "COMPLETED" ||
        voidFingerprint(fresh.sale) !== voidFingerprint(data.sale)
      ) {
        throw new Error(
          "La venta cambió. Revisa su estado antes de continuar."
        );
      }

      if (
        !fresh.sessions.some((row) => row.id === input.cashSessionId)
      ) {
        throw new Error("El turno seleccionado ya no está abierto.");
      }

      posted = true;

      await voidFinancialSale(
        session,
        fresh.sale,
        input,
        current.signal
      );

      if (!current.signal.aborted) {
        onVoided();
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        const unknown =
          posted &&
          (!(cause instanceof ApiError) ||
            cause.status === 0 ||
            cause.status >= 500 ||
            cause.status === 408);

        setReview(true);
        setUncertain(unknown);
        setError(
          (cause instanceof Error
            ? cause.message
            : "No se pudo anular la venta.") +
            (unknown
              ? " El resultado no está confirmado. Verifica la anulación antes de continuar."
              : "")
        );
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  async function verify() {
    if (controller.current) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);

    try {
      const sale = await getFinancialSale(
        session,
        data.sale.id,
        current.signal
      );

      if (sale.locationId !== data.sale.locationId) {
        throw new Error("La venta pertenece a otra ubicación.");
      }

      if (!current.signal.aborted) {
        if (sale.status === "VOIDED") {
          onVoided();
        } else {
          setError(
            "La anulación aún no está confirmada. Puedes volver a verificar sin enviar otra anulación."
          );
        }
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible verificar la anulación."
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
    confirm,
    verify,
  };
}
