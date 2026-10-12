import { useEffect, useId } from "react";
import { useBlocker } from "react-router";
import { BottomSheet } from "../layout/BottomSheet";
import { Button } from "../ui/Button";

export function DiscardChangesDialog({
  busy = false,
  onCancel,
  onDiscard,
}: {
  busy?: boolean;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  const id = useId();

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title="Hay cambios sin guardar"
      busy={busy}
      onClose={onCancel}
    >
      <p className="text-sm text-muted">
        {busy
          ? "Espera a que termine el guardado."
          : "Si continúas, se perderán los cambios pendientes."}
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Continuar editando
        </Button>

        <Button variant="cancel" disabled={busy} onClick={onDiscard}>
          Descartar cambios
        </Button>
      </div>
    </BottomSheet>
  );
}

export function UnsavedChangesGuard({
  dirty,
  busy = false,
}: {
  dirty: boolean;
  busy?: boolean;
}) {
  const blocker = useBlocker(dirty || busy);

  useEffect(() => {
    if (!dirty && !busy) return;

    const beforeUnload = (event: BeforeUnloadEvent) =>
      event.preventDefault();

    window.addEventListener("beforeunload", beforeUnload);

    return () =>
      window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy]);

  return blocker.state === "blocked" ? (
    <DiscardChangesDialog
      busy={busy}
      onCancel={() => blocker.reset()}
      onDiscard={() => blocker.proceed()}
    />
  ) : null;
}
