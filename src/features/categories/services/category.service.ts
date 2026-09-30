import { ApiError, request } from "../../../lib/http/client";
import {
  categoryIdSchema,
  categoryListSchema,
  categoryResponseSchema,
} from "../schemas/category.schema";
import type { CategoryAction } from "../schemas/category.schema";

export async function getCategories(
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request("/categories", categoryListSchema, {
    accessToken,
    signal,
  });

  return response.data.categories;
}

export async function getCategory(
  id: string,
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request(
    `/categories/${categoryIdSchema.parse(id)}`,
    categoryResponseSchema,
    { accessToken, signal }
  );

  return response.data.category;
}

export function validateCategoryImage(file: File): string | null {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    return "Selecciona una imagen JPEG, PNG o WebP.";
  }

  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    return "La imagen debe contener datos y pesar como máximo 5 MB.";
  }

  return null;
}

export async function saveCategory(
  action: CategoryAction,
  accessToken: string,
  signal: AbortSignal
) {
  let path = "/categories";
  let method: "POST" | "PATCH" | "PUT" | "DELETE" = "PATCH";
  let body: unknown;

  if (action.kind === "create") {
    method = "POST";
    body = action.input;
  } else {
    path += `/${categoryIdSchema.parse(action.id)}`;

    switch (action.kind) {
      case "update":
        body = action.input;
        break;

      case "status":
        path += "/status";
        body = { isActive: action.isActive };
        break;

      case "image": {
        const error = validateCategoryImage(action.file);

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
  }

  const response = await request(path, categoryResponseSchema, {
    method,
    body,
    accessToken,
    signal,
  });

  return response.data.category;
}
