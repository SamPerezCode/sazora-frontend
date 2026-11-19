import { useEffect, useEffectEvent } from "react";

import {
  keysIntersect,
  subscribeOperations,
} from "../lib/operations-sync";

export function useOperationsSync(
  token: string,
  keys: readonly string[],
  refresh: () => unknown,
  paused = false,
  pollMs = 0
) {
  const serialized = JSON.stringify(keys);

  const update = useEffectEvent(() => {
    if (paused || document.visibilityState !== "visible") {
      return false;
    }

    void refresh();

    return true;
  });

  useEffect(() => {
    if (!token) return;

    const watched: string[] = JSON.parse(serialized);

    if (!watched.length) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;

    function flush() {
      timer = undefined;

      if (live && !update()) {
        timer = setTimeout(flush, 500);
      }
    }

    function schedule() {
      if (timer === undefined) {
        timer = setTimeout(flush, 100);
      }
    }

    const unsubscribe = subscribeOperations(token, (changed) => {
      if (
        changed.some((key) =>
          watched.some((watch) => keysIntersect(key, watch))
        )
      ) {
        schedule();
      }
    });

    const poll = pollMs ? setInterval(schedule, pollMs) : undefined;

    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      live = false;

      clearTimeout(timer);
      clearInterval(poll);

      unsubscribe();

      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [token, serialized, pollMs]);
}
