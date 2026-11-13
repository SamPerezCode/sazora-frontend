import { ApiError } from "../../../lib/http/client";
import { useCallback } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";

export function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "No se pudo completar la operación.";
}

export function useRemote<T>(
  loader: (signal: AbortSignal) => Promise<T>
) {
  const [attempt, setAttempt] = useState(0);

  const [snapshot, setSnapshot] = useState<{
    loader: typeof loader;
    attempt: number;
    data?: T;
    error?: string;
  } | null>(null);

  const controller = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controller.current?.abort();
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;

    void loader(current.signal)
      .then((data) => {
        if (!current.signal.aborted) {
          setSnapshot({ loader, attempt, data });
        }
      })
      .catch((error: unknown) => {
        if (!current.signal.aborted) {
          setSnapshot({ loader, attempt, error: message(error) });
        }
      });

    return () => current.abort();
  }, [loader, attempt]);

  const current =
    snapshot?.loader === loader && snapshot.attempt === attempt;

  return {
    data: current ? snapshot.data : undefined,
    error: current ? snapshot.error : undefined,
    loading: !current,
    reload,
  };
}

export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function run(
    task: (signal: AbortSignal) => Promise<unknown>,
    success: () => void,
    refresh: () => void
  ) {
    if (controller.current) return;

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    try {
      await task(current.signal);

      if (!current.signal.aborted) success();
    } catch (cause) {
      if (!current.signal.aborted) {
        setError(
          message(cause) +
            " Se consultará el estado actual antes de permitir otro intento."
        );

        refresh();
      }
    } finally {
      if (!current.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }

  return { busy, error, run };
}
