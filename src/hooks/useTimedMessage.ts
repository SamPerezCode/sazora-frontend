import { useCallback, useEffect, useRef, useState } from "react";

export function useTimedMessage(duration = 5000) {
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showMessage = useCallback(
    (nextMessage: string) => {
      clearTimer();
      setMessage(nextMessage);

      if (!nextMessage) return;

      timeoutRef.current = window.setTimeout(() => {
        setMessage("");
        timeoutRef.current = null;
      }, duration);
    },
    [clearTimer, duration]
  );

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return [message, showMessage] as const;
}
