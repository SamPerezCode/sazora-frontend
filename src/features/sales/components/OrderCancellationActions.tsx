import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";

import type { Order } from "../schemas/sales.schema";
import type { SalesResource } from "../hooks/useSales";

export function OrderCancellationActions({
  resource,
  orderId,
  status,
  pendingCount,
  hasDelivered,
}: {
  resource: SalesResource;
  orderId: string | null;
  status: Order["status"];
  pendingCount: number;
  hasDelivered: boolean;
}) {
  const [mode, setMode] = useState<"discard" | "cancel" | null>(null);

  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const titleId = useId();
  const textId = useId();
  const reasonId = useId();

  const confirmed = status === "CONFIRMED";

  const verificationPending =
    !!orderId && !!resource.cancellationIds[orderId];

  const delivered =
    hasDelivered || (!!orderId && !!resource.deliveredIds[orderId]);

  const cancellable = !!orderId && (status === "OPEN" || confirmed);

  const disabled = resource.busy || resource.uncertain;

  const cancellationBlocked =
    disabled || verificationPending || (confirmed && delivered);

  const modalVisible =
    mode === "discard" ? !orderId : mode === "cancel" && cancellable;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!modalVisible || !dialog) return;

    const previous = document.activeElement;

    dialog.showModal();
    continueRef.current?.focus();

    return () => {
      dialog.close();

      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [modalVisible]);

  function close() {
    if (!resource.busy) {
      setMode(null);
    }
  }

  return (
    <div className="sales-cancellation-actions">
      {!orderId && (
        <Button
          size="sm"
          variant="danger"
          disabled={disabled}
          onClick={resource.discardLocal}
        >
          <Trash2 size={16} aria-hidden="true" />
          Descartar borrador
        </Button>
      )}

      {orderId && confirmed && pendingCount > 0 && (
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || verificationPending}
          onClick={() => resource.discardAdditions(orderId)}
        >
          Descartar adiciones
        </Button>
      )}

      {cancellable && (
        <Button
          size="sm"
          variant="danger"
          disabled={cancellationBlocked}
          onClick={() => {
            resource.clearNotice();
            setReason("");
            setReasonError("");
            setMode("cancel");
          }}
        >
          <Trash2 size={16} aria-hidden="true" />

          {confirmed
            ? "Cancelar orden completa"
            : "Cancelar orden pendiente"}
        </Button>
      )}

      {confirmed && delivered && (
        <p className="sales-price-note">
          La orden tiene productos entregados y ya no puede cancelarse
          completamente. Puedes cancelar individualmente los productos
          que todavía no hayan sido entregados.
        </p>
      )}

      {modalVisible && (
        <dialog
          ref={dialogRef}
          className="bottom-sheet bottom-sheet-modal sales-cancellation-dialog"
          aria-labelledby={titleId}
          aria-describedby={textId}
          aria-busy={resource.busy || undefined}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <div className="bottom-sheet-heading">
            <h2 id={titleId}>
              {mode === "discard"
                ? "¿Descartar este pedido?"
                : confirmed
                  ? "¿Cancelar toda la orden?"
                  : "¿Cancelar la orden pendiente?"}
            </h2>
          </div>

          <form
            className="sales-form sales-cancellation-content"
            onSubmit={async (event) => {
              event.preventDefault();

              if (disabled) return;

              if (mode === "discard") {
                resource.discardLocal();
                setMode(null);
                return;
              }

              if (!orderId || !cancellable || cancellationBlocked) {
                return;
              }

              const clean = reason.trim();

              if (clean.length < 3 || clean.length > 500) {
                setReasonError(
                  "El motivo debe contener entre 3 y 500 caracteres."
                );
                return;
              }

              setReasonError("");

              const result = await resource.cancelOrder(
                orderId,
                clean,
                confirmed ? "CONFIRMED" : "OPEN"
              );

              if (result.ok) {
                setMode(null);
              } else {
                setReasonError(result.reason ?? "");
              }
            }}
          >
            <p id={textId}>
              {mode === "discard"
                ? "Los productos todavía no han sido enviados. Se eliminará el borrador y no se creará ninguna orden."
                : confirmed
                  ? "Se cancelarán todos los productos que todavía no hayan sido entregados. Esta acción no se puede deshacer."
                  : "La orden ya fue guardada, pero todavía no ha sido confirmada. Sus productos serán cancelados y, si corresponde a una mesa, quedará disponible."}
            </p>

            {mode === "cancel" && (
              <>
                <label className="sales-label" htmlFor={reasonId}>
                  Motivo de cancelación
                  <textarea
                    id={reasonId}
                    required
                    minLength={3}
                    maxLength={500}
                    value={reason}
                    disabled={resource.busy}
                    aria-invalid={!!reasonError}
                    aria-describedby={
                      reasonError ? reasonId + "-error" : undefined
                    }
                    placeholder="Ej. El cliente decidió cancelar completamente el pedido"
                    onChange={(event) => {
                      setReason(event.target.value);
                      setReasonError("");
                    }}
                  />
                </label>

                {reasonError && (
                  <p id={reasonId + "-error"} role="alert">
                    {reasonError}
                  </p>
                )}

                {resource.notice && (
                  <p role="status">{resource.notice}</p>
                )}

                {verificationPending && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={resource.busy}
                    onClick={() => void resource.verifyCancellation()}
                  >
                    Verificar cancelación
                  </Button>
                )}
              </>
            )}

            <div className="sales-form-actions">
              <button
                ref={continueRef}
                type="button"
                className="sales-confirm-back"
                disabled={resource.busy}
                onClick={close}
              >
                {mode === "discard" ? "Continuar editando" : "Volver"}
              </button>

              <Button
                size="sm"
                type="submit"
                variant="danger"
                loading={resource.busy}
                loadingText="Cancelando..."
                disabled={
                  mode === "discard" ? disabled : cancellationBlocked
                }
              >
                {mode === "discard"
                  ? "Descartar borrador"
                  : confirmed
                    ? "Cancelar orden completa"
                    : "Cancelar orden pendiente"}
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
