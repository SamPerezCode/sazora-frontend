import type { AuthSession } from "../../auth/types/auth.types";

import { useOperationsSync } from "../../../hooks/useOperationsSync";

export function usePublicRequestsRealtime(
  session: AuthSession,
  reload: () => void
) {
  useOperationsSync(session.accessToken, ["requests"], reload);
}
