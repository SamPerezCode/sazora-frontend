import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError } from "../../../lib/http/client";
import { acquireSessionSocket } from "../../../lib/realtime/session-socket";
import type { ConnectionStatus } from "../../../lib/realtime/session-socket";
import type { AuthSession } from "../../auth/types/auth.types";
import { useAuth } from "../../auth/hooks/useAuth";
import { getPreparationAreas } from "../../preparation-areas/services/preparation-area.service";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";
import { kitchenEvents } from "../schemas/kitchen.schema";
import type {
  KitchenTicket,
  KitchenMutation,
  KitchenNotice,
} from "../schemas/kitchen.schema";
import {
  getKitchenTickets,
  updateKitchenStatus,
} from "../services/kitchen.service";
import {
  isActiveItem,
  mergeKitchenItems,
  nextItemStatus,
  nextTicketStatus,
  serviceLabel,
  KITCHEN_DEBOUNCE_MS,
  KITCHEN_POLL_MS,
} from "../utils/kitchen.utils";

type Snapshot = {
  tickets: KitchenTicket[];
  areas: PreparationArea[];
  area: string;
  notices: KitchenNotice[];
  pending: string[];
  connection: ConnectionStatus;
  paused: boolean;
  loading: boolean;
  refreshing: boolean;
  synchronized: boolean;
  lastUpdated: number | null;
  error: string;
  areaError: string;
  actionMessage: string;
  areasLoaded: boolean;
};

type Runtime = {
  refresh: () => void;
  selectArea: (id: string) => void;
  togglePause: () => void;
  mutate: (action: KitchenMutation) => void;
};

const initial: Snapshot = {
  tickets: [],
  areas: [],
  area: "",
  notices: [],
  pending: [],
  connection: "connecting",
  paused: false,
  loading: true,
  refreshing: false,
  synchronized: false,
  lastUpdated: null,
  error: "",
  areaError: "",
  actionMessage: "",
  areasLoaded: false,
};

export function useKitchen(
  session: AuthSession,
  play: (kind: "new" | "cancel") => void
) {
  const { logout } = useAuth();
  const [state, setState] = useState<Snapshot>(initial);
  const runtime = useRef<Runtime | null>(null);

  const token = session.accessToken;
  const businessId = session.business.id;
  const membershipId = session.membership.id;
  const userId = session.user.id;

  useEffect(() => {
    let live = true;
    let area = "";
    let tickets: KitchenTicket[] = [];
    let paused = false;
    let denied = false;
    let synchronized = false;
    let revision = 0;
    let repeat = false;
    let readError = "";
    let areaError = "";

    let reader: AbortController | null = null;
    let areaReader: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const writes = new Map<string, AbortController>();
    const removedOrders = new Set<string>();
    const knownTickets = new Map<string, KitchenTicket>();
    const seen = new Set<string>();

    const lease = acquireSessionSocket({
      accessToken: token,
      businessId,
      membershipId,
      userId,
    });

    let connection = lease.getStatus();

    function patch(values: Partial<Snapshot>) {
      if (live) {
        setState((previous) => ({ ...previous, ...values }));
      }
    }

    function commit(next: KitchenTicket[]) {
      next.forEach((ticket) => {
        knownTickets.delete(ticket.id);
        knownTickets.set(ticket.id, ticket);
      });

      while (knownTickets.size > 500) {
        knownTickets.delete(knownTickets.keys().next().value!);
      }

      tickets = next.filter(
        (ticket) =>
          !removedOrders.has(ticket.orderId) &&
          ticket.items.some(isActiveItem)
      );

      patch({ tickets });
    }

    function invalidate() {
      revision++;
      synchronized = false;
      patch({ synchronized: false });
    }

    function schedule() {
      if (paused || denied) return;

      clearTimeout(timer);

      timer = setTimeout(() => {
        void refresh();
      }, KITCHEN_DEBOUNCE_MS);
    }

    async function loadAreas() {
      if (areaReader || denied) return;

      const controller = new AbortController();
      areaReader = controller;

      try {
        const areas = await getPreparationAreas(
          token,
          controller.signal
        );

        if (!live || controller.signal.aborted) return;

        if (areas.some((item) => item.businessId !== businessId)) {
          throw new Error(
            "No pudimos verificar las áreas del negocio."
          );
        }

        areaError = "";

        patch({
          areas: [...areas].sort(
            (a, b) => a.displayOrder - b.displayOrder
          ),
          areaError: "",
          areasLoaded: true,
        });
      } catch (cause) {
        if (live && !controller.signal.aborted) {
          areaError =
            cause instanceof Error
              ? cause.message
              : "No pudimos cargar las áreas.";

          patch({ areaError });
        }
      } finally {
        if (areaReader === controller) {
          areaReader = null;
        }
      }
    }

    async function refresh(force = false) {
      if (!live || denied || (paused && !force)) return;

      if (reader || writes.size) {
        repeat = true;
        return;
      }

      const controller = new AbortController();
      const requestedRevision = revision;

      reader = controller;
      repeat = false;

      patch({ refreshing: true });

      try {
        const result = await getKitchenTickets(
          token,
          area,
          controller.signal
        );

        if (!live || controller.signal.aborted) return;

        if (requestedRevision !== revision) {
          repeat = true;
          return;
        }

        const invalidScope = result.some(
          (ticket) =>
            ticket.businessId !== businessId ||
            (area !== "" && ticket.preparationAreaId !== area)
        );

        if (invalidScope) {
          throw new Error(
            "No pudimos verificar las comandas recibidas."
          );
        }

        commit(result);

        readError = "";
        synchronized = true;

        patch({
          error: "",
          loading: false,
          synchronized: true,
          lastUpdated: Date.now(),
        });
      } catch (cause) {
        if (live && !controller.signal.aborted) {
          readError =
            cause instanceof Error
              ? cause.message
              : "No pudimos actualizar las comandas.";

          synchronized = false;

          if (cause instanceof ApiError && cause.status === 403) {
            denied = true;
            commit([]);
          }

          patch({
            error: readError,
            loading: false,
            synchronized: false,
          });
        }
      } finally {
        if (reader === controller) {
          reader = null;
          patch({ refreshing: false });

          if (repeat) schedule();
        }
      }
    }

    function notice(value: KitchenNotice) {
      if (!live) return;

      setState((previous) => ({
        ...previous,
        notices: previous.notices.some((item) => item.id === value.id)
          ? previous.notices
          : [...previous.notices, value],
      }));
    }

    function unique(key: string) {
      if (seen.has(key)) return false;

      seen.add(key);

      if (seen.size > 1000) {
        seen.delete(seen.values().next().value!);
      }

      return true;
    }

    function replaceStatus(
      ticketId: string,
      itemId: string,
      status: KitchenTicket["items"][number]["preparationStatus"],
      at: string
    ) {
      commit(
        tickets.map((ticket) => {
          if (ticket.id !== ticketId) return ticket;

          const item = ticket.items.find(
            (candidate) => candidate.id === itemId
          );

          if (!item) return ticket;

          return mergeKitchenItems(ticket, [
            {
              ...item,
              preparationStatus: status,
              updatedAt: at,
            },
          ]);
        })
      );
    }

    const cleanups: (() => void)[] = [];

    function listen<T>(
      name: string,
      schema: z.ZodType<T>,
      handler: (payload: T) => void
    ) {
      const listener = (raw: unknown) => {
        if (connection !== "connected" || !live) return;

        const parsed = schema.safeParse(raw);

        if (!parsed.success) return;

        const payload = parsed.data as T & {
          businessId: string;
        };

        if (payload.businessId !== businessId) return;

        handler(payload);
      };

      lease.socket.on(name, listener);

      cleanups.push(() => {
        lease.socket.off(name, listener);
      });
    }

    listen(
      "order:confirmed",
      kitchenEvents["order:confirmed"],
      (payload) => {
        if (
          area &&
          !payload.kitchenTickets.some(
            (ticket) => ticket.preparationAreaId === area
          )
        ) {
          return;
        }

        removedOrders.delete(payload.orderId);

        if (
          unique(
            "confirmed:" + payload.orderId + ":" + payload.confirmedAt
          )
        ) {
          play("new");
        }

        invalidate();
        schedule();
      }
    );

    listen(
      "order:items-added",
      kitchenEvents["order:items-added"],
      (payload) => {
        if (payload.orderStatus !== "CONFIRMED") return;

        removedOrders.delete(payload.orderId);

        const items = payload.orderItems.filter(
          (item) => !area || item.preparationAreaId === area
        );

        if (!items.length) return;

        const key =
          "addition:" +
          payload.orderId +
          ":" +
          items
            .map((item) => item.id)
            .sort()
            .join(",");

        if (unique(key)) {
          notice({
            id: key,
            kind: "addition",
            orderId: payload.orderId,
            areaId: area || undefined,
            label: "Nueva adición",
          });

          play("new");
        }

        invalidate();
        schedule();
      }
    );

    listen(
      "kitchen-ticket:item-status-updated",
      kitchenEvents["kitchen-ticket:item-status-updated"],
      (payload) => {
        replaceStatus(
          payload.kitchenTicketId,
          payload.kitchenTicketItemId,
          payload.preparationStatus,
          payload.updatedAt
        );

        invalidate();
        schedule();
      }
    );

    listen(
      "order:item-cancelled",
      kitchenEvents["order:item-cancelled"],
      (payload) => {
        const ticket = knownTickets.get(payload.kitchenTicketId);

        const item = ticket?.items.find(
          (value) => value.id === payload.kitchenTicketItemId
        );

        const key =
          "cancel:" +
          payload.kitchenTicketItemId +
          ":" +
          payload.cancelledAt;

        if (unique(key)) {
          notice({
            id: key,
            kind: "item-cancelled",
            orderId: payload.orderId,
            ticketId: payload.kitchenTicketId,
            areaId: ticket?.preparationAreaId,
            label: ticket
              ? serviceLabel(ticket)
              : "Producto cancelado",
            productName: item?.productName,
            quantity: item?.quantity,
            reason: payload.cancellationReason,
          });

          play("cancel");
        }

        replaceStatus(
          payload.kitchenTicketId,
          payload.kitchenTicketItemId,
          "CANCELLED",
          payload.cancelledAt
        );

        invalidate();
        schedule();
      }
    );

    listen(
      "order:status-updated",
      kitchenEvents["order:status-updated"],
      (payload) => {
        if (payload.status === "CANCELLED") {
          const ticket = [...knownTickets.values()].find(
            (item) => item.orderId === payload.orderId
          );

          const key =
            "order-cancel:" +
            payload.orderId +
            ":" +
            payload.changedAt;

          if (unique(key)) {
            notice({
              id: key,
              kind: "order-cancelled",
              orderId: payload.orderId,
              label: ticket
                ? serviceLabel(ticket)
                : "Orden cancelada",
            });

            play("cancel");
          }
        }

        if (payload.status === "CONFIRMED") {
          removedOrders.delete(payload.orderId);
        }

        if (
          ["CANCELLED", "CLOSED", "DELIVERED"].includes(
            payload.status
          )
        ) {
          removedOrders.add(payload.orderId);
          commit(tickets);
        }

        invalidate();
        schedule();
      }
    );

    listen(
      "order:item-quantity-cancelled",
      kitchenEvents["order:item-quantity-cancelled"],
      (payload) => {
        const known = knownTickets.get(payload.kitchenTicketId);

        const product = known?.items.find(
          (item) => item.id === payload.kitchenTicketItemId
        );

        const key =
          "quantity:" +
          payload.orderItemId +
          ":" +
          payload.kitchenTicketVersion +
          ":" +
          payload.adjustedAt;

        if (
          unique(key) &&
          (!area || !known || known.preparationAreaId === area)
        ) {
          notice({
            id: key,
            kind: "quantity-cancelled",
            orderId: payload.orderId,
            ticketId: payload.kitchenTicketId,
            areaId: known?.preparationAreaId,
            label: known
              ? serviceLabel(known)
              : "Cantidad modificada",
            productName: product?.productName,
            quantity: payload.cancelledQuantity,
            remainingQuantity: payload.remainingQuantity,
            reason: payload.cancellationReason,
          });

          play("cancel");
        }

        commit(
          tickets.map((ticket) => {
            if (
              ticket.id !== payload.kitchenTicketId ||
              ticket.orderId !== payload.orderId ||
              payload.kitchenTicketVersion < ticket.currentVersion
            ) {
              return ticket;
            }

            const item = ticket.items.find(
              (value) =>
                value.id === payload.kitchenTicketItemId &&
                value.orderItemId === payload.orderItemId
            );

            if (!item || !isActiveItem(item)) {
              return ticket;
            }

            return {
              ...mergeKitchenItems(ticket, [
                {
                  ...item,
                  quantity: payload.remainingQuantity,
                  updatedAt: payload.adjustedAt,
                },
              ]),
              currentVersion: Math.max(
                ticket.currentVersion,
                payload.kitchenTicketVersion
              ),
            };
          })
        );

        invalidate();
        schedule();
      }
    );

    function onConnection(next: ConnectionStatus) {
      connection = next;
      patch({ connection: next });

      if (next === "rejected") {
        denied = true;

        reader?.abort();
        areaReader?.abort();

        writes.forEach((controller) => controller.abort());

        commit([]);
        logout();
      } else if (next === "connected") {
        invalidate();
        schedule();
      }
    }

    const unsubscribe = lease.subscribe(onConnection);
    onConnection(lease.getStatus());

    async function mutate(action: KitchenMutation) {
      if (
        !live ||
        denied ||
        paused ||
        !synchronized ||
        writes.has(action.ticketId)
      ) {
        return;
      }

      const ticket = tickets.find(
        (item) => item.id === action.ticketId
      );

      const item = ticket?.items.find(
        (value) => value.id === action.itemId
      );

      const next = ticket
        ? action.itemId
          ? item
            ? nextItemStatus(item)
            : null
          : nextTicketStatus(ticket)
        : null;

      if (next !== action.status) {
        patch({ actionMessage: "" });
        invalidate();
        schedule();
        return;
      }

      const controller = new AbortController();

      writes.set(action.ticketId, controller);
      invalidate();

      patch({
        pending: [...writes.keys()],
        actionMessage: "",
      });

      try {
        const result = await updateKitchenStatus(
          action,
          token,
          controller.signal
        );

        if (!live || controller.signal.aborted) return;

        if (result.orderId !== ticket!.orderId) {
          throw new Error("No pudimos verificar la respuesta.");
        }

        commit(
          tickets.map((value) =>
            value.id === action.ticketId
              ? mergeKitchenItems(value, result.items)
              : value
          )
        );

        patch({ actionMessage: "" });
      } catch (cause) {
        if (live && !controller.signal.aborted) {
          const changed =
            cause instanceof ApiError &&
            [
              "INVALID_KITCHEN_STATUS_TRANSITION",
              "INVALID_KITCHEN_TICKET_STATUS_TRANSITION",
            ].includes(cause.code);

          patch({
            actionMessage:
              (changed
                ? "El estado pudo cambiar en otro dispositivo. "
                : "") +
              (cause instanceof Error
                ? cause.message
                : "No pudimos actualizar."),
          });
        }
      } finally {
        writes.delete(action.ticketId);

        if (live) {
          patch({ pending: [...writes.keys()] });
          invalidate();
          void refresh();
        }
      }
    }

    runtime.current = {
      refresh() {
        denied = connection === "rejected";

        if (areaError) void loadAreas();

        void refresh(true);
      },

      selectArea(id) {
        if (writes.size || id === area) return;

        area = id;
        invalidate();

        reader?.abort();
        reader = null;
        repeat = false;
        tickets = [];

        patch({
          area,
          tickets: [],
          loading: true,
          refreshing: false,
          lastUpdated: null,
          error: "",
        });

        void refresh(true);
      },

      togglePause() {
        if (writes.size) return;

        paused = !paused;
        patch({ paused });

        if (!paused) {
          invalidate();
          void refresh();
        }
      },

      mutate(action) {
        void mutate(action);
      },
    };

    const poll = setInterval(() => {
      if (connection !== "connected" || readError) {
        void refresh();
      }
    }, KITCHEN_POLL_MS);

    const focus = () => {
      void refresh();
    };

    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);

    void loadAreas();
    void refresh();

    return () => {
      live = false;
      runtime.current = null;

      clearTimeout(timer);
      clearInterval(poll);

      reader?.abort();
      areaReader?.abort();

      writes.forEach((controller) => controller.abort());
      cleanups.forEach((cleanup) => cleanup());

      unsubscribe();
      lease.release();

      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [token, businessId, membershipId, userId, logout, play]);

  const refresh = useCallback(() => runtime.current?.refresh(), []);

  const selectArea = useCallback(
    (id: string) => runtime.current?.selectArea(id),
    []
  );

  const togglePause = useCallback(
    () => runtime.current?.togglePause(),
    []
  );

  const mutate = useCallback(
    (action: KitchenMutation) => runtime.current?.mutate(action),
    []
  );

  const dismiss = useCallback((id: string) => {
    setState((previous) => ({
      ...previous,
      notices: previous.notices.filter((item) => item.id !== id),
    }));
  }, []);

  return {
    ...state,
    refresh,
    selectArea,
    togglePause,
    mutate,
    dismiss,
  };
}
