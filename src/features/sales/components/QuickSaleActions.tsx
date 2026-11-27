import { useCallback, useEffect, useRef, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { hasPermission } from "../../auth/utils/permissions";

import { useRemote, message } from "../hooks/usePublicOrders";

import type { SalesResource } from "../hooks/useSales";

import { cents, money, type Order } from "../schemas/sales.schema";

import type { SalesScope } from "../services/sales.service";

import { cachedPrepaidSale } from "../services/checkout.service";

import {
  advanceQuickSale,
  recoverQuickSale,
  quickSaleLabel,
} from "../services/quick-sale.service";

export function QuickSaleActions({
  order,
  scope,
  resource,
  onNew,
}: {
  order: Order;
  scope: SalesScope;
  resource: SalesResource;
  onNew: () => void;
}) {
  const { session } = useAppShell();

  const [error, setError] = useState("");
  const [physical, setPhysical] = useState(false);
  const [checking, setChecking] = useState(false);

  const lock = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async (signal: AbortSignal) =>
      order.status === "CLOSED"
        ? recoverQuickSale(session, scope, order.id, signal)
        : null,
    [session, scope, order.id, order.status]
  );

  const closed = useRemote(load);

  const sale =
    closed.data?.sale ?? cachedPrepaidSale(session, order.id);

  const summary = order.fulfillmentSummary;

  const manage = hasPermission(session, "orders.manage");

  const close = hasPermission(session, "orders.close");

  const blocked =
    resource.busy ||
    resource.loading ||
    resource.uncertain ||
    resource.accessLost ||
    !!resource.error ||
    checking;

  const blockingMessage = resource.accessLost
    ? "Se perdió el acceso a esta orden o al punto de venta."
    : resource.uncertain
      ? "Hay una operación pendiente de verificar. Actualiza la orden para consultar su resultado antes de continuar."
      : resource.error
        ? `No se puede confirmar mientras exista este error: ${resource.error}`
        : checking
          ? "Consultando el estado de la orden y procesando la operación…"
          : resource.busy
            ? "Hay otra operación en curso. Espera a que termine."
            : resource.loading
              ? "Actualizando los datos de la orden…"
              : "";

  const verified = order.paymentStatus === "VERIFIED";

  const mode =
    order.status === "OPEN"
      ? resource.kitchenSettings.data?.workflowMode
      : order.kitchenWorkflowMode;

  const prepare =
    order.status === "OPEN" &&
    !!summary &&
    (summary.requiresPreparation || mode !== "PRINT_ONLY");

  const canFinish =
    close &&
    (order.status === "DELIVERED" ||
      (manage &&
        mode === "PRINT_ONLY" &&
        (order.status === "CONFIRMED" ||
          (order.status === "OPEN" &&
            summary?.requiresPreparation === false))));

  const needsPhysical =
    order.status === "CONFIRMED" &&
    summary?.requiresPreparation === true;

  async function execute(recoverOnly = false, accepted = false) {
    if (import.meta.env.DEV) {
      console.debug("[Caja rápida] Clic recibido", {
        recoverOnly,
        locked: lock.current,
        busy: resource.busy,
        loading: resource.loading,
        uncertain: resource.uncertain,
        accessLost: resource.accessLost,
      });
    }
    if (
      lock.current ||
      resource.busy ||
      resource.uncertain ||
      resource.accessLost
    ) {
      return;
    }

    lock.current = true;

    setChecking(true);
    setError("");

    try {
      await resource.paymentOperation(async () => {
        if (import.meta.env.DEV) {
          console.debug("[Caja rápida] Operación iniciada");
        }

        try {
          if (recoverOnly) {
            await recoverQuickSale(
              session,
              scope,
              order.id,
              new AbortController().signal
            );
          } else {
            await advanceQuickSale(
              session,
              scope,
              order.id,
              prepare ? "prepare" : "finish",
              accepted,
              (result) => {
                const tickets = result.kitchenTickets.map(
                  (ticket) => ({
                    ...ticket,
                    orderId: result.order.id,
                    preparationAreaName: "Área de preparación",
                  })
                );

                resource.printing.remember(tickets);

                void resource.printing.sendAll(tickets);
              },
              new AbortController().signal
            );
          }

          if (alive.current) {
            setPhysical(false);
          }

          return "Estado de Caja rápida actualizado.";
        } catch (cause) {
          if (import.meta.env.DEV) {
            console.debug(
              "[Caja rápida] Operación interrumpida; se consultará el estado"
            );
          }

          let text = message(cause);

          try {
            const actual = await recoverQuickSale(
              session,
              scope,
              order.id,
              new AbortController().signal
            );

            text +=
              " Estado actual: " + quickSaleLabel(actual.order) + ".";
          } catch (recovery) {
            text +=
              " No pudimos verificar el resultado: " +
              message(recovery);
          }

          if (alive.current) {
            setError(text);
            setPhysical(false);
          }

          // El recurso refresca la orden.
          // No se repite ningún POST automáticamente.
          return text;
        }
      });
    } finally {
      lock.current = false;

      if (alive.current) {
        setChecking(false);
      }
    }
  }

  return (
    <section className="quick-sale-actions">
      {summary ? (
        <div className="preorder-banner">
          <strong>
            {summary.requiresPreparation
              ? "Requiere preparación"
              : "Entrega inmediata"}
          </strong>

          <p>
            {summary.readyToServeUnitCount} listas para servir ·{" "}
            {summary.prepareToOrderUnitCount} requieren preparación
          </p>
        </div>
      ) : (
        <p role="alert">
          Falta la clasificación de preparación de la API.
        </p>
      )}

      <strong>{quickSaleLabel(order)}</strong>

      {order.status === "CONFIRMED" && mode !== "PRINT_ONLY" && (
        <p>
          Completa la entrega desde la pantalla de cocina. Aquí podrás
          finalizar la venta después.
        </p>
      )}

      {order.status === "CONFIRMED" &&
        summary?.requiresPreparation && (
          <p>En preparación. El pago permanece verificado.</p>
        )}

      {order.status === "CLOSED" && (
        <div className="preorder-banner">
          {sale ? (
            <>
              <p>
                Venta #{sale.id} · Total {money(cents(sale.total))}
              </p>

              <p>
                {sale.payments
                  .map(
                    (payment) =>
                      payment.paymentMethodName +
                      " " +
                      money(cents(payment.amount))
                  )
                  .join(" · ")}
              </p>
            </>
          ) : (
            <p>
              {closed.loading
                ? "Consultando venta…"
                : "La orden está cerrada. El detalle de la venta no está disponible con este acceso."}
            </p>
          )}

          {closed.error && <p role="alert">{closed.error}</p>}

          <Button
            variant="soft"
            onClick={closed.reload}
            disabled={resource.busy}
          >
            Actualizar venta
          </Button>

          {manage && (
            <Button onClick={onNew} disabled={blocked}>
              Nueva venta rápida
            </Button>
          )}
        </div>
      )}

      {error && (
        <div role="alert">
          <p>{error}</p>

          <Button
            disabled={resource.busy}
            onClick={() => void execute(true)}
          >
            Reintentar consulta
          </Button>
        </div>
      )}

      {blockingMessage && (
        <div aria-live="polite">
          <p role={resource.error ? "alert" : "status"}>
            {blockingMessage}
          </p>

          {!resource.accessLost &&
            !resource.busy &&
            !resource.loading &&
            !checking &&
            (resource.uncertain || !!resource.error) && (
              <Button
                variant="secondary"
                onClick={() => resource.retry()}
              >
                Consultar estado de la orden
              </Button>
            )}
        </div>
      )}

      {resource.notice && (
        <p role="status" aria-live="polite">
          {resource.notice}
        </p>
      )}

      {verified && !!summary && !error && (
        <div className="sales-form-actions">
          {prepare && manage ? (
            <Button
              disabled={blocked}
              loading={checking}
              loadingText="Verificando y confirmando…"
              onClick={() => void execute()}
            >
              Confirmar y enviar a preparación
            </Button>
          ) : canFinish ? (
            <Button
              disabled={blocked}
              onClick={() =>
                needsPhysical ? setPhysical(true) : void execute()
              }
            >
              {order.status === "DELIVERED"
                ? "Finalizar venta"
                : "Entregar y finalizar venta"}
            </Button>
          ) : null}
        </div>
      )}

      {physical && (
        <BottomSheet
          id={"quick-deliver-" + order.id}
          open
          variant="modal"
          className="app-confirm-dialog"
          title="Confirmar entrega física"
          busy={resource.busy}
          onClose={() => setPhysical(false)}
        >
          <div className="mp-dialog-content">
            <p>
              ¿Confirmas que cocina ya entregó físicamente todos los
              productos?
            </p>

            <div className="sales-form-actions">
              <Button
                variant="secondary"
                disabled={blocked}
                onClick={() => setPhysical(false)}
              >
                Volver
              </Button>

              <Button
                disabled={blocked}
                onClick={() => void execute(false, true)}
              >
                Sí, entregar y finalizar venta
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </section>
  );
}
