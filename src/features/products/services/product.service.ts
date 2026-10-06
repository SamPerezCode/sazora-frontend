import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import { getCategories } from "../../categories/services/category.service";
import { getPreparationAreas } from "../../preparation-areas/services/preparation-area.service";
import {
  productIdSchema,
  productListSchema,
  productDetailResponseSchema,
} from "../schemas/product.schema";
import {
  comboResponseSchema,
  componentsSchema,
  productEditSchema,
} from "../schemas/product-action.schema";
import type {
  CatalogDetail,
  ProductMutation,
} from "../schemas/product-action.schema";

const savedSchema = z.object({
  status: z.literal("success"),
});

export async function getProductCatalog(
  accessToken: string,
  signal: AbortSignal
) {
  const [products, categories, areas] = await Promise.all([
    getAllProducts(accessToken, signal),
    getCategories(accessToken, signal),
    getPreparationAreas(accessToken, signal),
  ]);

  return { products, categories, areas };
}

async function getAllProducts(
  accessToken: string,
  signal: AbortSignal
) {
  const first = await request("/products", productListSchema, {
    accessToken,
    signal,
  });

  const products = [...first.data.products];
  const pagination = first.data.pagination;

  if (pagination) {
    for (
      let page = pagination.page + 1;
      page <= pagination.totalPages;
      page++
    ) {
      const result = await request(
        `/products?page=${page}&pageSize=${pagination.pageSize}`,
        productListSchema,
        { accessToken, signal }
      );

      products.push(...result.data.products);
    }
  }

  return [
    ...new Map(
      products.map((product) => [product.id, product])
    ).values(),
  ];
}

export function validateProductImage(file: File): string | null {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    return "Selecciona una imagen JPEG, PNG o WebP.";
  }

  if (!file.size || file.size > 5 * 1024 * 1024) {
    return "La imagen debe contener datos y pesar como máximo 5 MB.";
  }

  return null;
}

export async function getProductDetail(
  id: string,
  isCombo: boolean,
  accessToken: string,
  signal: AbortSignal
): Promise<CatalogDetail> {
  const validId = productIdSchema.parse(id);

  if (isCombo) {
    const result = await request(
      `/products/combos/${validId}`,
      comboResponseSchema,
      { accessToken, signal }
    );

    return result.data.product;
  }

  const result = await request(
    `/products/${validId}`,
    productDetailResponseSchema,
    { accessToken, signal }
  );

  return result.data.product;
}

export async function saveProduct(
  action: ProductMutation,
  accessToken: string,
  signal: AbortSignal
) {
  const options = { accessToken, signal };

  if (action.kind === "create") {
    const input = productEditSchema.parse(action.input);

    const components = action.isCombo
      ? componentsSchema.parse(action.components)
      : undefined;

    if (action.file) {
      const error = validateProductImage(action.file);

      if (error) {
        throw new ApiError(400, "INVALID_IMAGE", error);
      }
    }

    let body: unknown = input;

    if (action.file || action.isCombo) {
      const form = new FormData();

      for (const [key, value] of Object.entries(input)) {
        if (value !== null) {
          form.append(key, value);
        }
      }

      if (components) {
        form.append("components", JSON.stringify(components));
      }

      if (action.file) {
        form.append("image", action.file);
      }

      body = form;
    }

    await request(
      action.isCombo ? "/products/combos" : "/products",
      savedSchema,
      {
        ...options,
        method: "POST",
        body,
      }
    );

    return;
  }

  const id = productIdSchema.parse(action.id);

  if (action.kind === "edit") {
    const input = productEditSchema.partial().parse(action.input);

    const body =
      action.isCombo && action.components !== undefined
        ? {
            ...input,
            components: componentsSchema.parse(action.components),
          }
        : input;

    await request(
      action.isCombo ? `/products/combos/${id}` : `/products/${id}`,
      savedSchema,
      {
        ...options,
        method: "PATCH",
        body,
      }
    );
  } else if (action.kind === "status") {
    await request(`/products/${id}/status`, savedSchema, {
      ...options,
      method: "PATCH",
      body: { isActive: action.isActive },
    });
  } else if (action.kind === "image") {
    const error = validateProductImage(action.file);

    if (error) {
      throw new ApiError(400, "INVALID_IMAGE", error);
    }

    const form = new FormData();
    form.append("image", action.file);

    await request(`/products/${id}/image`, savedSchema, {
      ...options,
      method: "PUT",
      body: form,
    });
  } else {
    await request(
      `/products/${id}/image`,
      z.union([savedSchema, z.null()]),
      {
        ...options,
        method: "DELETE",
      }
    );
  }
}
