import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError } from "../lib/http/client";
import { useTimedMessage } from "./useTimedMessage";

export function useAdminForm<T extends object>(initial: T) {
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useTimedMessage();
  const [success, setSuccess] = useState(false);

  const writing = useRef<AbortController | null>(null);

  useEffect(() => () => writing.current?.abort(), []);

  function change(patch: Partial<T>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setErrors({});
    setMessage("");
    setSuccess(false);
  }

  function reset() {
    if (busy || uncertain) return;

    setDraft(baseline);
    setErrors({});
    setMessage("");
    setSuccess(false);
  }

  async function save(
    work: (draft: T, signal: AbortSignal) => Promise<T>,
    onSaved?: () => void
  ) {
    if (writing.current || uncertain) return;

    const controller = new AbortController();

    writing.current = controller;
    setBusy(true);
    setErrors({});
    setMessage("");
    setSuccess(false);

    try {
      const saved = await work(draft, controller.signal);

      controller.signal.throwIfAborted();

      setDraft(saved);
      setBaseline(saved);
      setSuccess(true);
      setMessage("Guardado correctamente.");

      onSaved?.();
    } catch (error) {
      if (controller.signal.aborted) return;

      const fields: Record<string, string> = {};

      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          fields[issue.path.join(".")] ??= issue.message;
        });
      } else if (error instanceof ApiError) {
        error.errors.forEach((issue) => {
          fields[issue.field] ??= issue.message;
        });
      }

      const unknown =
        !(error instanceof z.ZodError) &&
        (!(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500);

      setUncertain(unknown);
      setErrors(fields);

      setMessage(
        unknown
          ? "No pudimos confirmar el guardado. Vuelve a consultar antes de intentar guardar otra vez."
          : error instanceof ApiError &&
              error.code === "LAST_ACTIVE_LOCATION_CANNOT_BE_DISABLED"
            ? "No puedes desactivar la última ubicación activa. Crea o activa otra ubicación primero."
            : error instanceof z.ZodError
              ? "Revisa los campos: " +
                error.issues.map((issue) => issue.message).join(" ")
              : error instanceof Error
                ? error.message
                : "No pudimos guardar."
      );
    } finally {
      writing.current = null;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return {
    draft,
    busy,
    uncertain,
    errors,
    message,
    success,
    change,
    reset,
    save,
    dirty: JSON.stringify(draft) !== JSON.stringify(baseline),
  };
}
