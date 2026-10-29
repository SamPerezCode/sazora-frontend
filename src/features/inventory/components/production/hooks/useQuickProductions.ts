import { useCallback, useState } from "react";

import type { AuthSession } from "../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../hooks/useInventoryQuery";

import { productionRoles } from "../utils/production.access";
import {
  listQuickProductions,
  getQuickProductionPage,
} from "../services/quick-production.service";

export function useQuickProductions(
  locationId: string,
  revision: number
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      listQuickProductions(session, signal, locationId),
    [locationId]
  );

  const query = useInventoryQuery(
    "quick-productions:" + locationId,
    load,
    revision,
    productionRoles
  );

  const rows = query.data ?? [];

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / pageSize))
  );

  const visible = rows.slice(
    (current - 1) * pageSize,
    current * pageSize
  );

  const idsKey = JSON.stringify(visible.map((row) => row.id));

  const loadDetails = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      getQuickProductionPage(
        session,
        signal,
        JSON.parse(idsKey) as string[],
        locationId
      ),
    [idsKey, locationId]
  );

  const details = useInventoryQuery(
    "quick-production-page:" + locationId + ":" + idsKey,
    loadDetails,
    revision,
    productionRoles
  );

  return {
    query,
    details,
    visible,
    current,
    pageSize,
    total: rows.length,
    setPage,
    changePageSize: (value: number) => {
      setPageSize(value);
      setPage(1);
    },
  };
}
