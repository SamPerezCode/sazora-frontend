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
  reconnecting: "Reconectando",
  disconnected: "Sin conexión en tiempo real",
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
      data-online={resource.connection === "connected"}
    >
      <Icon size={14} aria-hidden="true" />

      {labels[resource.connection]}

      {resource.lastUpdated !== null && (
        <span> · Actualizado {clockTime(resource.lastUpdated)}</span>
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
      disabled={resource.pending.length > 0}
      onValueChange={resource.selectArea}
      options={[
        { value: "", label: "Todas las áreas" },
        ...resource.areas.map((area) => ({
          value: area.id,
          label: area.name + (area.isActive ? "" : " · Inactiva"),
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
