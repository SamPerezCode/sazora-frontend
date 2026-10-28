import { useSearchParams } from "react-router";
import { useAppShell } from "../../../app/layout/shell-context";
import { InventoryLocationPage } from "./InventoryLocationPage";
import { ProductionPage } from "../production/ProductionPage";

export function InventoryPage() {
  const { session } = useAppShell();
  const [params] = useSearchParams();
  const productionOnly = !session.authorization.roles.includes("ADMIN") &&
    session.authorization.roles.includes("PRODUCTION");
  const key = session.business.id + ":" + session.membership.id + ":" + session.accessToken;
  return productionOnly || params.get("tab") === "production"
    ? <ProductionPage key={key} />
    : <InventoryLocationPage key={key} />;
}
