import { useCallback, useEffect, useRef, useState } from "react";

export function useCashResource<T>(
  loader: (signal: AbortSignal) => Promise<T>
) {
  const [revision, setRevision] = useState(0);

  const [snapshot, setSnapshot] = useState<{
    loader: typeof loader;
    revision: number;
    data?: T;
    error?: string;
  }>();

  const controller = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controller.current?.abort();
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;

    void loader(current.signal)
      .then((data) => {
        if (!current.signal.aborted) {
          setSnapshot({ loader, revision, data });
        }
      })
      .catch((cause: unknown) => {
        if (!current.signal.aborted) {
          setSnapshot({
            loader,
            revision,
            error:
              cause instanceof Error
                ? cause.message
                : "No se pudo consultar.",
          });
        }
      });

    return () => current.abort();
  }, [loader, revision]);

  const current =
    snapshot?.loader === loader && snapshot.revision === revision;

  return {
    data: current ? snapshot.data : undefined,
    error: current ? snapshot.error : undefined,
    loading: !current,
    reload,
  };
}
