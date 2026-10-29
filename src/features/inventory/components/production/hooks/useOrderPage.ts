import { useCallback } from "react";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../hooks/useInventoryQuery";
import { orderPage } from "../services/production.queries";
import { productionRoles } from "../utils/production.access";

export function useOrderPage(idsKey: string, revision: number) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      orderPage(session, signal, JSON.parse(idsKey) as string[]),
    [idsKey]
  );

  return useInventoryQuery(
    "production-order-page:" + idsKey,
    loader,
    revision,
    productionRoles
  );
}
