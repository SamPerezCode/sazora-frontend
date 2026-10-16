import { useCallback, useEffect, useRef, useState } from "react";

import type { AuthSession } from "../../auth/types/auth.types";

import { useAuth } from "../../auth/hooks/useAuth";
import { getLocations } from "../../business/services/organization.service";

import type { SalesLocation } from "../services/sales.service";

const selectedLocations = new Map<string, string>();

export function assignedSalesLocations(
  session: AuthSession
): SalesLocation[] {
  return session.authorization.locationAccess.locations.filter(
    (location) =>
      location.locationType === "POINT_OF_SALE" &&
      location.isActive !== false
  );
}

export function initialSalesLocation(
  session: AuthSession,
  options: SalesLocation[]
): string {
  if (session.authorization.roles.includes("ADMIN")) {
    return options.length === 1 ? options[0].id : "";
  }

  const preferred =
    session.authorization.locationAccess.defaultLocationId;

  return (
    options.find((location) => location.id === preferred)?.id ??
    (options.length === 1 ? options[0].id : "")
  );
}

export function useSalesLocations(session: AuthSession) {
  const { refreshSession } = useAuth();

  const selectionKey = [
    session.business.id,
    session.membership.id,
    session.user.id,
  ].join(":");

  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(
    () => selectedLocations.get(selectionKey) ?? ""
  );
  const [issue, setIssue] = useState("");

  const rejected = useRef(new Set<string>());
  const selected = useRef(selectedId);

  const [snapshot, setSnapshot] = useState<{
    revision: number;
    options: SalesLocation[];
    error: string;
  } | null>(null);

  const isAdmin = session.authorization.roles.includes("ADMIN");

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      try {
        const available = isAdmin
          ? (
              await getLocations(session, controller.signal, {
                activeOnly: true,
              })
            ).filter(
              (location) =>
                location.isActive &&
                location.locationType === "POINT_OF_SALE"
            )
          : assignedSalesLocations(session);

        if (controller.signal.aborted) return;

        const options = available.filter(
          (location) => !rejected.current.has(location.id)
        );

        setSnapshot({
          revision,
          options,
          error: "",
        });

        const next = options.some(
          (location) => location.id === selected.current
        )
          ? selected.current
          : initialSalesLocation(session, options);

        selected.current = next;
        selectedLocations.set(selectionKey, next);
        setSelectedId(next);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setSnapshot({
            revision,
            options: [],
            error:
              cause instanceof Error
                ? cause.message
                : "No pudimos consultar los puntos de venta.",
          });
        }
      }
    };

    void run();

    return () => controller.abort();
  }, [session, isAdmin, revision, selectionKey]);

  const options =
    snapshot?.revision === revision ? snapshot.options : [];

  const permitted = isAdmin
    ? options
    : options.filter((option) =>
        assignedSalesLocations(session).some(
          (location) => location.id === option.id
        )
      );

  const location =
    permitted.find((option) => option.id === selectedId) ?? null;

  const invalidate = useCallback(
    (message: string) => {
      if (selected.current) {
        rejected.current.add(selected.current);
      }

      selectedLocations.delete(selectionKey);
      selected.current = "";
      setSelectedId("");
      setIssue(message);
      setRevision((value) => value + 1);

      void refreshSession();
    },
    [refreshSession, selectionKey]
  );

  return {
    options: permitted,
    location,
    issue,
    loading: snapshot?.revision !== revision,
    error: snapshot?.revision === revision ? snapshot.error : "",

    select(id: string) {
      if (!permitted.some((option) => option.id === id)) return;

      selected.current = id;
      selectedLocations.set(selectionKey, id);
      setSelectedId(id);
      setIssue("");
    },

    invalidate,

    retry() {
      rejected.current.clear();
      setRevision((value) => value + 1);
      void refreshSession();
    },
  };
}
