import { useCallback } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { useRemote } from "../../sales/hooks/usePublicOrders";
import { loadInventoryLocations } from "../services/inventory-location.service";

export function useInventorySetupLocations(enabled = true) {
  const { session } = useAppShell();

  const load = useCallback(
    (signal: AbortSignal) =>
      enabled
        ? loadInventoryLocations(session, signal)
        : Promise.resolve([]),
    [enabled, session]
  );

  const resource = useRemote(load);
  const locations = resource.data ?? [];

  return {
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,

    options: locations.map((location) => ({
      value: location.id,
      label: location.name + " · " + location.code,
    })),

    hasSelection: (locationId: string) =>
      !resource.loading &&
      !resource.error &&
      locations.some((location) => location.id === locationId),
  };
}
