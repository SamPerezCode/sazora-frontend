import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";

export function useCashMutation() {
  const controller = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => () => controller.current?.abort(), []);

  async function run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    saved: (value: T) => void
  ) {
    if (controller.current || uncertain) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    try {
      const value = await task(current.signal);

      if (!current.signal.aborted) saved(value);
    } catch (cause) {
      if (!current.signal.aborted) {
        const unknownResult =
          !(cause instanceof ApiError) ||
          cause.status >= 500 ||
          cause.status === 408;

        setUncertain(unknownResult);

        setError(
          (cause instanceof Error
            ? cause.message
            : "No se pudo completar.") +
            (unknownResult
              ? " Cierra esta ventana y consulta el estado antes de repetir la operación."
              : "")
        );
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  return { busy, error, uncertain, run };
}
