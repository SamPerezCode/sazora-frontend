import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../lib/http/client";
import type { SalesScope } from "../sales/services/sales.service";

import {
  getKitchenSettings,
  updateKitchenSettings,
} from "./kitchen-flow.service";

import { kitchenErrorMessage } from "./kitchen-flow.schema";

import type {
  KitchenWorkflowMode,
  LocationKitchenSettings,
} from "./kitchen-flow.schema";

const settingsChangedEvent = "sazora:kitchen-settings-changed";

export function useKitchenSettings(
  token: string,
  scope: SalesScope | null,
  onLocationLost: (message: string) => void
) {
  const key = JSON.stringify([
    "kitchen-settings",
    scope?.businessId,
    scope?.location.id,
    token,
  ]);

  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);

  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: LocationKitchenSettings | null;
    error: string;
  } | null>(null);

  const locked = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (!locked.current) {
        setRevision((value) => value + 1);
      }
    };

    const changed = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          businessId: string;
          locationId: string;
        }>
      ).detail;

      if (
        detail?.businessId === scope?.businessId &&
        detail?.locationId === scope?.location.id
      ) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    window.addEventListener(settingsChangedEvent, changed);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(settingsChangedEvent, changed);
    };
  }, [scope?.businessId, scope?.location.id]);

  useEffect(() => {
    if (!scope || locked.current) return;

    const controller = new AbortController();
    const current = ++generation.current;

    async function load() {
      try {
        const value = await getKitchenSettings(
          token,
          scope!,
          controller.signal
        );

        if (
          !controller.signal.aborted &&
          current === generation.current
        ) {
          setSnapshot({ key, value, error: "" });
        }
      } catch (cause) {
        if (
          controller.signal.aborted ||
          current !== generation.current
        ) {
          return;
        }

        const message = kitchenErrorMessage(cause);

        setSnapshot({ key, value: null, error: message });

        if (
          cause instanceof ApiError &&
          [
            "LOCATION_ACCESS_DENIED",
            "LOCATION_NOT_POINT_OF_SALE",
          ].includes(cause.code)
        ) {
          onLocationLost(message);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [token, scope, key, revision, onLocationLost]);

  const current = snapshot?.key === key ? snapshot : null;

  async function save(mode: KitchenWorkflowMode) {
    if (!scope || locked.current) return null;

    locked.current = true;
    generation.current++;
    setSaving(true);

    try {
      const value = await updateKitchenSettings(token, scope, mode);

      if (mounted.current) {
        setSnapshot({ key, value, error: "" });
      }

      window.dispatchEvent(
        new CustomEvent(settingsChangedEvent, {
          detail: {
            businessId: scope.businessId,
            locationId: scope.location.id,
          },
        })
      );

      return value;
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        [
          "LOCATION_ACCESS_DENIED",
          "LOCATION_NOT_POINT_OF_SALE",
        ].includes(cause.code)
      ) {
        onLocationLost(kitchenErrorMessage(cause));
      }

      throw cause;
    } finally {
      locked.current = false;

      if (mounted.current) setSaving(false);
    }
  }

  return {
    data: current?.value ?? null,
    error: current?.error ?? "",
    loading: !!scope && !current,
    saving,
    save,
    retry: () => setRevision((value) => value + 1),
  };
}
