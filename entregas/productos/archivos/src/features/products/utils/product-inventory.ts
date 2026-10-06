import { getNavigation } from "../../../app/navigation";

export function productInventoryPath(productId: string, hasInventory: boolean): string | null {
  const route = getNavigation(["ADMIN"]).find(item => item.id === "inventory");
  if (!route || route.status !== "ready") return null;
  // El destino recibe el producto; Inventario decidirá cómo abrir su configuración.
  const params = new URLSearchParams({
    productId, intent: hasInventory ? "manage" : "configure",
  });
  return route.to + (route.to.includes("?") ? "&" : "?") + params.toString();
}
