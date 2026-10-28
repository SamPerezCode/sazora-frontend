import { useEffect, useEffectEvent } from "react";
import type { AuthSession } from "../features/auth/types/auth.types";
import { acquireSessionSocket } from "../lib/realtime/session-socket";

// Devuelve false si todavía hay una operación en curso.
export function useInventoryRealtime(
  session: AuthSession,
  onRefresh: () => boolean
) {
  const refresh = useEffectEvent(onRefresh);

  const accessToken = session.accessToken;
  const businessId = session.business.id;
  const membershipId = session.membership.id;
  const userId = session.user.id;
  const allowed =
    session.authorization.roles.includes("ADMIN") ||
    session.authorization.roles.includes("PRODUCTION");

  useEffect(() => {
    if (!allowed) return;

    const lease = acquireSessionSocket({
      accessToken,
      businessId,
      membershipId,
      userId,
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;

    function flush() {
      timer = undefined;

      if (!pending || document.visibilityState !== "visible") {
        return;
      }

      // Esperar mientras haya un modal abierto evita perder
      // formularios o borradores por una actualización externa.
      if (document.querySelector("dialog[open]") || !refresh()) {
        timer = setTimeout(flush, 500);
        return;
      }

      pending = false;
    }

    function schedule() {
      pending = true;

      if (timer === undefined) {
        timer = setTimeout(flush, 300);
      }
    }

    function visible() {
      if (document.visibilityState === "visible") {
        schedule();
      }
    }

    const unsubscribeInventory = lease.subscribeInventory(schedule);

    const unsubscribeStatus = lease.subscribe((status) => {
      if (status === "connected") {
        schedule();
      }
    });

    if (lease.getStatus() === "connected") {
      schedule();
    }

    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", visible);

    return () => {
      clearTimeout(timer);

      unsubscribeInventory();
      unsubscribeStatus();

      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", visible);

      lease.release();
    };
  }, [accessToken, businessId, membershipId, userId, allowed]);
}
