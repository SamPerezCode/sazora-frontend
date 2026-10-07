import { Ban, Check, Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { KitchenNotice } from "../schemas/kitchen.schema";

export function KitchenAdditionAlert({
  notice,
  onDismiss,
}: {
  notice: KitchenNotice;
  onDismiss: () => void;
}) {
  return (
    <div className="kitchen-addition">
      <Plus size={14} />

      <span>Nueva adición · Orden #{notice.orderId}</span>

      <button
        type="button"
        aria-label="Cerrar aviso de adición"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function KitchenCancellationAlert({
  notice,
  onDismiss,
}: {
  notice: KitchenNotice;
  onDismiss: () => void;
}) {
  return (
    <article className="kitchen-cancellation">
      <h3>
        <Ban size={16} />

        {notice.kind === "order-cancelled"
          ? "Orden cancelada"
          : "Producto cancelado"}
      </h3>

      <p>
        {notice.label} · Orden #{notice.orderId}
        {notice.ticketId && ` · Comanda #${notice.ticketId}`}
      </p>

      {notice.productName && (
        <p>
          <s>
            {notice.quantity} × {notice.productName}
          </s>
        </p>
      )}

      {notice.reason && <p>Motivo: {notice.reason}</p>}

      <Button size="sm" variant="danger" onClick={onDismiss}>
        <Check size={14} />
        Entendido
      </Button>
    </article>
  );
}

export function KitchenAlerts({
  notices,
  area,
  dismiss,
}: {
  notices: KitchenNotice[];
  area: string;
  dismiss: (id: string) => void;
}) {
  const visible = notices.filter(
    (notice) => !area || !notice.areaId || notice.areaId === area
  );

  const additions = visible.filter(
    (notice) => notice.kind === "addition"
  );

  const cancellations = visible.filter(
    (notice) => notice.kind !== "addition"
  );

  return (
    <>
      {!!additions.length && (
        <div
          className="kitchen-additions"
          aria-label="Nuevas adiciones"
        >
          {additions.map((notice) => (
            <KitchenAdditionAlert
              key={notice.id}
              notice={notice}
              onDismiss={() => dismiss(notice.id)}
            />
          ))}
        </div>
      )}

      {!!cancellations.length && (
        <section
          aria-label="Avisos de cancelación"
          aria-live="polite"
        >
          <h2 className="kitchen-cancellation-title">
            Avisos de cancelación
          </h2>

          <div className="kitchen-cancellations">
            {cancellations.map((notice) => (
              <KitchenCancellationAlert
                key={notice.id}
                notice={notice}
                onDismiss={() => dismiss(notice.id)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
