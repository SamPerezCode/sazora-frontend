import { useAppShell } from "../../../app/layout/shell-context";
import { DeliveryList } from "../components/deliveries/DeliveryList";
import "../public-orders.css";

export function DeliveriesPage() {
  const { session } = useAppShell();
  const scope = JSON.stringify([
    session.business.id, session.membership.id,
    session.accessToken, session.authorization.permissions,
  ]);
  return <DeliveryList key={scope} />;
}
