import { io } from "socket.io-client";
import { z } from "zod";
import { API_BASE_URL } from "../../config/env";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "rejected";

type Credentials = {
  accessToken: string;
  businessId: string;
  membershipId: string;
  userId: string;
};

const readySchema = z.object({
  userId: z.string(),
  businessId: z.string(),
  membershipId: z.string(),
  roles: z.array(z.string()),
  connectedAt: z.iso.datetime({ offset: true }),
});

function createEntry(credentials: Credentials) {
  const origin = new URL(API_BASE_URL, window.location.origin).origin;

  const socket = io(origin, {
    autoConnect: false,
    auth: { token: credentials.accessToken },
  });

  let state: ConnectionStatus = "connecting";
  let everReady = false;
  let handshake: ReturnType<typeof setTimeout> | undefined;

  const listeners = new Set<(status: ConnectionStatus) => void>();

  function publish(next: ConnectionStatus) {
    state = next;
    listeners.forEach((listener) => listener(next));
  }

  function reject() {
    socket.io.reconnection(false);
    socket.disconnect();
    clearTimeout(handshake);
    publish("rejected");
  }

  function ready(payload: unknown) {
    const result = readySchema.safeParse(payload);

    if (
      !result.success ||
      result.data.businessId !== credentials.businessId ||
      result.data.membershipId !== credentials.membershipId ||
      result.data.userId !== credentials.userId
    ) {
      reject();
      return;
    }

    clearTimeout(handshake);
    everReady = true;
    publish("connected");
  }

  function connect() {
    publish(everReady ? "reconnecting" : "connecting");
    clearTimeout(handshake);

    handshake = setTimeout(() => {
      if (state !== "connected" && state !== "rejected") {
        publish("disconnected");
      }
    }, 10_000);
  }

  function disconnect() {
    clearTimeout(handshake);

    if (state !== "rejected") {
      publish("reconnecting");
    }
  }

  function error(
    cause: Error & {
      data?: { name?: string; code?: string };
    }
  ) {
    const authenticationError = [
      cause.name,
      cause.data?.name,
      cause.data?.code,
    ].includes("AUTHENTICATION_REQUIRED");

    if (authenticationError) {
      reject();
    } else {
      clearTimeout(handshake);
      publish("disconnected");
    }
  }

  function reconnect() {
    if (state !== "rejected") {
      publish("reconnecting");
    }
  }

  socket.on("connect", connect);
  socket.on("disconnect", disconnect);
  socket.on("connect_error", error);
  socket.on("session:ready", ready);
  socket.io.on("reconnect_attempt", reconnect);

  return {
    socket,
    refs: 0,
    getStatus: () => state,

    subscribe(listener: (status: ConnectionStatus) => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      clearTimeout(handshake);

      socket.off("connect", connect);
      socket.off("disconnect", disconnect);
      socket.off("connect_error", error);
      socket.off("session:ready", ready);
      socket.io.off("reconnect_attempt", reconnect);

      listeners.clear();
      socket.disconnect();
    },
  };
}

const entries = new Map<string, ReturnType<typeof createEntry>>();

export function acquireSessionSocket(credentials: Credentials) {
  const key = JSON.stringify(credentials);

  let entry = entries.get(key);

  if (!entry) {
    entry = createEntry(credentials);
    entries.set(key, entry);
  }

  const current = entry;
  current.refs++;

  queueMicrotask(() => {
    if (
      entries.get(key) === current &&
      current.refs > 0 &&
      current.getStatus() !== "rejected" &&
      !current.socket.connected &&
      !current.socket.active
    ) {
      current.socket.connect();
    }
  });

  let released = false;

  return {
    socket: current.socket,
    getStatus: current.getStatus,
    subscribe: current.subscribe,

    release() {
      if (released) return;

      released = true;
      current.refs--;

      if (current.refs === 0) {
        current.destroy();
        entries.delete(key);
      }
    },
  };
}
