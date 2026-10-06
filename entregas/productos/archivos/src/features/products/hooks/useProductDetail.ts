import { useEffect, useState } from "react";
import { getProductDetail } from "../services/product.service";
import type { CatalogDetail } from "../schemas/product-action.schema";

export function useProductDetail(id: string, isCombo: boolean, businessId: string, token: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: CatalogDetail; error?: string } | null>(null);
  const key = `${businessId}:${id}:${isCombo}:${token}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    void getProductDetail(id, isCombo, token, controller.signal).then(data => {
      if (data.id !== id || data.businessId !== businessId) throw new Error("No pudimos verificar el producto.");
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(cause => {
      if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : "No pudimos cargar el detalle." });
    });
    return () => controller.abort();
  }, [id, isCombo, businessId, token, key]);
  return { data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    retry: () => setAttempt(v => v + 1) };
}
