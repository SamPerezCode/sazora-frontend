import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { ProductMutation } from "../schemas/product-action.schema";
import {
  getProductCatalog,
  saveProduct,
} from "../services/product.service";

type Catalog = Awaited<ReturnType<typeof getProductCatalog>>;

interface Snapshot {
  scope: string;
  attempt: number;
  data: Catalog | null;
  error: string | null;
}

export function useProducts(session: AuthSession) {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const write = useRef<AbortController | null>(null);
  const read = useRef<AbortController | null>(null);

  const { accessToken } = session;
  const businessId = session.business.id;
  const allowed = session.authorization.roles.includes("ADMIN");
  const scope = `${businessId}:${session.membership.id}:${accessToken}`;

  function verify(data: Catalog) {
    if (
      [...data.products, ...data.categories, ...data.areas].some(
        (item) => item.businessId !== businessId
      )
    ) {
      throw new ApiError(
        502,
        "BUSINESS_MISMATCH",
        "No pudimos verificar el catálogo."
      );
    }

    return data;
  }

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();
    read.current = controller;

    void getProductCatalog(accessToken, controller.signal)
      .then((data) => {
        if (
          [...data.products, ...data.categories, ...data.areas].some(
            (item) => item.businessId !== businessId
          )
        ) {
          throw new ApiError(
            502,
            "BUSINESS_MISMATCH",
            "No pudimos verificar el catálogo."
          );
        }

        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            data,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            data: null,
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos cargar los productos.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, businessId, allowed, scope, attempt]);

  useEffect(
    () => () => {
      write.current?.abort();
      write.current = null;
    },
    [scope]
  );

  const current =
    snapshot?.scope === scope && snapshot.attempt === attempt
      ? snapshot
      : null;

  async function mutate(
    action: ProductMutation
  ): Promise<string | null> {
    if (!allowed) {
      throw new ApiError(403, "FORBIDDEN", "No tienes acceso.");
    }

    if (write.current || !current?.data) {
      throw new ApiError(
        409,
        "BUSY",
        "Espera a que termine la solicitud actual."
      );
    }

    const controller = new AbortController();
    write.current = controller;
    read.current?.abort();
    setBusy(true);

    try {
      await saveProduct(action, accessToken, controller.signal);
      controller.signal.throwIfAborted();

      try {
        const data = verify(
          await getProductCatalog(accessToken, controller.signal)
        );

        controller.signal.throwIfAborted();

        setSnapshot({
          scope,
          attempt,
          data,
          error: null,
        });

        return null;
      } catch (error) {
        if (controller.signal.aborted) throw error;

        const message =
          "La acción se guardó, pero no pudimos actualizar el listado. Pulsa Reintentar.";

        setSnapshot({
          scope,
          attempt,
          data: null,
          error: message,
        });

        return message;
      }
    } finally {
      if (write.current === controller) {
        write.current = null;
        setBusy(false);
      }
    }
  }

  return {
    data: allowed ? (current?.data ?? null) : null,
    loading: allowed && current === null,
    error: allowed
      ? (current?.error ?? null)
      : "No tienes acceso a los productos.",
    busy,
    mutate,
    retry: () => {
      if (!write.current) {
        setAttempt((value) => value + 1);
      }
    },
  };
}
