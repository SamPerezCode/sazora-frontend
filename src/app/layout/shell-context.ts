import { useOutletContext } from "react-router";
import type { BusinessSettingsResource } from "../../features/business/business-settings.schema";
import type { AuthSession } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/business-profile.schema";
import type { DashboardResource } from "../../features/dashboard/types/dashboard.types";

export interface AppShellContext {
  session: AuthSession;
  dashboard: DashboardResource;
  business: BusinessIdentity;
  settings: BusinessSettingsResource;
}

export function useAppShell(): AppShellContext {
  return useOutletContext<AppShellContext>();
}
