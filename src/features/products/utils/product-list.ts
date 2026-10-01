import type { Product } from "../schemas/product.schema";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function filterProducts(
  products: readonly Product[],
  query: string,
  categoryId: string
): Product[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);

  return products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) {
      return false;
    }

    const text = normalize(
      [
        product.name,
        product.sku,
        product.description,
        product.categoryName,
        product.preparationAreaName,
      ]
        .filter(Boolean)
        .join(" ")
    );

    return terms.every((term) => text.includes(term));
  });
}

const amountFormatter = new Intl.NumberFormat("es-CO");

export function formatProductPrice(value: string): string {
  const [whole, decimals = ""] = value.split(".");
  const fraction = decimals.padEnd(2, "0");

  return `$ ${amountFormatter.format(BigInt(whole))}${
    fraction === "00" ? "" : `,${fraction}`
  }`;
}
