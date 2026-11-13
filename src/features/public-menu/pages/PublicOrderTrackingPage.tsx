import { TrackingContent } from "../components/TrackingContent";
import { slugSchema } from "../schemas/public-menu.schema";
import { useParams } from "react-router";
import { z } from "zod";
import "../public-menu.css";

export function PublicOrderTrackingPage() {
  const { businessSlug = "", publicCode = "" } = useParams();

  if (
    !slugSchema.safeParse(businessSlug).success ||
    !z.string().uuid().safeParse(publicCode).success
  ) {
    return (
      <main className="pm-root pm-loading">
        El enlace de seguimiento no es válido.
      </main>
    );
  }

  return (
    <TrackingContent
      key={businessSlug + ":" + publicCode}
      slug={businessSlug}
      code={publicCode}
    />
  );
}
