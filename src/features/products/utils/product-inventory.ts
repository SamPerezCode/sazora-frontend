import { getNavigation } from "../../../app/navigation";

export function productInventoryPath(
  productId: string,
  hasInventory: boolean
): string | null {
  const route = getNavigation(["ADMIN"]).find(
    (item) => item.id === "inventory"
  );

  if (!route || route.status !== "ready") {
    return null;
  }

  const params = new URLSearchParams({
    productId,
    intent: hasInventory ? "manage" : "configure",
  });

  const separator = route.to.includes("?") ? "&" : "?";

  return `${route.to}${separator}${params.toString()}`;
}
