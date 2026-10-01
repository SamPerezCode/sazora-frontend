import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import { getCategories } from "../../categories/services/category.service";
import { getPreparationAreas } from "../../preparation-areas/services/preparation-area.service";
import { productListSchema } from "../schemas/product.schema";
import { comboDetailSchema } from "../schemas/product-action.schema";
import type { ProductMutation } from "../schemas/product-action.schema";

const savedSchema = z.object({
  status: z.literal("success"),
});

const idSchema = z.string().regex(/^[1-9]\d*$/);

export async function getProductCatalog(
  accessToken: string,
  signal: AbortSignal
) {
  const [response, categories, areas] = await Promise.all([
    request("/products", productListSchema, {
      accessToken,
      signal,
    }),
    getCategories(accessToken, signal),
    getPreparationAreas(accessToken, signal),
  ]);

  return {
    products: response.data.products,
    categories,
    areas,
  };
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

export async function saveProduct(
  action: ProductMutation,
  accessToken: string,
  signal: AbortSignal
) {
  if (action.kind === "create") {
    let body: unknown = action.input;

    if (action.file) {
      const error = validateProductImage(action.file);

      if (error) {
        throw new ApiError(400, "INVALID_IMAGE", error);
      }

      const form = new FormData();

      for (const [key, value] of Object.entries(action.input)) {
        if (value !== null) {
          form.append(key, value);
        }
      }

      form.append("image", action.file);
      body = form;
    }

    await request("/products", savedSchema, {
      method: "POST",
      body,
      accessToken,
      signal,
    });

    return;
  }
  const id = idSchema.parse(action.id);

  let path = `/products/${id}`;
  let method: "PATCH" | "POST" | "PUT" | "DELETE" = "PATCH";
  let body: unknown;

  switch (action.kind) {
    case "edit":
      if (action.isCombo) {
        path = `/products/combos/${id}`;
      }
      body = action.input;
      break;

    case "status":
      path += "/status";
      body = { isActive: action.isActive };
      break;

    case "inventory":
      path += "/inventory-setup";
      method = "POST";
      body = action.input;
      break;

    case "image": {
      const error = validateProductImage(action.file);

      if (error) {
        throw new ApiError(400, "INVALID_IMAGE", error);
      }

      const form = new FormData();
      form.append("image", action.file);

      path += "/image";
      method = "PUT";
      body = form;
      break;
    }

    case "remove-image":
      path += "/image";
      method = "DELETE";
      break;
  }

  await request(path, savedSchema, {
    method,
    body,
    accessToken,
    signal,
  });
}

export async function getComboDetail(
  id: string,
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request(
    `/products/combos/${idSchema.parse(id)}`,
    comboDetailSchema,
    { accessToken, signal }
  );

  return response.data.combo;
}
