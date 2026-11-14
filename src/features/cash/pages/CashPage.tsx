import { useAppShell } from "../../../app/layout/shell-context";
import { hasPermission } from "../../auth/utils/permissions";
import { CashBoard } from "../components/CashBoard";

import "../cash.css";

export function CashPage() {
  const { session } = useAppShell();

  if (!hasPermission(session, "cash.sessions.read")) {
    return (
      <p role="alert">
        No tienes permiso para consultar cajas y turnos.
      </p>
    );
  }

  const scope = JSON.stringify([
    session.business.id,
    session.membership.id,
    session.accessToken,
    session.authorization.permissions,
    session.authorization.locationAccess,
  ]);

  return <CashBoard key={scope} />;
}
