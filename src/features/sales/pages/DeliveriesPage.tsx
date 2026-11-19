import { useAppShell } from "../../../app/layout/shell-context";
import { hasPermission } from "../../auth/utils/permissions";
import { DeliveryList } from "../components/deliveries/DeliveryList";

import "../public-orders.css";

export function DeliveriesPage() {
  const { session } = useAppShell();

  if (!hasPermission(session, "deliveries.read")) {
    return (
      <p role="alert">No tienes permiso para consultar domicilios.</p>
    );
  }

  const scope = JSON.stringify([
    session.business.id,
    session.membership.id,
    session.accessToken,
    session.authorization.permissions,
  ]);

  return <DeliveryList key={scope} />;
}
