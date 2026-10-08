import { useEffect, useId, useRef, useState } from "react";
import { Minus, TriangleAlert } from "lucide-react";

import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";

import { cancelQuantityInputSchema } from "../../../lib/orders/quantity-cancellation";
import type { QuantityCancellationResult } from "../../../lib/orders/quantity-cancellation";

import type { OrderItem } from "../schemas/sales.schema";
import type { SalesResource } from "../hooks/useSales";

export function CancelUnitsDialog({
  resource,
  orderId,
  item,
  preparationStatus,
  onClose,
}: {
  resource: SalesResource;
  orderId: string;
  item: OrderItem | undefined;
  preparationStatus: string | undefined;
  onClose: () => void;
}) {
  const id = useId();
  const alive = useRef(false);

  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const [acceptedQuantity, setAcceptedQuantity] = useState(
    item?.quantity ?? 0
  );

  const [confirmedFull, setConfirmedFull] = useState(false);

  const [feedback, setFeedback] =
    useState<QuantityCancellationResult>({
      ok: false,
    });

  const canCancel =
    resource.data?.order?.id === orderId &&
    resource.data.order.status === "CONFIRMED" &&
    item?.status === "ACTIVE" &&
    !!preparationStatus &&
    ["PENDING", "IN_PREPARATION", "READY"].includes(
      preparationStatus
    );

  const changed = !!item && item.quantity !== acceptedQuantity;

  const amount = Number(quantity);

  const validQuantity =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    !!item &&
    amount <= item.quantity;

  const full = !!item && validQuantity && amount === item.quantity;

  const parsed = cancelQuantityInputSchema.safeParse({
    quantity: amount,
    reason,
  });

  const blocked =
    resource.busy || resource.uncertain || !!resource.error;

  const quantityError =
    feedback.fields?.quantity ||
    (!validQuantity
      ? "Usa un entero entre 1 y la cantidad actual."
      : "");

  const message =
    feedback.message || resource.error || resource.notice;

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!resource.busy && !canCancel) {
      onClose();
    }
  }, [resource.busy, canCancel, onClose]);

  async function submit() {
    if (
      blocked ||
      !canCancel ||
      changed ||
      !parsed.success ||
      !validQuantity ||
      !item ||
      (full && !confirmedFull)
    ) {
      return;
    }

    setFeedback({ ok: false });
    resource.clearNotice();

    if (full) {
      const ok = await resource.action(
        `/orders/${orderId}/items/${item.id}/cancel`,
        "POST",
        { reason: parsed.data.reason }
      );

      if (alive.current && ok) {
        onClose();
      }

      return;
    }

    const result = await resource.cancelUnits(
      item.id,
      amount,
      parsed.data.reason
    );

    if (!alive.current) return;

    if (result.ok || result.close) {
      onClose();
    } else {
      setFeedback(result);
    }
  }

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title="Cancelar unidades"
      className="sales-quantity-dialog"
      busy={resource.busy}
      onClose={onClose}
    >
      <form
        className="sales-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="sales-quantity-summary">
          <strong>{item?.productName}</strong>

          <span>Cantidad actual: {item?.quantity ?? "—"}</span>
        </div>

        {message && <Alert>{message}</Alert>}

        {changed && (
          <Alert>
            <p>
              La cantidad cambió. Ahora hay {item?.quantity} unidades.
            </p>

            <Button
              size="sm"
              variant="secondary"
              disabled={blocked}
              onClick={() => {
                setAcceptedQuantity(item?.quantity ?? 0);
                setQuantity("1");
                setConfirmedFull(false);
                setFeedback({ ok: false });
              }}
            >
              Usar cantidad actual
            </Button>
          </Alert>
        )}

        <label className="sales-label">
          Unidades por cancelar
          <input
            type="number"
            min={1}
            max={item?.quantity}
            step={1}
            inputMode="numeric"
            value={quantity}
            disabled={blocked || changed}
            aria-invalid={!!quantityError}
            aria-describedby={id + "-quantity-error"}
            onChange={(event) => {
              setQuantity(event.target.value);
              setConfirmedFull(false);
              setFeedback({ ok: false });
            }}
          />
        </label>

        {quantityError && (
          <p
            id={id + "-quantity-error"}
            className="text-sm text-danger"
          >
            {quantityError}
          </p>
        )}

        {validQuantity && (
          <p className="sales-quantity-result" role="status">
            Quedarán {(item?.quantity ?? 0) - amount} unidades.
          </p>
        )}

        <label className="sales-label">
          Motivo de cancelación
          <textarea
            value={reason}
            required
            minLength={3}
            maxLength={500}
            disabled={blocked}
            placeholder="Ej. El cliente solicitó retirar una unidad"
            aria-invalid={!!feedback.fields?.reason}
            aria-describedby={id + "-reason-error"}
            onChange={(event) => {
              setReason(event.target.value);

              setFeedback((previous) => ({
                ...previous,
                fields: {
                  ...previous.fields,
                  reason: undefined,
                },
              }));
            }}
          />
        </label>

        {feedback.fields?.reason && (
          <p
            id={id + "-reason-error"}
            className="text-sm text-danger"
          >
            {feedback.fields.reason}
          </p>
        )}

        {feedback.offerFull && !full && (
          <Button
            size="sm"
            variant="secondary"
            disabled={blocked || changed}
            onClick={() => {
              setQuantity(String(item?.quantity ?? 0));
              setConfirmedFull(false);
              setFeedback({ ok: false });
            }}
          >
            Cancelar producto completo
          </Button>
        )}

        {full && (
          <div className="sales-quantity-confirm">
            <p>
              <TriangleAlert size={17} aria-hidden="true" />
              Vas a cancelar completamente este producto. Esta acción
              será informada a Cocina.
            </p>

            <label>
              <input
                type="checkbox"
                checked={confirmedFull}
                disabled={blocked}
                onChange={(event) =>
                  setConfirmedFull(event.target.checked)
                }
              />
              Confirmo la cancelación completa.
            </label>
          </div>
        )}

        <div className="sales-form-actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={resource.busy}
            onClick={onClose}
          >
            Volver
          </Button>

          <Button
            type="submit"
            size="sm"
            variant="danger"
            loading={resource.busy}
            disabled={
              blocked ||
              changed ||
              !canCancel ||
              !validQuantity ||
              !parsed.success ||
              (full && !confirmedFull)
            }
          >
            <Minus size={15} aria-hidden="true" />

            {full
              ? "Cancelar producto completo"
              : `Cancelar ${validQuantity ? amount : ""} ${
                  amount === 1 ? "unidad" : "unidades"
                }`}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
