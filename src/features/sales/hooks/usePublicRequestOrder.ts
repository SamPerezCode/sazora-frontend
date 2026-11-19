import { useCallback, useEffect, useRef, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { hasPermission } from "../../auth/utils/permissions";

import type { Order } from "../schemas/sales.schema";
import type { RequestAction } from "../schemas/public-orders.schema";
import { orderResponse } from "../schemas/public-orders.schema";

import {
  readRequest,
  changeRequest,
} from "../services/public-orders.service";

import {
  assertOrderScope,
  getOrder,
  confirmSalesOrder,
  cancelOrder,
  type SalesScope,
} from "../services/sales.service";

import {
  readPreorderPayment,
  type PreorderPaymentBatch,
} from "../services/preorder-payments.service";

import {
  getOrderKitchenHistory,
  type OrderKitchenHistory,
} from "../services/sales-history.service";

import { usePublicRequestsRealtime } from "./usePublicRequestsRealtime";

type Snapshot = Awaited<ReturnType<typeof readRequest>> & {
  payment: PreorderPaymentBatch | null;
  paymentError: string;
  history: OrderKitchenHistory | null;
  historyError: string;
};

const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "No se pudo completar la operación.";

function scopeOf(order: Order, businessId: string): SalesScope {
  const scope = {
    businessId,
    location: order.location,
  };

  assertOrderScope(order, scope);

  if (
    order.location.id !== order.locationId ||
    order.location.locationType !== "POINT_OF_SALE" ||
    order.serviceType === "TABLE"
  ) {
    throw new Error("La orden no corresponde a esta solicitud.");
  }

  return scope;
}

export function usePublicRequestOrder(
  id: string,
  paused: boolean,
  saved: (message: string) => void
) {
  const { session } = useAppShell();

  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [createdId, setCreatedId] = useState<string | null>(null);

  const alive = useRef(false);
  const writing = useRef(false);
  const reader = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    reader.current?.abort();

    const controller = new AbortController();
    reader.current = controller;
    setLoading(true);

    try {
      if (!hasPermission(session, "public_orders.read")) {
        throw new Error(
          "No tienes permiso para consultar solicitudes."
        );
      }

      const related = await readRequest(
        id,
        session.accessToken,
        controller.signal,
        hasPermission(session, "orders.read")
      );

      const order = related.order;
      const scope = order
        ? scopeOf(order, session.business.id)
        : null;

      if (
        order &&
        (order.locationId !== related.request.locationId ||
          order.serviceType !== related.request.serviceType)
      ) {
        throw new Error("El pedido no corresponde a la solicitud.");
      }

      const [payment, history] = await Promise.allSettled([
        order && hasPermission(session, "orders.payments.read")
          ? readPreorderPayment(session, order.id, controller.signal)
          : Promise.resolve(null),

        order &&
        scope &&
        ["CONFIRMED", "DELIVERED", "CLOSED"].includes(order.status)
          ? getOrderKitchenHistory(
              session.accessToken,
              scope,
              order.id,
              controller.signal
            )
          : Promise.resolve(null),
      ]);

      if (!alive.current || controller.signal.aborted) {
        return false;
      }

      setData({
        ...related,

        payment:
          payment.status === "fulfilled" ? payment.value : null,

        paymentError:
          payment.status === "rejected"
            ? message(payment.reason)
            : "",

        history:
          history.status === "fulfilled" ? history.value : null,

        historyError:
          history.status === "rejected"
            ? message(history.reason)
            : "",
      });

      setError("");
      return true;
    } catch (cause) {
      if (alive.current && !controller.signal.aborted) {
        setError(message(cause));
      }

      return false;
    } finally {
      if (alive.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [id, session]);

  useEffect(() => {
    alive.current = true;

    const timer = window.setTimeout(() => void reload(), 0);

    return () => {
      window.clearTimeout(timer);
      alive.current = false;
      reader.current?.abort();
    };
  }, [reload]);

  const refreshIfIdle = useCallback(() => {
    if (
      !writing.current &&
      !paused &&
      document.visibilityState === "visible"
    ) {
      void reload();
    }
  }, [paused, reload]);

  usePublicRequestsRealtime(session, refreshIfIdle);

  useEffect(() => {
    const timer = window.setInterval(refreshIfIdle, 15000);

    window.addEventListener("focus", refreshIfIdle);
    document.addEventListener("visibilitychange", refreshIfIdle);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfIdle);
      document.removeEventListener("visibilitychange", refreshIfIdle);
    };
  }, [refreshIfIdle]);

  async function run(work: () => Promise<string>): Promise<boolean> {
    if (writing.current) return false;

    writing.current = true;
    reader.current?.abort();

    setBusy(true);
    setError("");
    setNotice("");

    let ok = false;
    let feedback: string;

    try {
      feedback = await work();
      ok = true;
    } catch (cause) {
      feedback = message(cause);
    }

    const refreshed = alive.current ? await reload() : false;

    if (alive.current) {
      setNotice(feedback);

      if (!ok) {
        setError(feedback);
      }

      setBusy(false);
      saved(feedback);
    }

    writing.current = false;
    return ok && refreshed;
  }

  async function act(action: RequestAction, reason?: string) {
    if (
      !data ||
      loading ||
      error ||
      createdId ||
      data.request.orderId ||
      !["NEW", "CONTACTED"].includes(data.request.status) ||
      !hasPermission(session, "public_orders.manage")
    ) {
      return false;
    }

    return run(async () => {
      const result = await changeRequest(
        id,
        action,
        session.accessToken,
        new AbortController().signal,
        reason
      );

      if (result.data.request.id !== id) {
        throw new Error("Solicitud incorrecta.");
      }

      if (action === "accept") {
        const accepted = orderResponse.parse(result).data;

        scopeOf(accepted.order, session.business.id);

        if (alive.current) {
          setCreatedId(accepted.order.id);
        }

        return "Pedido creado · Pendiente de pago.";
      }

      return action === "contact"
        ? "Solicitud contactada."
        : "Solicitud rechazada.";
    });
  }

  async function operate(action: "confirm" | "cancel", reason = "") {
    const order = data?.order;

    if (!order || loading || error) return false;

    const permission =
      action === "confirm" ? "orders.manage" : "orders.cancel";

    if (!hasPermission(session, permission)) {
      return false;
    }

    const scope = scopeOf(order, session.business.id);

    return run(async () => {
      const current = await getOrder(
        session.accessToken,
        order.id,
        scope
      );

      if (current.id !== order.id) {
        throw new Error("Pedido incorrecto.");
      }

      if (action === "confirm") {
        if (
          ["CONFIRMED", "DELIVERED", "CLOSED"].includes(
            current.status
          )
        ) {
          return "El pedido ya estaba confirmado.";
        }

        if (
          current.status !== "OPEN" ||
          current.paymentStatus !== "VERIFIED"
        ) {
          throw new Error(
            "El pedido debe estar abierto y con pago verificado."
          );
        }

        await confirmSalesOrder(session.accessToken, order.id, scope);
      } else {
        if (current.status === "CANCELLED") {
          return "El pedido ya estaba cancelado.";
        }

        const clean = reason.trim();

        if (clean.length < 3 || clean.length > 500) {
          throw new Error(
            "El motivo debe contener entre 3 y 500 caracteres."
          );
        }

        if (
          !(
            (current.status === "OPEN" &&
              current.paymentStatus === "PENDING") ||
            (["OPEN", "CONFIRMED"].includes(current.status) &&
              current.paymentStatus === "REFUNDED")
          )
        ) {
          throw new Error(
            "Primero debes devolver el pago y verificar que el pedido todavía pueda cancelarse."
          );
        }

        if (current.status === "CONFIRMED") {
          const history = await getOrderKitchenHistory(
            session.accessToken,
            scope,
            order.id,
            new AbortController().signal
          );

          if (
            history.tickets.some((ticket) =>
              ticket.items.some(
                (item) => item.preparationStatus === "DELIVERED"
              )
            )
          ) {
            throw new Error(
              "La orden tiene productos entregados y no puede cancelarse completamente."
            );
          }
        }

        await cancelOrder(session.accessToken, order.id, clean);
      }

      const updated = await getOrder(
        session.accessToken,
        order.id,
        scope
      );

      if (
        action === "cancel"
          ? updated.status !== "CANCELLED"
          : !["CONFIRMED", "DELIVERED", "CLOSED"].includes(
              updated.status
            )
      ) {
        throw new Error(
          "La operación fue recibida. Consulta el estado antes de repetirla."
        );
      }

      return action === "confirm"
        ? "Pedido confirmado y enviado a cocina."
        : "Pedido cancelado.";
    });
  }

  return {
    data,
    loading,
    busy,
    error,
    notice,
    createdId,
    reload,
    act,
    operate,
    paymentOperation: (work: () => Promise<string>) => run(work),
  };
}
