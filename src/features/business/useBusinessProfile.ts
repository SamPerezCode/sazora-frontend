import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "../auth/types/auth.types";
import type { BusinessIdentity } from "./business-profile.schema";
import { getBusinessIdentity } from "./business-profile.service";

type ProfileResult = {
  businessId: string;
  attempt: number;
} & (
  | { status: "success"; business: BusinessIdentity }
  | { status: "error"; message: string }
);

export function useBusinessProfile(session: AuthSession | null) {
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const businessId = session?.business.id;
  const accessToken = session?.accessToken;

  const canReadProfile =
    session?.authorization.roles.includes("ADMIN") ?? false;

  useEffect(() => {
    if (!businessId || !accessToken || !canReadProfile) {
      return;
    }

    const controller = new AbortController();

    void getBusinessIdentity(
      businessId,
      accessToken,
      controller.signal
    )
      .then((business) => {
        if (!controller.signal.aborted) {
          setResult({
            businessId,
            attempt,
            status: "success",
            business,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({
            businessId,
            attempt,
            status: "error",
            message:
              "No pudimos actualizar la información del negocio.",
          });
        }
      });

    return () => controller.abort();
  }, [businessId, accessToken, canReadProfile, attempt]);

  const current =
    canReadProfile &&
    result !== null &&
    result.businessId === businessId &&
    result.attempt === attempt
      ? result
      : null;

  const business: BusinessIdentity | null = !session
    ? null
    : current?.status === "success"
      ? current.business
      : {
          ...session.business,
          logoUrl: null,
        };

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return {
    business,
    loading: canReadProfile && current === null,
    error: current?.status === "error" ? current.message : null,
    retry,
  };
}
