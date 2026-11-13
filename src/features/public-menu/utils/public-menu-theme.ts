import type { PublicBusiness } from "../schemas/public-menu.schema";
import type { CSSProperties } from "react";

export function safeColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;

  if (/^#[0-9a-f]{6}$/i.test(value)) return value;

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return (
      "#" +
      value
        .slice(1)
        .split("")
        .map((part) => part + part)
        .join("")
    );
  }

  return fallback;
}

export function contrastText(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;

    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  const luminance =
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722;

  return luminance > 0.179 ? "#111111" : "#ffffff";
}

export function themeFor(
  business?: Pick<PublicBusiness, "primaryColor" | "accentColor">
): CSSProperties {
  const primary = safeColor(business?.primaryColor, "#263831");
  const accent = safeColor(business?.accentColor, primary);
  const foreground = contrastText(primary);

  return {
    "--pm-brand": primary,
    "--pm-accent": accent,
    "--pm-on-brand": foreground,
    "--pm-ink": "color-mix(in srgb, " + primary + " 30%, #111111)",
    "--pm-muted": "color-mix(in srgb, " + primary + " 38%, #656565)",
    "--pm-border": "color-mix(in srgb, " + primary + " 22%, #ffffff)",
    "--sazora-accent": primary,
    "--sazora-on-accent": foreground,
    "--sazora-heading": "var(--pm-ink)",
    "--sazora-muted": "var(--pm-muted)",
    "--sazora-outline": "var(--pm-border)",
    "--sazora-input-border": "var(--pm-border)",
    "--sazora-surface": "#ffffff",
    "--sazora-popover": "#ffffff",
    "--sazora-secondary": "#f4f7fb",
  } as CSSProperties;
}
