import { ApiError } from "../../lib/http/client";
import type { SalesScope } from "../sales/services/sales.service";

import { createKitchenPrintApi } from "./kitchen-flow.service";
import type { KitchenPrintApi } from "./kitchen-flow.service";

import {
  kitchenErrorMessage,
  reprintInputSchema,
} from "./kitchen-flow.schema";

import type {
  KitchenPrint,
  PrintTicket,
} from "./kitchen-flow.schema";

export type KitchenPrintUiStatus =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "ERROR";

export interface PrintEntry {
  ticket: PrintTicket;
  status: KitchenPrintUiStatus;
  prints: KitchenPrint[];
  error: string;
  historyError: string;
  loadingHistory: boolean;
  reprinting: boolean;
}

type Snapshot = Record<string, PrintEntry>;

export function currentInitialPrint(
  entry: PrintEntry
): KitchenPrint | undefined {
  return entry.prints.find(
    (print) =>
      print.ticketVersion === entry.ticket.currentVersion &&
      (print.printType === "INITIAL" ||
        print.printType === "MODIFICATION")
  );
}

function mergePrints(
  previous: KitchenPrint[],
  incoming: KitchenPrint[]
): KitchenPrint[] {
  return [
    ...new Map(
      [...previous, ...incoming].map((print) => [print.id, print])
    ).values(),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPrintStore(
  scope: SalesScope,
  api: KitchenPrintApi,
  onError: (cause: unknown) => void = () => {}
) {
  let snapshot: Snapshot = {};

  const listeners = new Set<() => void>();
  const busyTickets = new Set<string>();
  const revisions = new Map<string, number>();

  function key(ticket: PrintTicket) {
    return [
      scope.businessId,
      scope.location.id,
      ticket.orderId,
      ticket.id,
      ticket.currentVersion,
    ].join(":");
  }

  function publish() {
    for (const listener of listeners) listener();
  }

  function remember(tickets: readonly PrintTicket[]) {
    let changed = false;
    const next = { ...snapshot };

    for (const ticket of tickets) {
      const id = key(ticket);
      const previous = next[id];

      if (!previous) {
        next[id] = {
          ticket,
          status: "PENDING",
          prints: [],
          error: "",
          historyError: "",
          loadingHistory: false,
          reprinting: false,
        };
        changed = true;
      } else if (
        previous.ticket.preparationAreaName !==
        ticket.preparationAreaName
      ) {
        next[id] = { ...previous, ticket };
        changed = true;
      }
    }

    if (changed) {
      snapshot = next;
      publish();
    }
  }

  function update(ticket: PrintTicket, patch: Partial<PrintEntry>) {
    remember([ticket]);

    const id = key(ticket);
    snapshot = {
      ...snapshot,
      [id]: { ...snapshot[id], ...patch },
    };

    publish();
  }

  function list(orderId: string, source = snapshot): PrintEntry[] {
    const latest = new Map<string, PrintEntry>();

    for (const entry of Object.values(source)) {
      if (entry.ticket.orderId !== orderId) continue;

      const previous = latest.get(entry.ticket.id);

      if (
        !previous ||
        entry.ticket.currentVersion > previous.ticket.currentVersion
      ) {
        latest.set(entry.ticket.id, entry);
      }
    }

    return [...latest.values()];
  }

  function bump(ticket: PrintTicket) {
    const next = (revisions.get(ticket.id) ?? 0) + 1;
    revisions.set(ticket.id, next);
    return next;
  }

  function storePrint(ticket: PrintTicket, print: KitchenPrint) {
    const actual: PrintTicket = {
      ...ticket,
      currentVersion: print.ticketVersion,
      preparationAreaName: print.contentSnapshot.preparationAreaName,
    };

    remember([actual]);

    const previous = snapshot[key(actual)];
    const prints = mergePrints(previous.prints, [print]);
    const next = { ...previous, prints };

    update(actual, {
      prints,
      status: currentInitialPrint(next) ? "SENT" : previous.status,
      error: "",
      historyError: "",
    });

    // /prints registra la versión actual del servidor.
    // No atribuimos una respuesta de otra versión a la solicitada.
    if (actual.currentVersion !== ticket.currentVersion) {
      update(ticket, {
        status: "PENDING",
        error: "",
        historyError:
          "La comanda cambió de versión. Se muestra la versión registrada por el servidor.",
      });
    }
  }

  async function restore(ticket: PrintTicket) {
    remember([ticket]);

    if (busyTickets.has(ticket.id)) return;

    const revision = bump(ticket);

    update(ticket, {
      loadingHistory: true,
      historyError: "",
    });

    try {
      const incoming = await api.history(ticket);

      if (
        busyTickets.has(ticket.id) ||
        revisions.get(ticket.id) !== revision
      ) {
        return;
      }

      const previous = snapshot[key(ticket)];
      const prints = mergePrints(previous.prints, incoming);
      const candidate = { ...previous, prints };
      const sent = currentInitialPrint(candidate);

      update(ticket, {
        prints,
        status: sent
          ? "SENT"
          : previous.status === "ERROR"
            ? "ERROR"
            : "PENDING",
        error: sent ? "" : previous.error,
        loadingHistory: false,
        historyError: "",
      });
    } catch (cause) {
      if (
        busyTickets.has(ticket.id) ||
        revisions.get(ticket.id) !== revision
      ) {
        return;
      }

      onError(cause);

      update(ticket, {
        loadingHistory: false,
        historyError: kitchenErrorMessage(cause),
      });
    }
  }

  async function send(ticket: PrintTicket): Promise<boolean> {
    remember([ticket]);

    if (busyTickets.has(ticket.id)) return false;

    if (currentInitialPrint(snapshot[key(ticket)])) {
      return true;
    }

    busyTickets.add(ticket.id);
    bump(ticket);

    update(ticket, {
      status: "SENDING",
      loadingHistory: false,
      error: "",
      historyError: "",
    });

    try {
      let print: KitchenPrint;

      try {
        print = await api.initial(ticket);
      } catch (cause) {
        if (
          !(cause instanceof ApiError) ||
          cause.code !== "KITCHEN_TICKET_VERSION_ALREADY_PRINTED"
        ) {
          throw cause;
        }

        const prints = await api.history(ticket);

        const existing = prints.find(
          (item) =>
            item.ticketVersion === ticket.currentVersion &&
            (item.printType === "INITIAL" ||
              item.printType === "MODIFICATION")
        );

        if (!existing) {
          throw new Error(
            "El servidor informa una impresión previa, pero todavía no aparece en el historial. Actualiza antes de reintentar.",
            { cause }
          );
        }
        print = existing;
      }

      storePrint(ticket, print);
      return true;
    } catch (cause) {
      onError(cause);

      update(ticket, {
        status: "ERROR",
        error: kitchenErrorMessage(cause),
      });

      return false;
    } finally {
      busyTickets.delete(ticket.id);
    }
  }

  function sendAll(tickets: readonly PrintTicket[]) {
    const unique = [
      ...new Map(
        tickets.map((ticket) => [key(ticket), ticket])
      ).values(),
    ];

    return Promise.allSettled(unique.map(send));
  }

  async function retryFailed(orderId: string) {
    const failed = list(orderId)
      .filter((entry) => entry.status === "ERROR")
      .map((entry) => entry.ticket);

    const results = await sendAll(failed);

    return {
      count: failed.length,
      ok: results.every(
        (result) => result.status === "fulfilled" && result.value
      ),
    };
  }

  async function reprint(
    ticket: PrintTicket,
    source: KitchenPrint,
    reason: string,
    printerName: string | null
  ) {
    const body = reprintInputSchema.parse({
      reason,
      printerName,
    });

    if (
      busyTickets.has(ticket.id) ||
      source.kitchenTicketId !== ticket.id ||
      source.contentSnapshot.orderId !== ticket.orderId
    ) {
      throw new Error(
        "La comanda está ocupada o la impresión no corresponde a esta cuenta."
      );
    }

    busyTickets.add(ticket.id);
    bump(ticket);

    update(ticket, {
      reprinting: true,
      loadingHistory: false,
    });

    try {
      const print = await api.reprint(
        ticket,
        source,
        body.reason,
        body.printerName
      );

      storePrint(ticket, print);
    } catch (cause) {
      onError(cause);
      throw cause;
    } finally {
      busyTickets.delete(ticket.id);
      update(ticket, { reprinting: false });
    }

    // Actualización limitada al historial de esta comanda.
    await restore(ticket);
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    remember,
    list,
    restore,
    send,
    sendAll,
    retryFailed,
    reprint,
  };
}

export function createKitchenPrintStore(
  token: string,
  scope: SalesScope,
  onError: (cause: unknown) => void
) {
  return createPrintStore(
    scope,
    createKitchenPrintApi(token, scope),
    onError
  );
}

export type KitchenPrintStore = ReturnType<typeof createPrintStore>;
