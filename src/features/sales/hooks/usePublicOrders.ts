import { ApiError } from "../../../lib/http/client";
import { useCallback } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";

import { useOperationsSync } from "../../../hooks/useOperationsSync";

export type RemoteSync = {
  token: string;
  keys: readonly string[];
  paused?: boolean;
  pollMs?: number;
};

export function message(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    return "El recurso no fue encontrado.";
  }

  if (error instanceof ApiError && error.status === 403) {
    return "No tienes permiso para consultar este recurso.";
  }

  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";
}

export function useRemote<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  sync?: RemoteSync
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

  useOperationsSync(
    sync?.token ?? "",
    sync?.keys ?? [],
    reload,
    sync?.paused ?? false,
    sync?.pollMs ?? 0
  );

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
