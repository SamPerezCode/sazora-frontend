import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { ProductMutation } from "../schemas/product-action.schema";
import {
  getProductCatalog,
  getProductDetail,
  saveProduct,
} from "../services/product.service";

type Catalog = Awaited<ReturnType<typeof getProductCatalog>>;

interface Snapshot {
  scope: string;
  data: Catalog | null;
  error: string | null;
}

function verify(data: Catalog, businessId: string) {
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

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();
    read.current = controller;

    void getProductCatalog(accessToken, controller.signal)
      .then((data) => {
        const checked = verify(data, businessId);

        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            data: checked,
            error: null,
          });
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setSnapshot((previous) => ({
            scope,
            data: previous?.scope === scope ? previous.data : null,
            error:
              cause instanceof Error
                ? cause.message
                : "No pudimos cargar los productos.",
          }));
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

  const current = snapshot?.scope === scope ? snapshot : null;

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

      const existing =
        action.kind === "create"
          ? undefined
          : current.data.products.find(
              (product) => product.id === action.id
            );

      const [catalog, detail] = await Promise.allSettled([
        getProductCatalog(accessToken, controller.signal).then(
          (data) => verify(data, businessId)
        ),
        existing
          ? getProductDetail(
              existing.id,
              existing.isCombo,
              accessToken,
              controller.signal
            )
          : Promise.resolve(null),
      ]);

      controller.signal.throwIfAborted();

      let next =
        catalog.status === "fulfilled" ? catalog.value : current.data;

      let detailError = "";

      if (detail.status === "fulfilled" && detail.value && existing) {
        if (
          detail.value.id !== existing.id ||
          detail.value.businessId !== businessId
        ) {
          detailError =
            "No pudimos verificar el detalle actualizado.";
        } else {
          const updated = detail.value;

          next = {
            ...next,
            products: next.products.map((product) =>
              product.id === updated.id
                ? { ...product, ...updated }
                : product
            ),
          };
        }
      } else if (detail.status === "rejected") {
        detailError =
          detail.reason instanceof Error
            ? detail.reason.message
            : "No pudimos actualizar el detalle.";
      }

      if (action.kind === "remove-image") {
        next = {
          ...next,
          products: next.products.map((product) =>
            product.id === action.id
              ? { ...product, imageUrl: null }
              : product
          ),
        };
      }

      const listError =
        catalog.status === "rejected"
          ? catalog.reason instanceof Error
            ? catalog.reason.message
            : "No pudimos actualizar el listado."
          : "";

      const warning = [listError, detailError]
        .filter(Boolean)
        .join(" ");

      setSnapshot({
        scope,
        data: next,
        error: warning ? `El cambio se guardó. ${warning}` : null,
      });

      return warning
        ? `El cambio se guardó. ${warning} Reintenta la consulta, no el guardado.`
        : null;
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
