import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import { acquireSessionSocket } from "../../../lib/realtime/session-socket";
import type { ConnectionStatus } from "../../../lib/realtime/session-socket";
import type { AuthSession } from "../../auth/types/auth.types";
import { useAuth } from "../../auth/hooks/useAuth";

import { getPreparationAreas } from "../../preparation-areas/services/preparation-area.service";
import type { PreparationArea } from "../../preparation-areas/schemas/preparation-area.schema";

import { getKitchenSettings } from "../../kitchen-flow/kitchen-flow.service";
import type { LocationKitchenSettings } from "../../kitchen-flow/kitchen-flow.schema";
import type { SalesScope } from "../../sales/services/sales.service";

import {
  kitchenEventNames,
  kitchenEventSchema,
} from "../schemas/kitchen.schema";

import type {
  KitchenMutation,
  KitchenNotice,
  KitchenTicket,
} from "../schemas/kitchen.schema";

import {
  getKitchenTickets,
  updateKitchenStatus,
  kitchenMessage,
} from "../services/kitchen.service";

import {
  isActiveItem,
  mergeKitchenItems,
  nextItemStatus,
  nextTicketStatus,
  kitchenPermissions,
  canKitchenTransition,
  mutationKey,
  serviceLabel,
  KITCHEN_DEBOUNCE_MS,
  KITCHEN_POLL_MS,
} from "../utils/kitchen.utils";

type Snapshot = {
  tickets: KitchenTicket[];
  areas: PreparationArea[];
  settings: LocationKitchenSettings | null;
  area: string;
  notices: KitchenNotice[];
  pending: string[];
  highlighted: string[];
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
  settings: null,
  area: "",
  notices: [],
  pending: [],
  highlighted: [],
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
  scope: SalesScope,
  play: (kind: "new" | "cancel") => void
) {
  const { logout } = useAuth();
  const [state, setState] = useState<Snapshot>(initial);
  const runtime = useRef<Runtime | null>(null);

  const { accessToken: token } = session;
  const businessId = session.business.id;
  const membershipId = session.membership.id;
  const userId = session.user.id;

  const { prepare, deliver } = kitchenPermissions(
    session.authorization.roles
  );

  useEffect(() => {
    let live = true;
    let area = "";
    let paused = false;
    let synchronized = false;
    let revision = 0;
    let queued = false;
    let forceQueued = false;

    let tickets: KitchenTicket[] = [];
    let areas: PreparationArea[] = [];
    let reader: AbortController | null = null;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let messageTimer: ReturnType<typeof setTimeout> | undefined;

    const writes = new Map<string, AbortController>();
    const seen = new Set<string>();
    const expirations = new Set<ReturnType<typeof setTimeout>>();
    const known = new Map<string, KitchenTicket>();
    const sounds = new Set<string>();

    const lease = acquireSessionSocket({
      accessToken: token,
      businessId,
      membershipId,
      userId,
    });

    function patch(values: Partial<Snapshot>) {
      if (live) {
        setState((previous) => ({ ...previous, ...values }));
      }
    }

    function commit(next: KitchenTicket[]) {
      tickets = next.filter((ticket) =>
        ticket.items.some(isActiveItem)
      );

      tickets.forEach((ticket) => known.set(ticket.id, ticket));

      while (known.size > 500) {
        known.delete(known.keys().next().value!);
      }

      patch({ tickets });
    }

    function message(text: string) {
      clearTimeout(messageTimer);
      patch({ actionMessage: text });

      messageTimer = setTimeout(
        () => patch({ actionMessage: "" }),
        7000
      );
    }

    function expire(operation: () => void) {
      const handle = setTimeout(() => {
        expirations.delete(handle);
        if (live) operation();
      }, 12_000);

      expirations.add(handle);
    }

    function schedule(force = false) {
      if (!live || (paused && !force)) return;

      forceQueued ||= force;

      if (timer !== undefined) return;

      timer = setTimeout(() => {
        timer = undefined;
        const requestedForce = forceQueued;
        forceQueued = false;
        void refresh(requestedForce);
      }, KITCHEN_DEBOUNCE_MS);
    }

    async function refresh(force = false) {
      if (
        !live ||
        (paused && !force) ||
        lease.getStatus() === "rejected"
      ) {
        return;
      }

      if (reader || writes.size) {
        queued = true;
        forceQueued ||= force;
        return;
      }

      const controller = new AbortController();
      reader = controller;

      const expected = revision;
      queued = false;

      patch({ refreshing: true });

      try {
        const [settingsResult, areasResult, ticketsResult] =
          await Promise.allSettled([
            getKitchenSettings(token, scope, controller.signal),
            getPreparationAreas(token, controller.signal, {
              locationId: scope.location.id,
              activeOnly: true,
            }),
            getKitchenTickets(token, scope, area, controller.signal),
          ]);

        if (!live || controller.signal.aborted) return;

        if (expected !== revision) {
          queued = true;
          return;
        }

        const failures = [
          settingsResult,
          areasResult,
          ticketsResult,
        ].filter((result) => result.status === "rejected");

        const accessFailure = failures.find(
          (result) =>
            result.reason instanceof ApiError &&
            (result.reason.status === 401 ||
              [
                "LOCATION_ACCESS_DENIED",
                "LOCATION_NOT_FOUND",
                "LOCATION_INACTIVE",
                "LOCATION_NOT_POINT_OF_SALE",
              ].includes(result.reason.code))
        );

        if (accessFailure) {
          known.clear();
          commit([]);
          synchronized = false;

          patch({
            settings: null,
            areas: [],
            loading: false,
            synchronized: false,
            error: kitchenMessage(accessFailure.reason),
          });

          return;
        }

        if (settingsResult.status === "fulfilled") {
          patch({ settings: settingsResult.value });
        }

        if (areasResult.status === "fulfilled") {
          areas = areasResult.value
            .filter(
              (value) =>
                value.businessId === businessId &&
                value.isActive &&
                value.locations.some(
                  (location) =>
                    location.id === scope.location.id &&
                    location.isActive
                )
            )
            .sort((a, b) => a.displayOrder - b.displayOrder);

          patch({
            areas,
            areaError: "",
            areasLoaded: true,
          });

          if (area && !areas.some((value) => value.id === area)) {
            area = "";
            revision++;
            commit([]);
            synchronized = false;

            patch({
              area,
              loading: true,
              lastUpdated: null,
              synchronized: false,
            });

            queued = true;
            return;
          }
        } else {
          patch({
            areaError: kitchenMessage(areasResult.reason),
          });
        }

        if (ticketsResult.status === "fulfilled") {
          commit(ticketsResult.value);

          const hasNew = tickets.some((ticket) =>
            sounds.has(ticket.orderId)
          );

          sounds.clear();

          if (hasNew) play("new");

          patch({ lastUpdated: Date.now() });
        }

        const failure =
          ticketsResult.status === "rejected"
            ? ticketsResult
            : settingsResult.status === "rejected"
              ? settingsResult
              : null;

        synchronized = !failure;

        patch({
          loading: false,
          synchronized,
          error: failure ? kitchenMessage(failure.reason) : "",
        });
      } finally {
        if (reader === controller) {
          reader = null;
          patch({ refreshing: false });

          if (queued) schedule(forceQueued);
        }
      }
    }

    function onEvent(
      name: (typeof kitchenEventNames)[number],
      raw: unknown
    ) {
      if (!live || lease.getStatus() !== "connected") return;

      const result = kitchenEventSchema.safeParse(raw);
      if (!result.success) return;

      const event = result.data;

      if (
        event.businessId !== businessId ||
        event.locationId !== scope.location.id
      ) {
        return;
      }

      // El evento invalida la lectura; nunca inserta tarjetas.
      revision++;
      schedule();

      const eventKey = name + ":" + JSON.stringify(raw);

      if (seen.has(eventKey)) return;

      seen.add(eventKey);

      if (seen.size > 1000) {
        seen.delete(seen.values().next().value!);
      }

      const ticket = event.kitchenTicketId
        ? known.get(event.kitchenTicketId)
        : [...known.values()].find(
            (value) => value.orderId === event.orderId
          );

      const item = ticket?.items.find(
        (value) => value.id === event.kitchenTicketItemId
      );

      const relevant =
        !area || !ticket || ticket.preparationAreaId === area;

      const addition =
        name === "order:items-added" &&
        event.orderStatus === "CONFIRMED";

      const quantity =
        name === "order:item-quantity-cancelled" &&
        event.cancelledQuantity !== undefined &&
        event.remainingQuantity !== undefined;

      const cancellation =
        name === "order:item-cancelled" ||
        quantity ||
        (name === "order:status-updated" &&
          event.status === "CANCELLED");

      if (name === "order:confirmed" || addition) {
        sounds.add(event.orderId);
      }

      if (cancellation && relevant) {
        play("cancel");
      }

      if (!(addition || cancellation) || !relevant) return;

      if (
        addition &&
        area &&
        event.orderItems &&
        !event.orderItems.some(
          (value) => value.preparationAreaId === area
        )
      ) {
        return;
      }

      const notice: KitchenNotice = {
        id: eventKey,
        orderId: event.orderId,
        ticketId: event.kitchenTicketId,
        areaId: ticket?.preparationAreaId,
        label: ticket ? serviceLabel(ticket) : "Orden",
        kind: addition
          ? "addition"
          : quantity
            ? "quantity-cancelled"
            : name === "order:status-updated"
              ? "order-cancelled"
              : "item-cancelled",
        reason: event.cancellationReason,
        productName: item?.productName,
        quantity: quantity ? event.cancelledQuantity : item?.quantity,
        remainingQuantity: event.remainingQuantity,
      };

      setState((previous) => ({
        ...previous,
        notices: [...previous.notices, notice],
        highlighted: addition
          ? [...new Set([...previous.highlighted, event.orderId])]
          : previous.highlighted,
      }));

      if (addition) {
        expire(() =>
          setState((previous) => ({
            ...previous,
            notices: previous.notices.filter(
              (value) => value.id !== eventKey
            ),
            highlighted: previous.highlighted.filter(
              (id) => id !== event.orderId
            ),
          }))
        );
      }
    }

    const listeners = kitchenEventNames.map((name) => {
      const listener = (raw: unknown) => onEvent(name, raw);

      lease.socket.on(name, listener);

      return () => lease.socket.off(name, listener);
    });

    function connectionChanged(connection: ConnectionStatus) {
      patch({ connection });

      if (connection === "rejected") {
        reader?.abort();
        writes.forEach((controller) => controller.abort());
        known.clear();
        commit([]);
        logout();
      } else if (connection === "connected") {
        // La conexión compartida publica "connected" después de session:ready.
        revision++;
        schedule();
      }
    }

    const unsubscribe = lease.subscribe(connectionChanged);

    async function mutate(action: KitchenMutation) {
      const key = mutationKey(action);
      const bulkKey = action.ticketId + ":all";

      if (
        !live ||
        paused ||
        !synchronized ||
        writes.has(key) ||
        writes.has(bulkKey) ||
        (!action.itemId &&
          [...writes.keys()].some((value) =>
            value.startsWith(action.ticketId + ":")
          )) ||
        !canKitchenTransition(action.status, { prepare, deliver })
      ) {
        return;
      }

      const ticket = tickets.find(
        (value) => value.id === action.ticketId
      );

      const item = ticket?.items.find(
        (value) => value.id === action.itemId
      );

      const next = !ticket
        ? null
        : action.itemId
          ? item
            ? nextItemStatus(item)
            : null
          : nextTicketStatus(ticket);

      if (!ticket || next !== action.status) {
        schedule(true);
        return;
      }

      const controller = new AbortController();

      writes.set(key, controller);
      revision++;
      reader?.abort();
      reader = null;

      patch({
        pending: [...writes.keys()],
        refreshing: false,
      });

      try {
        const result = await updateKitchenStatus(
          action,
          token,
          controller.signal
        );

        if (!live || controller.signal.aborted) return;

        if (
          result.orderId !== ticket.orderId ||
          result.items.some(
            (value) =>
              !ticket.items.some(
                (old) =>
                  old.id === value.id &&
                  old.orderItemId === value.orderItemId
              )
          ) ||
          (action.itemId &&
            (result.items.length !== 1 ||
              result.items[0].id !== action.itemId))
        ) {
          throw new Error(
            "No pudimos verificar la respuesta. Actualiza antes de reintentar."
          );
        }

        commit(
          tickets.map((value) =>
            value.id === ticket.id
              ? mergeKitchenItems(value, result.items)
              : value
          )
        );

        message(
          action.status === "DELIVERED"
            ? "Entrega registrada."
            : "Preparación actualizada."
        );
      } catch (cause) {
        if (live && !controller.signal.aborted) {
          synchronized = false;
          patch({ synchronized: false });
          message(kitchenMessage(cause));
        }
      } finally {
        writes.delete(key);

        if (live) {
          patch({ pending: [...writes.keys()] });
          revision++;
          void refresh(true);
        }
      }
    }

    runtime.current = {
      refresh() {
        void refresh(true);
      },

      selectArea(id) {
        if (
          writes.size ||
          id === area ||
          (id && !areas.some((value) => value.id === id))
        ) {
          return;
        }

        area = id;
        revision++;
        reader?.abort();
        reader = null;
        synchronized = false;
        commit([]);

        patch({
          area,
          loading: true,
          lastUpdated: null,
          error: "",
          synchronized: false,
        });

        void refresh(true);
      },

      togglePause() {
        if (writes.size) return;

        paused = !paused;
        revision++;
        reader?.abort();
        reader = null;
        clearTimeout(timer);
        timer = undefined;

        patch({ paused, refreshing: false });

        if (!paused) void refresh(true);
      },

      mutate(action) {
        void mutate(action);
      },
    };

    const poll = setInterval(() => {
      void refresh();
    }, KITCHEN_POLL_MS);

    const focus = () => schedule();

    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);

    connectionChanged(lease.getStatus());
    schedule();

    return () => {
      live = false;
      runtime.current = null;

      clearTimeout(timer);
      clearTimeout(messageTimer);
      clearInterval(poll);
      expirations.forEach(clearTimeout);

      reader?.abort();
      writes.forEach((controller) => controller.abort());
      listeners.forEach((cleanup) => cleanup());

      unsubscribe();
      lease.release();

      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [
    token,
    businessId,
    membershipId,
    userId,
    scope,
    prepare,
    deliver,
    logout,
    play,
  ]);

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
      notices: previous.notices.filter((notice) => notice.id !== id),
    }));
  }, []);

  return {
    ...state,
    permissions: { prepare, deliver },
    refresh,
    selectArea,
    togglePause,
    mutate,
    dismiss,
  };
}
