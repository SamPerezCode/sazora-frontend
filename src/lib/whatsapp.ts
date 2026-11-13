

export function normalizeWhatsAppPhone(
  phone: string | null | undefined
): string | null {
  const value = phone?.trim();

  if (!value || !/^\+?[\d\s().-]+$/.test(value)) {
    return null;
  }

  const international =
    value.startsWith("+") || value.startsWith("00");

  let digits = value.replace(/\D/g, "");

  if (value.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Los números nacionales admitidos aquí corresponden a Colombia.
  if (!international && digits.length === 10) {
    if (!/^(?:3\d{9}|60[1-8]\d{7})$/.test(digits)) {
      return null;
    }

    digits = "57" + digits;
  }

  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const number = normalizeWhatsAppPhone(phone);

  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : null;
}
