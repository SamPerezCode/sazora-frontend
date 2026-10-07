import { useEffect, useRef, useState } from "react";
import { Alert } from "../../../components/feedback/Alert";
import { useAppShell } from "../../../app/layout/shell-context";
import type { AuthSession } from "../../auth/types/auth.types";
import { useKitchen } from "../hooks/useKitchen";
import { useKitchenSound } from "../hooks/useKitchenSound";
import { KitchenHeader } from "../components/KitchenHeader";
import {
  KitchenBoard,
  KitchenEmptyState,
  KitchenSummary,
} from "../components/KitchenBoard";
import { KitchenAlerts } from "../components/KitchenAlerts";
import "../kitchen.css";

export function KitchenPage() {
  const { session } = useAppShell();

  const allowed = session.authorization.roles.some(
    (role) => role === "ADMIN" || role === "KITCHEN"
  );

  if (!allowed) {
    return <Alert>No tienes acceso a Cocina.</Alert>;
  }

  return (
    <KitchenWorkspace
      key={`${session.business.id}:${session.membership.id}:${session.accessToken}`}
      session={session}
    />
  );
}

function KitchenWorkspace({ session }: { session: AuthSession }) {
  const sound = useKitchenSound();
  const resource = useKitchen(session, sound.play);
  const root = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(Date.now);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      10_000
    );

    const element = root.current;

    const changed = () => {
      setFullscreen(document.fullscreenElement === element);
    };

    document.addEventListener("fullscreenchange", changed);

    return () => {
      window.clearInterval(timer);

      document.removeEventListener("fullscreenchange", changed);

      if (element && document.fullscreenElement === element) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  async function toggleFullscreen() {
    try {
      setFullscreenError("");

      if (document.fullscreenElement === root.current) {
        await document.exitFullscreen();
      } else {
        await root.current?.requestFullscreen();
      }
    } catch {
      setFullscreenError(
        "El navegador no permitió cambiar a pantalla completa."
      );
    }
  }

  const noAreas =
    resource.areasLoaded &&
    !resource.areaError &&
    !resource.areas.length &&
    !resource.loading &&
    !resource.error &&
    !resource.tickets.length;

  return (
    <div ref={root} className="kitchen-page">
      <KitchenHeader
        resource={resource}
        businessName={session.business.name}
        now={now}
        sound={sound}
        fullscreen={fullscreen}
        canFullscreen={!!document.fullscreenEnabled}
        onFullscreen={() => void toggleFullscreen()}
      />

      {resource.error && (
        <Alert>
          <strong>No se pudo actualizar el tablero.</strong>
          <p>{resource.error}</p>

          {resource.lastUpdated !== null && (
            <p>
              Se conserva la última consulta. Las acciones están
              bloqueadas hasta sincronizar.
            </p>
          )}
        </Alert>
      )}

      {resource.areaError && (
        <Alert>
          <p>
            No se pudieron actualizar las áreas: {resource.areaError}
          </p>
        </Alert>
      )}

      {resource.paused && (
        <p className="kitchen-info" role="status">
          Actualización automática pausada. Reanuda para preparar
          productos. Los avisos de cancelación siguen activos.
        </p>
      )}

      {(sound.error || fullscreenError) && (
        <Alert>{sound.error || fullscreenError}</Alert>
      )}

      {resource.actionMessage && (
        <p className="kitchen-info" role="status">
          {resource.actionMessage}
        </p>
      )}

      <KitchenAlerts
        notices={resource.notices}
        area={resource.area}
        dismiss={resource.dismiss}
      />

      {noAreas ? (
        <KitchenEmptyState
          title="No hay áreas de preparación registradas"
          description="Un administrador puede crearlas en Configuración del negocio."
        />
      ) : (
        <>
          <KitchenSummary resource={resource} now={now} />
          <KitchenBoard resource={resource} now={now} />
        </>
      )}
    </div>
  );
}
