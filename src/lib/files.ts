import { API_BASE_URL } from "../config/env";

export function resolveFileUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, new URL(API_BASE_URL).origin + "/");

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
