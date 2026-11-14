import { useEffect } from "react";
import { z } from "zod";

import { acquireSessionSocket } from "../../../lib/realtime/session-socket";
import type { AuthSession } from "../../auth/types/auth.types";

const events = [
  "public-order-request:created",
  "public-order-request:status-updated",
  "public-order-request:order-confirmed",
  "public-order-request:preparation-updated",
  "public-order-request:order-closed",
];

const payload = z.object({
  businessId: z.string(),
});

export function usePublicRequestsRealtime(
  session: AuthSession,
  reload: () => void
) {
  const token = session.accessToken;
  const businessId = session.business.id;
  const membershipId = session.membership.id;
  const userId = session.user.id;

  useEffect(() => {
    const lease = acquireSessionSocket({
      accessToken: token,
      businessId,
      membershipId,
      userId,
    });

    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (timer !== undefined) return;

      timer = setTimeout(() => {
        timer = undefined;
        reload();
      }, 500);
    }

    function receive(value: unknown) {
      const parsed = payload.safeParse(value);

      if (
        lease.getStatus() === "connected" &&
        parsed.success &&
        parsed.data.businessId === businessId
      ) {
        schedule();
      }
    }

    for (const event of events) {
      lease.socket.on(event, receive);
    }

    const unsubscribe = lease.subscribe((status) => {
      if (status === "connected" || status === "rejected") {
        schedule();
      }
    });

    if (lease.getStatus() === "connected") schedule();

    return () => {
      clearTimeout(timer);

      for (const event of events) {
        lease.socket.off(event, receive);
      }

      unsubscribe();
      lease.release();
    };
  }, [token, businessId, membershipId, userId, reload]);
}
