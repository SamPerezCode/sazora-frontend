import { useEffect, useState } from "react";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import type { Product } from "../schemas/product.schema";
import type { ComboDetail } from "../schemas/product-action.schema";
import { getComboDetail } from "../services/product.service";

export function ComboDetails({
  product,
  accessToken,
}: {
  product: Product;
  accessToken: string;
}) {
  const [result, setResult] = useState<{
    attempt: number;
    data?: ComboDetail;
    error?: string;
  } | null>(null);

  const [attempt, setAttempt] = useState(0);
  const { id, businessId } = product;

  useEffect(() => {
    const controller = new AbortController();

    void getComboDetail(id, accessToken, controller.signal)
      .then((data) => {
        if (
          data.product.id !== id ||
          data.product.businessId !== businessId
        ) {
          throw new Error("Respuesta de combo incorrecta.");
        }

        if (!controller.signal.aborted) {
          setResult({ attempt, data });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            attempt,
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos cargar el combo.",
          });
        }
      });

    return () => controller.abort();
  }, [id, businessId, accessToken, attempt]);

  if (!result || result.attempt !== attempt) {
    return <LoadingState message="Cargando composición…" />;
  }

  if (result.error) {
    return (
      <Alert>
        <p>{result.error}</p>

        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <ul className="divide-y divide-outline/40">
      {result.data?.components.map((item) => (
        <li
          key={item.productId}
          className="flex items-start justify-between gap-3 py-3 text-sm"
        >
          <div className="min-w-0">
            <p className="font-semibold text-heading [overflow-wrap:anywhere]">
              {item.name}
            </p>

            <p className="mt-1 text-xs text-muted">
              {item.sku || "Sin código"}
              {!item.isActive && " · Inactivo"}
            </p>
          </div>

          <span className="shrink-0 text-accent">
            × {Number(item.quantity)}
          </span>
        </li>
      ))}
    </ul>
  );
}
