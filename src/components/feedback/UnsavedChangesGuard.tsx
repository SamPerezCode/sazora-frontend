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

      <div className="mt-5 grid grid-cols-2 items-stretch gap-2 sm:flex sm:justify-end">
        <Button
          size="sm"
          variant="secondary"
          className="min-w-0 whitespace-normal"
          disabled={busy}
          onClick={onCancel}
        >
          <span className="min-w-0">Continuar editando</span>
        </Button>

        <Button
          size="sm"
          variant="cancel"
          className="min-w-0 whitespace-normal"
          disabled={busy}
          onClick={onDiscard}
        >
          <span className="min-w-0">Descartar cambios</span>
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
