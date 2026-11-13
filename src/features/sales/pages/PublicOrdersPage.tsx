import { useAppShell } from "../../../app/layout/shell-context";
import { RequestList } from "../components/public-orders/PublicRequestList";
import "../public-orders.css";

export function PublicOrdersPage() {
  const { session } = useAppShell();
  const scope = JSON.stringify([
    session.business.id, session.membership.id,
    session.accessToken, session.authorization.permissions,
  ]);
  return <RequestList key={scope} />;
}
