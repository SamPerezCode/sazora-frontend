import { resolveFileUrl } from "../../../lib/files";
import { ImageIcon } from "lucide-react";
import { useState } from "react";

export function MenuImage({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const url = resolveFileUrl(src);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <span className={"pm-image " + className}>
      {url && failed !== url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(url)}
        />
      ) : (
        <ImageIcon size={28} aria-label="Sin imagen" />
      )}
    </span>
  );
}
