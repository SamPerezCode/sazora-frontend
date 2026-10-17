import { useEffect, useState } from "react";

import { ApiError } from "../../lib/http/client";

export function useReportQuery<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  enabled = true,
  onError?: (error: ApiError) => void
) {
  const [revision, setRevision] = useState(0);

  const [snapshot, setSnapshot] = useState<{
    key: string;
    revision: number;
    data: T | null;
    error: ApiError | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    void loader(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            key,
            revision,
            data,
            error: null,
          });
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;

        const error =
          cause instanceof ApiError
            ? cause
            : new ApiError(
                0,
                "REPORT_ERROR",
                "No pudimos consultar la información."
              );

        setSnapshot({
          key,
          revision,
          data: null,
          error,
        });

        onError?.(error);
      }
    );

    return () => controller.abort();
  }, [key, revision, loader, enabled, onError]);

  const current =
    enabled && snapshot?.key === key && snapshot.revision === revision
      ? snapshot
      : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && !current,
    retry: () => setRevision((value) => value + 1),
  };
}
