import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import {
  errorText,
  uncertain,
} from "../services/inventory-operations";

export function InventoryWriteDialog({
  className = "",
  onBeforeSave,
  onBack,
  title,
  description,
  submitLabel,
  dirty,
  valid = true,
  children,
  onSave,
  onSaved,
  onClose,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  dirty: boolean;
  valid?: boolean;
  children: ReactNode;
  className?: string;
  onBeforeSave?: () => boolean;
  onBack?: () => void;
  onSave: (signal: AbortSignal) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const id = useId();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [discard, setDiscard] = useState(false);

  const writing = useRef<AbortController | null>(null);
  const locked = useRef(false);

  useEffect(() => () => writing.current?.abort(), []);

  useEffect(() => {
    if (!dirty && !busy) return;

    const guard = (event: BeforeUnloadEvent) =>
      event.preventDefault();

    window.addEventListener("beforeunload", guard);

    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);

  function close() {
    if (locked.current) return;

    if (dirty && !unknown) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  async function submit() {
    if (locked.current || unknown || !valid) return;

    if (onBeforeSave && !onBeforeSave()) return;

    locked.current = true;

    const controller = new AbortController();
    writing.current = controller;

    setBusy(true);
    setError("");

    try {
      await onSave(controller.signal);
      controller.signal.throwIfAborted();
    } catch (cause) {
      if (controller.signal.aborted) return;

      const ambiguous = uncertain(cause);

      setUnknown(ambiguous);

      setError(
        ambiguous
          ? "No pudimos confirmar el resultado. Cierra y actualiza el listado antes de intentar nuevamente."
          : errorText(cause)
      );

      return;
    } finally {
      locked.current = false;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }

    onSaved();
  }

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title={title}
      className={"inv-dialog inv-centered " + className}
      busy={busy}
      onClose={close}
    >
      {discard ? (
        <>
          <div className="inv-dialog-body" role="alert">
            <h3>Hay cambios sin guardar</h3>
            <p>¿Deseas descartarlos?</p>
          </div>

          <footer className="inv-dialog-footer">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDiscard(false)}
            >
              Continuar editando
            </Button>

            <Button size="sm" variant="danger" onClick={onClose}>
              Descartar cambios
            </Button>
          </footer>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset
            className="inv-dialog-body"
            disabled={busy || unknown}
          >
            {description && (
              <p className="inv-muted">{description}</p>
            )}

            {children}
          </fieldset>

          {error && (
            <p className="inv-error inv-server-error" role="alert">
              {error}
            </p>
          )}

          <footer className="inv-dialog-footer">
            {onBack && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || unknown}
                onClick={onBack}
              >
                Volver a editar
              </Button>
            )}
            <Button
              size="sm"
              variant="cancel"
              disabled={busy}
              onClick={close}
            >
              {unknown ? "Cerrar" : "Cancelar"}
            </Button>

            <Button
              size="sm"
              type="submit"
              loading={busy}
              disabled={!valid || unknown}
            >
              {submitLabel}
            </Button>
          </footer>
        </form>
      )}
    </BottomSheet>
  );
}
