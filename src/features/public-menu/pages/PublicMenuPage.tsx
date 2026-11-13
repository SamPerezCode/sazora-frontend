import { MenuLoader } from "../components/MenuLoader";
import { slugSchema } from "../schemas/public-menu.schema";
import { useParams } from "react-router";
import "../public-menu.css";

export function PublicMenuPage() {
  const { businessSlug = "" } = useParams();

  if (!slugSchema.safeParse(businessSlug).success) {
    return (
      <main className="pm-root pm-loading">
        El enlace no es válido.
      </main>
    );
  }

  return <MenuLoader key={businessSlug} slug={businessSlug} />;
}
