import { useSearchParams } from "react-router";
import { useAppShell } from "../../../app/layout/shell-context";
import { InventoryLocationPage } from "./InventoryLocationPage";
import { InventoryProduction } from "../components/InventoryProduction";
import { InventoryProductionStockPage } from "./InventoryProductionStockPage";

export function InventoryPage() {
  const { session } = useAppShell();
  const [params] = useSearchParams();

  const productionOnly =
    !session.authorization.roles.includes("ADMIN") &&
    session.authorization.roles.includes("PRODUCTION");

  const key = [
    session.business.id,
    session.membership.id,
    session.accessToken,
    JSON.stringify(session.authorization),
  ].join(":");

  if (productionOnly) {
    return params.get("tab") === "stock" ? (
      <InventoryProductionStockPage key={key} />
    ) : (
      <InventoryProduction key={key} />
    );
  }

  return params.get("tab") === "production" ? (
    <InventoryProduction key={key} />
  ) : (
    <InventoryLocationPage key={key} />
  );
}
