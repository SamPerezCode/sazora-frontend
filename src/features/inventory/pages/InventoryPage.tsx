import { Navigate, useSearchParams } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";

import { InventoryLocationPage } from "./InventoryLocationPage";
import { InventoryProduction } from "../components/InventoryProduction";
import { InventoryProductionStockPage } from "./InventoryProductionStockPage";
import { Notice } from "../components/InventoryLocationUI";

import {
  canConfigureProductInventory,
  canOpenInventoryTab,
  canOpenInventoryWorkspace,
  canOpenProduction,
} from "../utils/inventory-access";

export function InventoryPage() {
  const { session } = useAppShell();
  const [params] = useSearchParams();

  const inventory = canOpenInventoryWorkspace(session);
  const production = canOpenProduction(session);

  const key = JSON.stringify([
    session.business.id,
    session.membership.id,
    session.accessToken,
    session.authorization,
  ]);

  if (!inventory && !production) {
    return <Notice>No tienes acceso a este módulo.</Notice>;
  }

  if (!inventory) {
    return params.get("tab") === "stock" ? (
      <InventoryProductionStockPage key={key} />
    ) : (
      <InventoryProduction key={key} />
    );
  }

  const configuring =
    params.get("intent") === "configure" ||
    params.has("setupProductId");

  const productId =
    params.get("setupProductId") ?? params.get("productId") ?? "";

  const tab =
    params.get("tab") ?? (productId ? "consumption" : "stock");

  if (
    !canOpenInventoryTab(session, tab) ||
    (configuring && !canConfigureProductInventory(session))
  ) {
    const next = new URLSearchParams(params);

    next.set("tab", "stock");
    next.delete("productId");
    next.delete("setupProductId");
    next.delete("intent");

    return (
      <Navigate
        to={{
          pathname: "/inventario",
          search: "?" + next.toString(),
        }}
        replace
      />
    );
  }

  return tab === "production" ? (
    <InventoryProduction key={key} />
  ) : (
    <InventoryLocationPage key={key} />
  );
}
