import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";

import {
  closeSessionInput,
  type CashSession,
  type Reconciliation,
} from "../schemas/cash.schema";

import {
  canCloseCash,
  readCloseReconciliation,
  submitCashClose,
} from "../services/cash-close.service";

import {
  closeSnapshot,
  countPreview,
  type CashCountDraft,
} from "../utils/cash-count";

export function useCashClose(
  session: AuthSession,
  initial: Reconciliation,
  onClosed: (row: CashSession, submitted: boolean) => void,
  startReview = false
) {
  const controller = useRef<AbortController | null>(null);

  const [data, setData] = useState(initial);
  const [review, setReview] = useState(startReview);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => controller.current?.abort(), []);

  async function run(
    action: "review" | "confirm" | "verify",
    draft: CashCountDraft
  ) {
    if (controller.current || (uncertain && action !== "verify")) {
      return;
    }

    const input = closeSessionInput.safeParse({
      countedCashAmount: draft.counted,
      closingNotes: draft.notes,
    });

    if (action !== "verify" && !input.success) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    let posted = false;

    try {
      const fresh = await readCloseReconciliation(
        data.cashSession.id,
        session,
        current.signal
      );

      if (current.signal.aborted) return;

      setData(fresh);

      if (fresh.cashSession.status === "CLOSED") {
        onClosed(fresh.cashSession, false);
        return;
      }

      if (action === "verify") {
        setUncertain(false);
        setReview(false);
        setError(
          "El turno sigue abierto. Revisa el conteo antes de volver a confirmar."
        );
        return;
      }

      if (!canCloseCash(fresh.cashSession, session)) {
        throw new Error("No tienes permiso para cerrar este turno.");
      }

      const preview = countPreview(
        draft.counted.trim(),
        fresh.movements.calculatedExpectedCashAmount
      );

      if (preview.error) {
        setReview(false);
        throw new Error(preview.error);
      }

      if (action === "review") {
        setReview(true);
        return;
      }

      if (closeSnapshot(data) !== closeSnapshot(fresh)) {
        setError(
          "La conciliación cambió. Revisa los importes actualizados antes de confirmar."
        );
        return;
      }

      if (!input.success) return;

      posted = true;

      const result = await submitCashClose(
        fresh.cashSession,
        {
          countedCashAmount: input.data.countedCashAmount,
          closingNotes: draft.notes,
        },
        session,
        current.signal
      );

      if (!current.signal.aborted) {
        onClosed(result, true);
      }
    } catch (cause) {
      if (current.signal.aborted) return;

      if (
        cause instanceof ApiError &&
        cause.code === "CASH_SESSION_NOT_OPEN"
      ) {
        setUncertain(true);

        try {
          const fresh = await readCloseReconciliation(
            data.cashSession.id,
            session,
            current.signal
          );

          if (current.signal.aborted) return;

          setData(fresh);

          if (fresh.cashSession.status === "CLOSED") {
            onClosed(fresh.cashSession, false);
            return;
          }
        } catch {
          // La siguiente consulta será explícita.
          // No se enviará automáticamente otro cierre.
        }

        if (!current.signal.aborted) {
          setError(
            "El turno ya no está abierto. Consulta su estado para obtener el arqueo definitivo."
          );
        }
      } else {
        const unknown =
          posted &&
          (!(cause instanceof ApiError) ||
            cause.status === 0 ||
            cause.status === 408 ||
            cause.status >= 500);

        if (unknown) setUncertain(true);
        if (!unknown) setReview(false);

        const detail =
          cause instanceof ApiError && cause.errors.length
            ? cause.errors.map((item) => item.message).join(" ")
            : cause instanceof Error
              ? cause.message
              : "No se pudo cerrar el turno.";

        const message =
          cause instanceof ApiError &&
          cause.code === "NEGATIVE_EXPECTED_CASH"
            ? "El efectivo esperado es negativo. Revisa la conciliación."
            : cause instanceof ApiError && cause.status === 403
              ? "No tienes permiso o acceso a esta ubicación."
              : cause instanceof ApiError &&
                  (cause.status === 404 ||
                    cause.code === "CASH_SESSION_NOT_FOUND")
                ? "El turno no existe o ya no está disponible."
                : detail;

        setError(
          message +
            (unknown
              ? " Conservamos tu conteo. Consulta el estado antes de reintentar."
              : "")
        );
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  return {
    data,
    review,
    busy,
    uncertain,
    error,
    run,
    back: () => setReview(false),
  };
}
