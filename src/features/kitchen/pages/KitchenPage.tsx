import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { useAppShell } from "../../../app/layout/shell-context";

import type { AuthSession } from "../../auth/types/auth.types";
import { useSalesLocations } from "../../sales/hooks/useSalesLocations";
import type { SalesLocation } from "../../sales/services/sales.service";
import { WORKFLOW_LABELS } from "../../kitchen-flow/kitchen-flow.schema";

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

type Locations = ReturnType<typeof useSalesLocations>;

function LocationPicker({
  session,
  locations,
  disabled = false,
}: {
  session: AuthSession;
  locations: Locations;
  disabled?: boolean;
}) {
  const fixed =
    !session.authorization.roles.includes("ADMIN") &&
    locations.options.length === 1 &&
    locations.location;

  return fixed ? (
    <p>
      Punto de venta:{" "}
      <strong>
        {fixed.name} · {fixed.code}
      </strong>
    </p>
  ) : (
    <SelectField
      label="Punto de venta"
      value={locations.location?.id ?? ""}
      disabled={disabled || locations.loading}
      placeholder="Selecciona un punto de venta"
      onValueChange={locations.select}
      options={locations.options.map((location) => ({
        value: location.id,
        label: location.name + " · " + location.code,
      }))}
    />
  );
}

export function KitchenPage() {
  const { session } = useAppShell();

  if (
    !session.authorization.roles.some(
      (role) =>
        role === "ADMIN" || role === "KITCHEN" || role === "WAITER"
    )
  ) {
    return <Alert>No tienes acceso a Cocina.</Alert>;
  }

  return (
    <KitchenLocations
      key={
        session.business.id +
        ":" +
        session.membership.id +
        ":" +
        session.accessToken
      }
      session={session}
    />
  );
}

function KitchenLocations({ session }: { session: AuthSession }) {
  const locations = useSalesLocations(session);

  if (!locations.location) {
    return (
      <div className="kitchen-page">
        <LocationPicker session={session} locations={locations} />

        {locations.issue && <Alert>{locations.issue}</Alert>}

        {locations.loading ? (
          <p role="status">Consultando puntos de venta…</p>
        ) : locations.error ? (
          <Alert>{locations.error}</Alert>
        ) : (
          <KitchenEmptyState
            title={
              locations.options.length
                ? "Selecciona un punto de venta"
                : "No tienes un punto de venta asignado."
            }
            description={
              locations.options.length
                ? "Elige la ubicación que necesitas consultar."
                : "Solicita al administrador que configure tu ubicación."
            }
          />
        )}

        <Button
          variant="secondary"
          disabled={locations.loading}
          onClick={locations.retry}
        >
          Actualizar ubicaciones
        </Button>
      </div>
    );
  }

  return (
    <KitchenWorkspace
      key={locations.location.id}
      session={session}
      location={locations.location}
      locations={locations}
    />
  );
}

function KitchenWorkspace({
  session,
  location,
  locations,
}: {
  session: AuthSession;
  location: SalesLocation;
  locations: Locations;
}) {
  const scope = useMemo(
    () => ({
      businessId: session.business.id,
      location,
    }),
    [session.business.id, location]
  );

  const sound = useKitchenSound(
    session.business.id + ":" + session.user.id
  );

  const resource = useKitchen(session, scope, sound.play);
  const root = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(Date.now);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      60_000
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

  const printOnly = resource.settings?.workflowMode === "PRINT_ONLY";

  const empty =
    !resource.loading && !resource.error && !resource.tickets.length;

  const noAreas =
    resource.areasLoaded &&
    !resource.areaError &&
    !resource.areas.length;

  const selectedArea =
    resource.areas.find((area) => area.id === resource.area)?.name ??
    "Todas las áreas";

  return (
    <div ref={root} className="kitchen-page">
      <KitchenHeader
        resource={resource}
        businessName={
          session.business.name +
          " · " +
          location.name +
          " · " +
          selectedArea
        }
        now={now}
        sound={sound}
        fullscreen={fullscreen}
        canFullscreen={!!document.fullscreenEnabled}
        onFullscreen={() => void toggleFullscreen()}
      />

      <div className="kitchen-location">
        <LocationPicker
          session={session}
          locations={locations}
          disabled={resource.pending.length > 0}
        />

        {resource.settings && (
          <span className="kitchen-mode">
            {WORKFLOW_LABELS[resource.settings.workflowMode]}
          </span>
        )}
      </div>

      {resource.error && (
        <Alert>
          <strong>
            {resource.lastUpdated === null
              ? "No se pudo cargar cocina."
              : "No se pudo actualizar la información. Última actualización conservada."}
          </strong>

          <p>{resource.error}</p>

          <Button
            variant="secondary"
            disabled={
              resource.refreshing || resource.pending.length > 0
            }
            onClick={resource.refresh}
          >
            Reintentar
          </Button>
        </Alert>
      )}

      {resource.areaError && (
        <Alert>
          <p>
            No se pudieron actualizar las áreas: {resource.areaError}
          </p>

          <Button
            variant="secondary"
            disabled={resource.refreshing}
            onClick={resource.refresh}
          >
            Reintentar
          </Button>
        </Alert>
      )}

      {resource.paused && (
        <p className="kitchen-info" role="status">
          Tablero pausado. Al reanudar se sincronizará toda la
          información. Los avisos de cancelación siguen activos.
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

      {printOnly && resource.tickets.length > 0 && (
        <p className="kitchen-info">
          La ubicación ahora trabaja solo con comandas impresas. Las
          órdenes con seguimiento en pantalla confirmadas
          anteriormente permanecerán visibles hasta finalizarse.
        </p>
      )}

      {empty && printOnly && !resource.area ? (
        <KitchenEmptyState
          title="Esta ubicación trabaja únicamente con comandas impresas."
          description="Las nuevas órdenes no requieren seguimiento desde la pantalla de cocina."
        />
      ) : empty && noAreas ? (
        <KitchenEmptyState
          title="No hay áreas activas para este punto de venta."
          description="Solicita al administrador que revise las áreas asociadas a la ubicación."
        />
      ) : (
        <>
          <KitchenSummary resource={resource} now={now} />

          {empty ? (
            <KitchenEmptyState
              title="Todo al día"
              description={
                resource.area
                  ? "No hay comandas activas para esta área."
                  : "No hay comandas activas en esta ubicación."
              }
            />
          ) : (
            <KitchenBoard resource={resource} now={now} />
          )}
        </>
      )}
    </div>
  );
}
