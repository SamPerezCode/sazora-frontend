import { getNavigation } from "../../../app/navigation";
import type { Product } from "../schemas/product.schema";

export function productCompositionPath(productId: string): string {
  const params = new URLSearchParams({
    editComboId: productId,
  });

  return "/productos?" + params.toString();
}

export function productInventoryPath(
  product: Pick<Product, "id" | "isCombo" | "hasInventory">
): string | null {
  if (product.isCombo) {
    return productCompositionPath(product.id);
  }

  const route = getNavigation(["ADMIN"]).find(
    (item) => item.id === "inventory"
  );

  if (!route || route.status !== "ready") {
    return null;
  }

  const params = new URLSearchParams({
    productId: product.id,
    intent: product.hasInventory ? "manage" : "configure",
  });

  const separator = route.to.includes("?") ? "&" : "?";

  return route.to + separator + params.toString();
}
