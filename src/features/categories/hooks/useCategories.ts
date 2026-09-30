import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import { ApiError } from "../../../lib/http/client";
import type {
  Category,
  CategoryAction,
} from "../schemas/category.schema";
import {
  getCategories,
  saveCategory,
} from "../services/category.service";

interface Snapshot {
  scope: string;
  attempt: number;
  categories: Category[];
  error: string | null;
}

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }) ||
      (BigInt(a.id) < BigInt(b.id)
        ? -1
        : BigInt(a.id) > BigInt(b.id)
          ? 1
          : 0)
  );
}

export function useCategories(session: AuthSession) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingScope, setPendingScope] = useState<string | null>(
    null
  );

  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);

  const { accessToken, business, membership } = session;
  const businessId = business.id;
  const allowed = session.authorization.roles.includes("ADMIN");
  const scope = `${businessId}:${membership.id}:${accessToken}`;

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();
    readController.current = controller;

    void getCategories(accessToken, controller.signal)
      .then((categories) => {
        if (
          categories.some(
            (category) => category.businessId !== businessId
          )
        ) {
          throw new ApiError(
            502,
            "BUSINESS_MISMATCH",
            "No pudimos verificar las categorías."
          );
        }

        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            categories,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            categories: [],
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos cargar las categorías.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, businessId, allowed, scope, attempt]);

  useEffect(
    () => () => {
      writeController.current?.abort();
      writeController.current = null;
    },
    [scope, allowed]
  );

  const current =
    snapshot?.scope === scope && snapshot.attempt === attempt
      ? snapshot
      : null;

  async function mutate(action: CategoryAction): Promise<Category> {
    if (!allowed) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "No tienes acceso a las categorías."
      );
    }

    if (writeController.current) {
      throw new ApiError(
        409,
        "REQUEST_PENDING",
        "Espera a que termine el guardado."
      );
    }

    readController.current?.abort();

    const controller = new AbortController();
    writeController.current = controller;
    setPendingScope(scope);

    try {
      const category = await saveCategory(
        action,
        accessToken,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (
        category.businessId !== businessId ||
        (action.kind !== "create" && category.id !== action.id)
      ) {
        throw new ApiError(
          502,
          "CATEGORY_MISMATCH",
          "No pudimos verificar la categoría guardada."
        );
      }

      setSnapshot((previous) => ({
        scope,
        attempt,
        error: null,
        categories: sortCategories([
          ...(previous?.scope === scope
            ? previous.categories
            : []
          ).filter((item) => item.id !== category.id),
          category,
        ]),
      }));

      return category;
    } finally {
      if (writeController.current === controller) {
        writeController.current = null;
        setPendingScope(null);
      }
    }
  }

  return {
    categories: allowed ? (current?.categories ?? []) : [],
    loading: allowed && current === null,
    error: allowed
      ? (current?.error ?? null)
      : "No tienes acceso a las categorías.",
    busy: pendingScope === scope,
    mutate,
    retry: () => {
      if (!writeController.current) {
        setAttempt((value) => value + 1);
      }
    },
  };
}
