import { useState } from "react";

interface AvatarProps {
  name: string;
  variant?: "default" | "profile";
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

export function Avatar({
  name,
  variant = "default",
  src,
  size = "md",
  className = "",
}: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(
    null
  );

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden font-bold",
        variant === "profile"
          ? "rounded-full bg-[#1c2a4d] text-[0.625rem] text-white dark:bg-accent dark:text-on-accent"
          : "rounded-xl bg-accent/20 text-sm text-accent",
        sizes[size],
        className,
      ].join(" ")}
    >
      {src && src !== failedSource ? (
        <img
          src={src}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedSource(src)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
