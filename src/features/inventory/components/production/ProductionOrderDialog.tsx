import { useCallback, useState, useRef, useEffect } from "react";
import { useAppShell } from "../../../../app/layout/shell-context";
import { ApiError } from "../../../../lib/http/client";
import type { AuthSession } from "../../../auth/types/auth.types";
import { useInventoryQuery } from "../../hooks/useInventoryQuery";
import { Modal, Notice } from "../InventoryLocationUI";
import { Button } from "../InventoryButton";
import { orderResources } from "./production.queries";
import { saveOrder } from "./production.mutations";
import { errorText } from "./production.utils";
import { productionRoles, allowedActions } from "./production.access";
import { EditOrderForm } from "./EditOrderForm";
import { ExecutionForm } from "./ExecutionForm";
import { TransitionForm } from "./TransitionForm";
import { ProductionOrderDetail } from "./ProductionOrderDetail";
import type {
  Action,
  Order,
  Mutation,
  FormContext,
} from "./production.types";

export function ProductionOrderDialog({
  id,
  action,
  currency,
  zone,
  onClose,
  onSaved,
  onStale,
}: {
  id: string;
  action: Action;
  currency: string;
  zone: string;
  onClose: () => void;
  onSaved: (order: Order) => void;
  onStale: () => void;
}) {
  const { session } = useAppShell();
  const loader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      orderResources(current, signal, id),
    [id]
  );

  const query = useInventoryQuery(
    "production-order-action:" + id + ":" + action,
    loader,
    0,
    productionRoles
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const missingReported = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (
      !query.pending &&
      query.status === 404 &&
      !missingReported.current
    ) {
      missingReported.current = true;
      onStale();
    }
  }, [query.pending, query.status, onStale]);

  const close = () => {
    if (!lock.current) onClose();
  };

  async function commit(mutation: Mutation) {
    if (!query.data || lock.current || locked) return;

    lock.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();

    try {
      const updated = await saveOrder(
        session,
        controller.current.signal,
        query.data.order,
        mutation
      );
      onSaved(updated);
    } catch (caught) {
      if (controller.current.signal.aborted) return;
      let message = errorText(caught);

      if (caught instanceof ApiError) {
        if (caught.status === 409) {
          message +=
            "\nSe volverá a consultar la orden. Revisa sus datos y su versión antes de confirmar otra vez.";
          query.refresh();
          onStale();
        }

        if (caught.status === 404) {
          setLocked(true);
          onStale();
        }

        if (caught.status === 401 || caught.status === 403) {
          setLocked(true);
        }

        if (caught.status === 0 || caught.status >= 500) {
          setLocked(true);
          query.refresh();
          onStale();
          message +=
            "\nNo pudimos confirmar el resultado. No vuelvas a enviar esta operación sin revisar el estado y los desperdicios registrados.";
        }
      }

      setError(message);
    } finally {
      lock.current = false;
      if (!controller.current?.signal.aborted) setBusy(false);
    }
  }

  if (query.pending || query.error || !query.data) {
    return (
      <Modal title={"Orden OP-" + id} onClose={close}>
        {error && (
          <p
            role="alert"
            className="whitespace-pre-line text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <Notice>
          {query.pending
            ? "Consultando la versión vigente…"
            : query.error || "No hay datos de la orden."}
          {!query.pending && (
            <Button variant="secondary" onClick={query.refresh}>
              Reintentar
            </Button>
          )}
        </Notice>
      </Modal>
    );
  }

  const data = query.data;

  if (!allowedActions(session, data.order).includes(action)) {
    return (
      <Modal title={"Orden OP-" + id} onClose={close}>
        {error && (
          <p role="alert" className="whitespace-pre-line">
            {error}
          </p>
        )}
        <Notice>
          La acción ya no está disponible para el estado actual o para
          tus permisos.
        </Notice>
      </Modal>
    );
  }

  const context: FormContext = {
    data,
    currency,
    zone,
    busy,
    locked,
    error,
    onClose: close,
    commit,
  };
  const key = data.order.id + ":" + data.order.version;

  if (action === "edit") {
    return <EditOrderForm key={key} context={context} />;
  }

  if (action === "complete" || action === "waste") {
    return (
      <ExecutionForm key={key} context={context} action={action} />
    );
  }

  if (
    action === "plan" ||
    action === "start" ||
    action === "cancel"
  ) {
    return (
      <TransitionForm key={key} context={context} action={action} />
    );
  }

  return (
    <Modal
      title={
        (action === "movement"
          ? "Movimiento valorizado · OP-"
          : action === "performance"
            ? "Rendimiento · OP-"
            : "Detalle de producción · OP-") + id
      }
      wide
      onClose={close}
    >
      <ProductionOrderDetail
        data={data}
        currency={currency}
        zone={zone}
        movement={action === "movement"}
      />
    </Modal>
  );
}
