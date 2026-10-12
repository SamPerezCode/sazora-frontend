import { MapPin, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button";

export function ConfigurationState({
  pending,
  error,
  onRetry,
  title = "Aún no tienes ubicaciones",
  children,
}: {
  pending?: boolean;
  error?: string;
  onRetry?: () => void;
  title?: string;
  children?: ReactNode;
}) {
  if (pending) {
    return (
      <div
        className="configuration-grid"
        role="status"
        aria-label="Cargando configuración"
      >
        {[0, 1, 2, 3].map((value) => (
          <div
            className="configuration-card configuration-skeleton"
            key={value}
          >
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="configuration-card configuration-state"
      role={error ? "alert" : "status"}
    >
      {error ? (
        <WifiOff size={30} className="text-danger" />
      ) : (
        <MapPin size={30} />
      )}

      <h3>{error ? "No pudimos cargar la información" : title}</h3>

      <p>
        {error ??
          "Registra tu planta o tu primer punto de venta para empezar."}
      </p>

      {error && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw size={16} />
          Reintentar
        </Button>
      )}

      {!error && children}
    </div>
  );
}
