import { useAppShell } from "../../../app/layout/shell-context";
import { InventoryLocationPage } from "./InventoryLocationPage";

export function InventoryPage() {
  const { session } = useAppShell();

  return (
    <InventoryLocationPage
      key={
        session.business.id +
        ":" +
        session.membership.id +
        ":" +
        session.accessToken
      }
    />
  );
}
