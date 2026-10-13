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

  const params = new URLSearchParams({
    productId: product.id,
    intent: product.hasInventory ? "manage" : "configure",
  });

  return "/inventario?" + params.toString();
}
