import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { RefundInput } from "../schemas/refund.schema";
import {
  createRefund,
  listRefunds,
  readRefundContext,
  type RefundContext,
} from "../services/refund.service";
import { refundSnapshot } from "../utils/refund-calculation";

export function useRefundMutation(
  session: AuthSession,
  data: RefundContext,
  onCreated: (id: string) => void
) {
  const controller = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => () => controller.current?.abort(), []);

  async function confirm(input: RefundInput) {
    if (controller.current || review) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    let posted = false;

    try {
      const fresh = await readRefundContext(
        session,
        data.sale.id,
        current.signal
      );

      if (
        !["COMPLETED", "PARTIALLY_REFUNDED"].includes(
          fresh.sale.status
        ) ||
        refundSnapshot(fresh.sale, fresh.refunds) !==
          refundSnapshot(data.sale, data.refunds)
      ) {
        throw new Error(
          "La venta o sus devoluciones cambiaron. Revisa las cantidades y los pagos."
        );
      }

      if (
        !fresh.sessions.some((row) => row.id === input.cashSessionId)
      ) {
        throw new Error("El turno seleccionado ya no está abierto.");
      }

      posted = true;

      const id = await createRefund(
        session,
        fresh.sale,
        input,
        current.signal
      );

      if (!current.signal.aborted) onCreated(id);
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
            : "No se pudo registrar la devolución.") +
            (unknown
              ? " El resultado no está confirmado. Consulta las devoluciones antes de enviar otra solicitud."
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
      const rows = await listRefunds(
        session,
        data.sale.id,
        current.signal
      );

      const added = rows.filter(
        (row) => !data.refunds.some((old) => old.id === row.id)
      );

      if (!current.signal.aborted) {
        setError(
          added.length
            ? "Hay nuevas devoluciones: " +
                added.map((row) => "#" + row.id).join(", ") +
                ". Revisa su detalle en el historial antes de continuar."
            : "Todavía no aparece una nueva devolución. Puedes volver a consultar; no se enviará otra solicitud."
        );
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible consultar."
        );
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  return { busy, error, review, uncertain, confirm, verify };
}
