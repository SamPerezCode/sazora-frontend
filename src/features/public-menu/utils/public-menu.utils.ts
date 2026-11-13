

export function getInstagramHandle(
  instagram: string | null | undefined
): string | null {
  const value = instagram?.trim();

  if (!value) return null;

  let handle: string;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);

      if (
        !["instagram.com", "www.instagram.com"].includes(
          url.hostname.toLowerCase()
        )
      ) {
        return null;
      }

      handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  } else {
    handle = value.replace(/^@/, "");
  }

  return /^[a-z0-9._]{1,30}$/i.test(handle) ? handle : null;
}

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}
