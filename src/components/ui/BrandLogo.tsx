import type { ComponentPropsWithoutRef } from "react";
import { useTheme } from "../../app/providers/theme-context";
import logoLight from "../../assets/brand/sazora_logo_vertical_light.png";
import logoDark from "../../assets/brand/sazora_logo_vertical_dark_v2.png";

type BrandLogoProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "srcSet" | "width" | "height"
>;

export function BrandLogo({
  alt = "Sazora",
  className = "size-20 lg:size-28",
  ...props
}: BrandLogoProps) {
  const { theme } = useTheme();

  return (
    <img
      {...props}
      src={theme === "dark" ? logoDark : logoLight}
      alt={alt}
      width={1024}
      height={1024}
      className={`block shrink-0 object-contain ${className}`}
    />
  );
}
