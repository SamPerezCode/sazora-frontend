import type { PublicMenu } from "../schemas/public-menu.schema";
import { getPublicMenu } from "../services/public-menu.service";
import { themeFor } from "../utils/public-menu-theme";
import { MenuContent } from "./MenuContent";
import { useEffect } from "react";
import { useState } from "react";

export function MenuLoader({ slug }: { slug: string }) {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    attempt: number;
    data: PublicMenu | null;
    error: string;
  }>({ attempt: -1, data: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();

    void getPublicMenu(slug, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSnapshot({ attempt, data, error: "" });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot((previous) => ({
            attempt,
            data: previous.data,
            error:
              cause instanceof Error
                ? cause.message
                : "No pudimos cargar el menú.",
          }));
        }
      });

    return () => controller.abort();
  }, [slug, attempt]);

  const pending = snapshot.attempt !== attempt;
  const refresh = () => setAttempt((value) => value + 1);

  if (!snapshot.data) {
    return (
      <main className="pm-root pm-loading" style={themeFor()}>
        {pending ? (
          <p role="status">Cargando menú…</p>
        ) : (
          <div className="pm-stack">
            <p role="alert">{snapshot.error}</p>
            <button className="pm-primary" onClick={refresh}>
              Reintentar
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <MenuContent
      menu={snapshot.data}
      refreshing={pending}
      loadError={snapshot.error}
      onRefresh={refresh}
    />
  );
}
