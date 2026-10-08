import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../lib/http/client";
import { isOperationalOrder } from "../utils/sales-board";

import {
  cancelOrder as cancelOrderRequest,
  cancelOrderItem,
  createOrder,
  getOrder,
  getSales,
  writeOrder,
} from "../services/sales.service";

import type { SalesData } from "../services/sales.service";

import type {
  Draft,
  LocalOrderDraft,
  Order,
  OrderInput,
} from "../schemas/sales.schema";

import { useAppShell } from "../../../app/layout/shell-context";
import { useAuth } from "../../auth/hooks/useAuth";

import { acquireSessionSocket } from "../../../lib/realtime/session-socket";
import type { ConnectionStatus } from "../../../lib/realtime/session-socket";

import {
  cancelQuantityInputSchema,
  quantityCancelledEventSchema,
  quantityChangeKey,
  quantityRecovery,
} from "../../../lib/orders/quantity-cancellation";

import type {
  QuantityCancellationResult,
  QuantityCancelledEvent,
} from "../../../lib/orders/quantity-cancellation";

import { cancelOrderItemQuantity } from "../services/sales.service";

class RecoveryError extends Error {}

export type CancellationResult = {
  ok: boolean;
  message?: string;
  reason?: string;
};

const messageOf = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "No fue posible completar la operación.";

const isUnknown = (cause: unknown) =>
  !(cause instanceof ApiError) ||
  cause.status === 0 ||
  cause.status >= 500;

const confirmationMessages: Record<string, string> = {
  ORDER_HAS_NO_ITEMS:
    "La orden no contiene productos y no puede confirmarse.",
  PREPARATION_AREA_INACTIVE:
    "Uno de los productos pertenece a un área de preparación desactivada. Revisa la configuración antes de reintentar.",
  INVENTORY_ITEM_NOT_AVAILABLE:
    "Uno de los artículos de inventario asociado al pedido no existe o está desactivado.",
};

export function useSales(token: string) {
  const { session } = useAppShell();
  const { logout } = useAuth();

  const businessId = session.business.id;
  const membershipId = session.membership.id;
  const userId = session.user.id;

  const ownQuantityChanges = useRef(new Set<string>());
  const [data, setData] = useState<SalesData | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useRef<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const [localDrafts, setLocalDrafts] = useState<
    Record<string, LocalOrderDraft>
  >({});

  const [localKey, setLocalKey] = useState<string | null>(null);
  const currentLocal = useRef<string | null>(null);

  const [confirmationIds, setConfirmationIds] = useState<
    Record<string, true>
  >({});

  const [cancellationIds, setCancellationIds] = useState<
    Record<string, true>
  >({});

  const [deliveredIds, setDeliveredIds] = useState<
    Record<string, true>
  >({});

  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [needsWriteVerification, setNeedsWriteVerification] =
    useState(false);

  const locked = useRef(false);
  const uncertainBatch = useRef<string | null>(null);
  const pendingRecovery = useRef<(() => Promise<string>) | null>(
    null
  );
  const alive = useRef(false);
  const reader = useRef<AbortController | null>(null);

  const forgetOrder = useCallback((id: string) => {
    if (selected.current === id) {
      selected.current = null;
      setSelectedId(null);
    }

    setDrafts((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setConfirmationIds((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setCancellationIds((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setData((previous) =>
      previous
        ? {
            ...previous,
            order: previous.order?.id === id ? null : previous.order,
            orders: previous.orders.filter(
              (order) => order.id !== id
            ),
            tickets: previous.tickets.filter(
              (ticket) => ticket.orderId !== id
            ),
          }
        : previous
    );
  }, []);

  function clearConfirmation(id: string) {
    setConfirmationIds((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function clearCancellation(id: string) {
    setCancellationIds((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function acceptOrder(order: Order) {
    if (!isOperationalOrder(order)) {
      forgetOrder(order.id);
      return;
    }

    if (order.status !== "OPEN") {
      clearConfirmation(order.id);
    }

    setData((previous) =>
      previous
        ? {
            ...previous,
            order:
              selected.current === order.id ? order : previous.order,
            orders: previous.orders.map((entry) =>
              entry.id === order.id ? { ...entry, ...order } : entry
            ),
          }
        : previous
    );
  }

  const refresh = useCallback(async () => {
    reader.current?.abort();

    const controller = new AbortController();
    reader.current = controller;

    try {
      const next = await getSales(
        token,
        selected.current,
        controller.signal
      );

      if (!alive.current || controller.signal.aborted) {
        return false;
      }

      const detail = next.order;

      if (detail && detail.status !== "OPEN") {
        setConfirmationIds((previous) => {
          const remaining = { ...previous };
          delete remaining[detail.id];
          return remaining;
        });
      }

      if (detail && !isOperationalOrder(detail)) {
        forgetOrder(detail.id);

        setData({
          ...next,
          order: null,
          orders: next.orders.filter(
            (order) => order.id !== detail.id
          ),
          tickets: next.tickets.filter(
            (ticket) => ticket.orderId !== detail.id
          ),
        });

        setNotice(
          detail.status === "CANCELLED"
            ? "Orden cancelada correctamente."
            : "La cuenta ya no está activa."
        );
      } else {
        setData(next);
      }

      setError("");

      return true;
    } catch (cause) {
      if (!alive.current || controller.signal.aborted) {
        return false;
      }

      if (
        cause instanceof ApiError &&
        cause.code === "ORDER_NOT_FOUND" &&
        selected.current
      ) {
        forgetOrder(selected.current);
      }

      setError(messageOf(cause));

      return false;
    } finally {
      if (alive.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, forgetOrder]);

  useEffect(() => {
    alive.current = true;

    const update = () => {
      if (!locked.current && document.visibilityState === "visible") {
        void refresh();
      }
    };

    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 15000);

    window.addEventListener("focus", update);

    return () => {
      alive.current = false;
      reader.current?.abort();

      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);

  useEffect(() => {
    let live = true;
    let flushing = false;
    let requested = false;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const queue = new Map<string, QuantityCancelledEvent>();
    const seen = new Set<string>();

    const lease = acquireSessionSocket({
      accessToken: token,
      businessId,
      membershipId,
      userId,
    });

    function schedule() {
      clearTimeout(timer);

      timer = setTimeout(() => {
        void flush();
      }, 300);
    }

    async function flush() {
      if (!live) return;

      if (locked.current || flushing) {
        schedule();
        return;
      }

      if (!requested && !queue.size) return;

      flushing = true;
      requested = false;

      const events = [...queue.entries()];
      queue.clear();

      const updated = await refresh();

      if (live) {
        const external = events.filter(
          ([key]) => !ownQuantityChanges.current.has(key)
        );

        if (external.length) {
          setNotice(
            external.length === 1
              ? `Cantidad modificada · Orden #${external[0][1].orderId}.${
                  updated ? "" : " Falta actualizar la cuenta."
                }`
              : `Se modificaron cantidades en ${
                  external.length
                } productos.${
                  updated ? "" : " Falta actualizar la cuenta."
                }`
          );
        }

        flushing = false;

        if (requested || queue.size) {
          schedule();
        }
      }
    }

    function receive(raw: unknown) {
      if (!live || lease.getStatus() !== "connected") return;

      const parsed = quantityCancelledEventSchema.safeParse(raw);

      if (!parsed.success || parsed.data.businessId !== businessId) {
        return;
      }

      const key = quantityChangeKey(parsed.data);

      if (seen.has(key)) return;

      seen.add(key);

      if (seen.size > 500) {
        seen.delete(seen.values().next().value!);
      }

      if (ownQuantityChanges.current.has(key)) return;

      queue.set(key, parsed.data);
      requested = true;

      if (!locked.current) {
        reader.current?.abort();
      }

      schedule();
    }

    function connectionChanged(status: ConnectionStatus) {
      if (status === "rejected") {
        logout();
      } else if (status === "connected") {
        requested = true;
        schedule();
      }
    }

    lease.socket.on("order:item-quantity-cancelled", receive);

    const unsubscribe = lease.subscribe(connectionChanged);

    connectionChanged(lease.getStatus());

    return () => {
      live = false;
      clearTimeout(timer);

      lease.socket.off("order:item-quantity-cancelled", receive);

      unsubscribe();
      lease.release();
    };
  }, [token, businessId, membershipId, userId, refresh, logout]);

  function closeLocal() {
    const key = currentLocal.current;

    if (key) {
      setLocalDrafts((previous) => {
        if (Object.keys(previous[key]?.items ?? {}).length) {
          return previous;
        }

        const next = { ...previous };
        delete next[key];
        return next;
      });
    }

    currentLocal.current = null;
    setLocalKey(null);
  }

  function discardLocal() {
    const key = currentLocal.current;

    if (locked.current || uncertain || !key) return;

    reader.current?.abort();

    setLocalDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });

    currentLocal.current = null;
    setLocalKey(null);

    selected.current = null;
    setSelectedId(null);

    setNotice("Borrador descartado. No se creó ninguna orden.");
  }

  function discardAdditions(id: string) {
    if (
      locked.current ||
      uncertain ||
      cancellationIds[id] ||
      selected.current !== id
    ) {
      return;
    }

    setDrafts((previous) => ({
      ...previous,
      [id]: {},
    }));

    setNotice(
      "Adiciones descartadas. Los productos confirmados no cambiaron."
    );
  }

  function select(id: string | null) {
    if (locked.current) return;

    reader.current?.abort();
    closeLocal();

    selected.current = id;
    setSelectedId(id);
    setNotice("");

    if (id) {
      void refresh();
    }
  }

  function start(input: OrderInput) {
    if (
      locked.current ||
      uncertain ||
      error ||
      !data ||
      input.serviceType === "DELIVERY"
    ) {
      return;
    }

    if (input.serviceType === "TABLE") {
      const existing = data.orders.find(
        (order) =>
          order.serviceType === "TABLE" &&
          order.restaurantTableId === input.restaurantTableId
      );

      if (existing) {
        return select(existing.id);
      }

      if (
        !data.tables.some(
          (table) =>
            table.id === input.restaurantTableId && table.isActive
        )
      ) {
        setNotice("Esta mesa ya no está disponible.");
        return;
      }
    }

    reader.current?.abort();
    closeLocal();

    const key =
      input.serviceType === "TABLE"
        ? `table:${input.restaurantTableId}`
        : "takeaway";

    setLocalDrafts((previous) => ({
      ...previous,
      [key]: previous[key] ?? {
        ...input,
        restaurantTableId:
          input.serviceType === "TABLE"
            ? input.restaurantTableId
            : null,
        customerCount:
          input.serviceType === "TABLE" ? input.customerCount : null,
        items: {},
      },
    }));

    currentLocal.current = key;
    setLocalKey(key);

    selected.current = null;
    setSelectedId(null);

    setNotice("");
  }

  function updateLocal(input: OrderInput) {
    const key = currentLocal.current;
    const draft = key ? localDrafts[key] : null;

    if (locked.current || uncertain || !key || !draft) {
      return false;
    }

    if (
      input.serviceType !== draft.serviceType ||
      input.restaurantTableId !== draft.restaurantTableId
    ) {
      return false;
    }

    setLocalDrafts((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        ...input,
      },
    }));

    return true;
  }

  function setDraft(id: string | null, draft: Draft) {
    if (locked.current || uncertain) return;

    const key = currentLocal.current;

    if (!id && key) {
      setLocalDrafts((previous) => ({
        ...previous,
        [key]: {
          ...previous[key],
          items: draft,
        },
      }));
    } else if (
      id &&
      !confirmationIds[id] &&
      !cancellationIds[id] &&
      data?.order?.id === id &&
      ["OPEN", "CONFIRMED"].includes(data.order.status)
    ) {
      setDrafts((previous) => ({
        ...previous,
        [id]: draft,
      }));
    }
  }

  async function recoverWrite(recovery: () => Promise<string>) {
    pendingRecovery.current = recovery;
    setNeedsWriteVerification(true);

    try {
      const message = await recovery();

      pendingRecovery.current = null;
      setNeedsWriteVerification(false);
      setUncertain(false);

      return { ok: true, message };
    } catch (cause) {
      // RecoveryError significa que el detalle sí permitió decidir.
      if (cause instanceof RecoveryError) {
        pendingRecovery.current = null;
        setNeedsWriteVerification(false);
        setUncertain(false);
      } else {
        setUncertain(true);
      }

      return {
        ok: false,
        message:
          messageOf(cause) +
          (cause instanceof RecoveryError
            ? ""
            : " No pudimos verificar la operación. Usa Verificar operación antes de volver a intentarla."),
      };
    }
  }

  async function run(
    work: () => Promise<string | void>,
    success: string,
    sendOperation = false,
    recovery?: () => Promise<string>
  ) {
    if (locked.current || uncertain) return false;

    locked.current = true;
    reader.current?.abort();

    setBusy(true);
    setSending(sendOperation);
    setNotice("");

    let ok = false;
    let message: string;

    try {
      message = (await work()) ?? success;
      ok = true;
    } catch (cause) {
      if (
        recovery &&
        !(cause instanceof RecoveryError) &&
        isUnknown(cause)
      ) {
        const recovered = await recoverWrite(recovery);

        ok = recovered.ok;
        message = recovered.message;
      } else {
        if (!(cause instanceof RecoveryError) && isUnknown(cause)) {
          setUncertain(true);
        }

        message = messageOf(cause);
      }
    }

    const updated = alive.current ? await refresh() : false;

    if (alive.current) {
      setNotice(
        [
          message,
          ok && !updated ? "Falta actualizar la pantalla." : "",
        ]
          .filter(Boolean)
          .join(" ")
      );

      setBusy(false);
      setSending(false);
    }

    locked.current = false;

    return ok;
  }

  async function readOrder(id: string) {
    try {
      const order = await getOrder(token, id);

      acceptOrder(order);

      return order;
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.code === "ORDER_NOT_FOUND"
      ) {
        forgetOrder(id);

        throw new RecoveryError(
          "La orden ya no existe o no pertenece a este negocio."
        );
      }

      throw cause;
    }
  }

  async function confirm(id: string) {
    setConfirmationIds((previous) => ({
      ...previous,
      [id]: true,
    }));

    try {
      await writeOrder(token, `/orders/${id}/confirm`, "POST");

      clearConfirmation(id);

      return "Pedido enviado correctamente.";
    } catch (cause) {
      let order;

      try {
        order = await readOrder(id);
      } catch (checkError) {
        if (checkError instanceof RecoveryError) {
          throw checkError;
        }

        throw new RecoveryError(
          "No fue posible verificar el estado de la orden. No la crees nuevamente. Actualiza la información o intenta verificarla otra vez."
        );
      }

      if (order.status === "CANCELLED") {
        return "Orden cancelada correctamente.";
      }

      if (order.status !== "OPEN") {
        return "El pedido ya había sido confirmado correctamente.";
      }

      const detail =
        cause instanceof ApiError
          ? (confirmationMessages[cause.code] ?? cause.message)
          : messageOf(cause);

      throw new RecoveryError(
        "La orden fue guardada, pero no pudo confirmarse. Puedes intentar enviarla nuevamente o cancelar la orden pendiente. " +
          detail
      );
    }
  }

  function retryConfirmation() {
    const id = selected.current;

    if (!id || cancellationIds[id]) {
      return Promise.resolve(false);
    }

    return run(
      async () => {
        let order;

        try {
          order = await readOrder(id);
        } catch (cause) {
          if (!(cause instanceof RecoveryError)) {
            setConfirmationIds((previous) => ({
              ...previous,
              [id]: true,
            }));
          }

          throw new RecoveryError(
            cause instanceof RecoveryError
              ? cause.message
              : "No fue posible verificar el estado de la orden. No la crees nuevamente; vuelve a verificar."
          );
        }

        if (order.status === "OPEN") {
          return confirm(id);
        }

        return order.status === "CANCELLED"
          ? "Orden cancelada correctamente."
          : "El pedido ya había sido confirmado correctamente.";
      },
      "Estado actualizado.",
      true
    );
  }

  async function checkCancellation(id: string) {
    try {
      const order = await readOrder(id);

      clearCancellation(id);

      return order;
    } catch (cause) {
      if (cause instanceof RecoveryError) {
        throw cause;
      }

      setCancellationIds((previous) => ({
        ...previous,
        [id]: true,
      }));

      throw new RecoveryError(
        "No fue posible verificar la cancelación. Consulta nuevamente la orden antes de repetir la operación."
      );
    }
  }

  function verifyCancellation() {
    const id = selected.current;

    if (!id) return Promise.resolve(false);

    return run(async () => {
      const order = await checkCancellation(id);

      return order.status === "CANCELLED"
        ? "Orden cancelada correctamente."
        : "Estado actualizado. Revisa la orden antes de volver a cancelar.";
    }, "Estado actualizado.");
  }

  async function cancelOrder(
    id: string,
    reason: string,
    expectedStatus: "OPEN" | "CONFIRMED"
  ): Promise<CancellationResult> {
    const clean = reason.trim();

    if (clean.length < 3 || clean.length > 500) {
      return {
        ok: false,
        reason: "El motivo debe contener entre 3 y 500 caracteres.",
      };
    }

    if (locked.current || uncertain || selected.current !== id) {
      return { ok: false };
    }

    let result: CancellationResult = { ok: false };

    await run(async () => {
      const current = await checkCancellation(id);

      if (current.status === "CANCELLED") {
        result = { ok: true };
        return "Orden cancelada correctamente.";
      }

      if (current.status !== expectedStatus) {
        result = {
          ok: false,
          message:
            "La orden cambió de estado. Revisa la información antes de cancelar.",
        };

        throw new RecoveryError(result.message);
      }

      try {
        const response = await cancelOrderRequest(token, id, clean);

        forgetOrder(response.order.id);

        result = { ok: true };

        return "Orden cancelada correctamente.";
      } catch (cause) {
        if (
          cause instanceof ApiError &&
          cause.code === "VALIDATION_ERROR"
        ) {
          const reasonError = cause.errors.find(
            (entry) => entry.field === "reason"
          )?.message;

          result = {
            ok: false,
            reason: reasonError ?? cause.message,
          };

          throw new RecoveryError(cause.message);
        }

        if (
          cause instanceof ApiError &&
          cause.code === "ORDER_NOT_FOUND"
        ) {
          forgetOrder(id);

          throw new RecoveryError(
            "La orden ya no existe o no pertenece a este negocio."
          );
        }

        if (
          cause instanceof ApiError &&
          cause.code === "ORDER_HAS_DELIVERED_ITEMS"
        ) {
          setDeliveredIds((previous) => ({
            ...previous,
            [id]: true,
          }));

          throw new RecoveryError(
            "No se puede cancelar toda la orden porque ya tiene productos entregados. Cancela individualmente los productos que todavía estén pendientes."
          );
        }

        if (cause instanceof ApiError && cause.status === 401) {
          throw cause;
        }

        if (
          isUnknown(cause) ||
          (cause instanceof ApiError &&
            cause.code === "ORDER_NOT_CANCELLABLE")
        ) {
          const order = await checkCancellation(id);

          if (order.status === "CANCELLED") {
            result = { ok: true };
            return "Orden cancelada correctamente.";
          }

          throw new RecoveryError(
            ["OPEN", "CONFIRMED"].includes(order.status)
              ? "La orden continúa activa. Puedes revisar el motivo y volver a intentar la cancelación."
              : "La orden cambió de estado y ya no puede cancelarse."
          );
        }

        throw cause;
      }
    }, "Orden cancelada correctamente.");

    return result;
  }

  function action(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown
  ) {
    const id = selected.current;

    if (!id || confirmationIds[id] || cancellationIds[id] || error) {
      return Promise.resolve(false);
    }

    const order = data?.order;

    if (!order || order.id !== id) {
      return Promise.resolve(false);
    }

    const closing =
      method === "POST" && path === `/orders/${id}/close`;

    if (closing && order.status !== "DELIVERED") {
      return Promise.resolve(false);
    }

    if (closing && Object.keys(drafts[id] ?? {}).length > 0) {
      setNotice(
        "Hay adiciones locales sin enviar. Revísalas y descártalas antes de cerrar la cuenta."
      );

      return Promise.resolve(false);
    }

    const itemCancellation =
      method === "POST"
        ? path.match(
            /^\/orders\/([1-9]\d*)\/items\/([1-9]\d*)\/cancel$/
          )
        : null;

    if (itemCancellation && itemCancellation[1] !== id) {
      return Promise.resolve(false);
    }

    const recovery =
      closing || itemCancellation
        ? async (): Promise<string> => {
            const current = await readOrder(id);

            if (closing) {
              if (current.status === "CLOSED") {
                return "Cuenta cerrada.";
              }

              if (current.status === "CANCELLED") {
                return "La orden ya está cancelada.";
              }

              throw new RecoveryError(
                "La cuenta todavía no está cerrada. Revisa su estado antes de volver a intentar el cierre."
              );
            }

            if (current.status === "CANCELLED") {
              return "Orden cancelada correctamente.";
            }

            const item = current.items.find(
              (entry) => entry.id === itemCancellation![2]
            );

            if (item?.status === "CANCELLED") {
              return current.status === "DELIVERED" ||
                current.status === "CLOSED"
                ? ""
                : "Producto cancelado correctamente.";
            }

            if (current.status === "CLOSED") {
              throw new RecoveryError(
                "La cuenta ya está cerrada y no puede modificarse."
              );
            }

            throw new RecoveryError(
              item
                ? "El producto sigue activo. Revisa su estado antes de volver a intentar la cancelación."
                : "El producto no aparece en el detalle actualizado. Revisa la cuenta antes de continuar."
            );
          }
        : undefined;

    return run(
      async () => {
        if (itemCancellation) {
          const reason =
            body && typeof body === "object" && "reason" in body
              ? body.reason
              : null;

          if (typeof reason !== "string") {
            throw new RecoveryError(
              "Escribe el motivo de cancelación."
            );
          }

          const cancellation = await cancelOrderItem(
            token,
            id,
            itemCancellation[2],
            reason
          );

          if (cancellation.orderStatus === "CANCELLED") {
            forgetOrder(id);
            return "Orden cancelada correctamente.";
          }

          acceptOrder({
            ...order,
            status: cancellation.orderStatus,
            items: order.items.map((item) =>
              item.id === cancellation.orderItemId
                ? {
                    ...item,
                    status: "CANCELLED",
                    cancellationReason:
                      cancellation.cancellationReason,
                  }
                : item
            ),
          });

          return cancellation.orderStatus === "DELIVERED"
            ? ""
            : "Producto cancelado correctamente.";
        }

        await writeOrder(token, path, method, body);

        if (closing) {
          forgetOrder(id);
        }
      },
      closing ? "Cuenta cerrada." : "Cambios guardados.",
      false,
      recovery
    );
  }

  async function cancelUnits(
    itemId: string,
    quantity: number,
    reason: string
  ): Promise<QuantityCancellationResult> {
    const order = data?.order;
    const id = selected.current;

    const item = order?.items.find((entry) => entry.id === itemId);

    const preparation = data?.tickets
      .filter((ticket) => ticket.orderId === id)
      .flatMap((ticket) => ticket.items)
      .find((entry) => entry.orderItemId === itemId);

    if (
      locked.current ||
      uncertain ||
      error ||
      !id ||
      confirmationIds[id] ||
      cancellationIds[id]
    ) {
      return {
        ok: false,
        message: "Espera a que la cuenta esté actualizada.",
      };
    }

    if (
      !order ||
      order.id !== id ||
      order.status !== "CONFIRMED" ||
      item?.status !== "ACTIVE" ||
      !preparation ||
      !["PENDING", "IN_PREPARATION", "READY"].includes(
        preparation.preparationStatus
      )
    ) {
      await refresh();

      return {
        ok: false,
        close: true,
        message: "Este producto ya no puede cancelarse.",
      };
    }

    const parsed = cancelQuantityInputSchema.safeParse({
      quantity,
      reason,
    });

    if (!parsed.success) {
      const fields: QuantityCancellationResult["fields"] = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === "quantity" || field === "reason") {
          fields[field] = issue.message;
        }
      }

      return { ok: false, fields };
    }

    if (quantity >= item.quantity) {
      return {
        ok: false,
        offerFull: quantity === item.quantity,
        fields: {
          quantity:
            "Para retirar todas las unidades, confirma la cancelación completa.",
        },
      };
    }

    const previousQuantity = item.quantity;

    const success = `Se cancel${
      quantity === 1 ? "ó 1 unidad" : `aron ${quantity} unidades`
    } de ${item.productName}.`;

    const result: QuantityCancellationResult = {
      ok: false,
    };

    const recovery = async (): Promise<string> => {
      const current = await readOrder(id);

      const currentItem = current.items.find(
        (entry) => entry.id === itemId
      );

      const outcome = quantityRecovery(
        currentItem,
        previousQuantity,
        quantity
      );

      if (outcome === "applied") {
        return success;
      }

      if (outcome === "cancelled") {
        result.close = true;

        return "El producto fue cancelado completamente. La cuenta se actualizó.";
      }

      result.close =
        outcome === "missing" || current.status !== "CONFIRMED";

      result.message =
        outcome === "unchanged"
          ? "La cantidad continúa igual. Revisa la cuenta antes de volver a intentarlo."
          : "La cantidad cambió en otro dispositivo. Revisa la cantidad actual antes de continuar.";

      throw new RecoveryError(result.message);
    };

    const ok = await run(
      async () => {
        try {
          const adjustment = await cancelOrderItemQuantity(
            token,
            id,
            itemId,
            quantity,
            parsed.data.reason
          );

          if (
            adjustment.orderItemId !== itemId ||
            adjustment.cancelledQuantity !== quantity
          ) {
            throw new ApiError(
              502,
              "INVALID_RESPONSE",
              "No pudimos verificar la cancelación."
            );
          }

          ownQuantityChanges.current.add(
            quantityChangeKey({
              ...adjustment,
              orderId: id,
            })
          );

          if (ownQuantityChanges.current.size > 500) {
            ownQuantityChanges.current.delete(
              ownQuantityChanges.current.values().next().value!
            );
          }

          return success;
        } catch (cause) {
          result.message = messageOf(cause);

          if (cause instanceof ApiError) {
            result.fields = {};

            for (const fieldError of cause.errors) {
              const field = fieldError.field.split(".").at(-1);

              if (field === "quantity" || field === "reason") {
                result.fields[field] = fieldError.message;
              }
            }

            result.offerFull =
              cause.code === "FULL_CANCELLATION_REQUIRED";

            result.close = [
              "ORDER_NOT_FOUND",
              "ORDER_NOT_CONFIRMED",
              "ORDER_ITEM_NOT_FOUND",
              "ORDER_ITEM_NOT_CANCELLABLE",
            ].includes(cause.code);

            if (cause.code === "ORDER_NOT_FOUND") {
              forgetOrder(id);
            }
          }

          throw cause;
        }
      },
      success,
      false,
      recovery
    );

    return {
      ...result,
      ok,
      close: ok || result.close || !!pendingRecovery.current,
    };
  }

  async function send() {
    if (locked.current || uncertain || error || !data) {
      return false;
    }

    const key = currentLocal.current;
    const local = key ? localDrafts[key] : null;

    const order =
      data.order?.id === selected.current ? data.order : null;

    if (
      !local &&
      (!order || !["OPEN", "CONFIRMED"].includes(order.status))
    ) {
      return false;
    }

    if (order && !local && cancellationIds[order.id]) {
      return false;
    }

    if (order && !local && confirmationIds[order.id]) {
      return retryConfirmation();
    }

    const draft =
      local?.items ?? (order ? (drafts[order.id] ?? {}) : {});

    const items = Object.entries(draft).map(([productId, item]) => ({
      productId,
      quantity: item.quantity,
      notes: item.notes.trim() || null,
    }));

    if (
      !items.length &&
      (local ||
        order?.status !== "OPEN" ||
        !order.items.some((item) => item.status === "ACTIVE"))
    ) {
      setNotice("Agrega al menos un producto antes de enviar.");

      return false;
    }

    if (
      items.length > 50 ||
      items.some(
        (item) =>
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          !data.products.some(
            (product) => product.id === item.productId
          )
      )
    ) {
      setNotice(
        "Revisa los productos y cantidades. Máximo 50 productos diferentes por envío."
      );

      return false;
    }

    return run(
      async () => {
        if (local && key) {
          let id: string;

          try {
            id = await createOrder(token, {
              serviceType: local.serviceType,
              restaurantTableId: local.restaurantTableId,
              customerCount: local.customerCount,
              notes: local.notes?.trim() || null,
              items,
            });
          } catch (cause) {
            if (isUnknown(cause)) {
              setUncertain(true);

              throw new RecoveryError(
                "No pudimos verificar si la orden fue creada. No vuelvas a enviarla todavía. Actualiza las cuentas para comprobar que no se haya creado una orden duplicada."
              );
            }

            throw new RecoveryError(
              messageOf(cause) +
                " El borrador continúa guardado en esta pantalla. Revisa la información e inténtalo nuevamente."
            );
          }

          selected.current = id;
          currentLocal.current = null;

          setSelectedId(id);
          setLocalKey(null);

          setLocalDrafts((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
          });

          return confirm(id);
        }

        if (!order) return;

        if (items.length) {
          try {
            await writeOrder(
              token,
              `/orders/${order.id}/items`,
              "POST",
              { items }
            );
          } catch (cause) {
            if (isUnknown(cause)) {
              uncertainBatch.current = order.id;
            }

            throw cause;
          }

          setDrafts((previous) => ({
            ...previous,
            [order.id]: {},
          }));
        }

        if (order.status === "OPEN") {
          return confirm(order.id);
        }

        return "Adiciones enviadas correctamente.";
      },
      "Pedido enviado.",
      true
    );
  }

  async function reconcile() {
    if (locked.current) return;

    locked.current = true;
    reader.current?.abort();
    setBusy(true);

    try {
      const recovery = pendingRecovery.current;

      if (recovery) {
        const result = await recoverWrite(recovery);
        const updated = alive.current ? await refresh() : false;

        if (alive.current) {
          setNotice(
            [
              result.message,
              !updated ? "Falta actualizar la pantalla." : "",
            ]
              .filter(Boolean)
              .join(" ")
          );
        }

        return;
      }

      const ok = await refresh();

      if (alive.current && ok) {
        const id = uncertainBatch.current;

        if (id) {
          setDrafts((previous) => ({
            ...previous,
            [id]: {},
          }));
        }

        uncertainBatch.current = null;

        // La creación sin ID sigue requiriendo revisión manual.
        setUncertain(false);

        setNotice(
          "Cuentas actualizadas. Antes de reenviar, comprueba que el pedido o los productos no estén ya guardados."
        );
      }
    } finally {
      if (alive.current) {
        setBusy(false);
      }

      locked.current = false;
    }
  }

  return {
    data,
    selectedId,
    drafts,
    localDraft: localKey ? localDrafts[localKey] : null,
    confirmationIds,
    cancellationIds,
    deliveredIds,
    busy,
    sending,
    loading,
    error,
    notice,
    clearNotice: () => setNotice(""),
    uncertain,
    needsWriteVerification,
    select,
    start,
    updateLocal,
    setDraft,
    discardLocal,
    discardAdditions,
    action,
    send,
    retryConfirmation,
    cancelOrder,
    verifyCancellation,
    reconcile,
    cancelUnits,
    retry: () => {
      if (!locked.current) {
        void refresh();
      }
    },
  };
}

export type SalesResource = ReturnType<typeof useSales>;
