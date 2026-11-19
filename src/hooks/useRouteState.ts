import type { Dispatch, SetStateAction } from "react";

import { useLocation, useNavigate } from "react-router";

const pendingRoutes = new Map<string, string>();

function decode<T>(raw: string | null, initial: T): T {
  if (raw === null) return initial;

  try {
    const value: unknown = JSON.parse(raw);

    if (typeof initial === "number") {
      return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0
          ? value
          : initial
      ) as T;
    }

    if (typeof initial === "string") {
      return (typeof value === "string" ? value : initial) as T;
    }

    if (
      initial &&
      typeof initial === "object" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      return Object.fromEntries(
        Object.entries(initial).map(([key, fallback]) => {
          const field = (value as Record<string, unknown>)[key];

          return [
            key,
            typeof field === typeof fallback ? field : fallback,
          ];
        })
      ) as T;
    }
  } catch {
    // Una URL inválida usa los filtros predeterminados.
  }

  return initial;
}

// Exclusivamente estado visual.
// Nunca guardar formularios de pago aquí.
export function useRouteState<T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const location = useLocation();
  const navigate = useNavigate();

  const value = decode(
    new URLSearchParams(location.search).get(key),
    initial
  );

  const setValue: Dispatch<SetStateAction<T>> = (action) => {
    const search = pendingRoutes.get(location.key) ?? location.search;

    const params = new URLSearchParams(search);

    const previous = decode(params.get(key), initial);

    const next =
      typeof action === "function"
        ? (action as (previous: T) => T)(previous)
        : action;

    if (JSON.stringify(next) === JSON.stringify(initial)) {
      params.delete(key);
    } else {
      params.set(key, JSON.stringify(next));
    }

    pendingRoutes.set(location.key, params.toString());

    if (pendingRoutes.size > 50) {
      pendingRoutes.delete(pendingRoutes.keys().next().value!);
    }

    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      {
        replace: true,
        state: location.state,
      }
    );
  };

  return [value, setValue];
}
