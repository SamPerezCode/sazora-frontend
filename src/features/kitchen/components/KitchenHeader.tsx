import {
  Bell,
  BellOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
  CircleCheck,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import type { ConnectionStatus } from "../../../lib/realtime/session-socket";
import type { useKitchen } from "../hooks/useKitchen";
import { clockTime } from "../utils/kitchen.utils";

type Resource = ReturnType<typeof useKitchen>;

const labels: Record<ConnectionStatus, string> = {
  connecting: "Conectando",
  connected: "En línea",
  reconnecting: "Reconectando…",
  disconnected: "Sin conexión",
  rejected: "Autenticación rechazada",
};

export function KitchenConnectionStatus({
  resource,
}: {
  resource: Resource;
}) {
  const Icon = resource.connection === "connected" ? Wifi : WifiOff;

  return (
    <p
      className="kitchen-connection"
      role="status"
      aria-live="polite"
      data-online={
        resource.connection === "connected" && !resource.error
      }
    >
      <Icon size={14} aria-hidden="true" />

      {resource.error ? "Sin conexión" : labels[resource.connection]}

      {resource.lastUpdated !== null && (
        <span>
          {" · Actualizado "}
          {new Date(resource.lastUpdated).toLocaleTimeString("es-CO")}
        </span>
      )}
    </p>
  );
}

export function PreparationAreaSelector({
  resource,
}: {
  resource: Resource;
}) {
  return (
    <SelectField
      label="Área de preparación"
      hideLabel
      value={resource.area}
      disabled={
        resource.pending.length > 0 ||
        !resource.areasLoaded ||
        !!resource.areaError
      }
      onValueChange={resource.selectArea}
      options={[
        { value: "", label: "Todas las áreas" },
        ...resource.areas.map((area) => ({
          value: area.id,
          label: area.name,
        })),
      ]}
    />
  );
}

export function KitchenHeader({
  resource,
  businessName,
  now,
  sound,
  fullscreen,
  canFullscreen,
  onFullscreen,
}: {
  resource: Resource;
  businessName: string;
  now: number;
  sound: {
    enabled: boolean;
    toggle: () => Promise<void>;
  };
  fullscreen: boolean;
  canFullscreen: boolean;
  onFullscreen: () => void;
}) {
  return (
    <header className="kitchen-header">
      <div className="kitchen-header-info">
        <div>
          <h2>Cocina · {businessName}</h2>
          <KitchenConnectionStatus resource={resource} />
        </div>

        <time
          className="kitchen-clock"
          dateTime={new Date(now).toISOString()}
        >
          {clockTime(now)}
        </time>
      </div>

      <div className="kitchen-toolbar">
        <div className="kitchen-area">
          <PreparationAreaSelector resource={resource} />
        </div>

        <Button
          size="sm"
          variant="secondary"
          loading={resource.refreshing}
          disabled={resource.pending.length > 0}
          onClick={resource.refresh}
        >
          <RefreshCw size={15} />
          Actualizar
        </Button>

        <Button
          size="sm"
          variant="secondary"
          aria-pressed={resource.paused}
          disabled={resource.pending.length > 0}
          onClick={resource.togglePause}
        >
          {resource.paused ? <Play size={15} /> : <Pause size={15} />}

          {resource.paused ? "Reanudar" : "Pausar"}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          aria-pressed={sound.enabled}
          onClick={() => void sound.toggle()}
        >
          {sound.enabled ? <Bell size={15} /> : <BellOff size={15} />}
          Sonido
        </Button>

        <span
          tabIndex={0}
          title="El historial de comandas se consulta desde el historial de órdenes."
        >
          <Button size="sm" variant="secondary" disabled>
            <CircleCheck size={15} />
            Terminadas
          </Button>
        </span>

        <Button
          size="sm"
          variant="secondary"
          disabled={!canFullscreen}
          onClick={onFullscreen}
        >
          {fullscreen ? (
            <Minimize2 size={15} />
          ) : (
            <Maximize2 size={15} />
          )}

          {fullscreen ? "Salir" : "Pantalla completa"}
        </Button>
      </div>
    </header>
  );
}
