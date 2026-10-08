import {
  PackageOpen,
  PackagePlus,
  RefreshCw,
  SearchX,
  ShieldAlert,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";

export function InventorySkeleton() {
  return (
    <div
      className="inventory-skeleton"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando inventario…</span>

      <div aria-hidden="true" className="inventory-skeleton-layout">
        <div className="inventory-skeleton-metrics">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="inventory-skeleton-block inventory-skeleton-metric"
            />
          ))}
        </div>

        <div className="inventory-skeleton-block inventory-skeleton-toolbar" />

        <div className="inventory-skeleton-table">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="inventory-skeleton-block inventory-skeleton-row"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function InventoryLoadError({
  message,
  status,
  busy,
  onRetry,
}: {
  message: string | null;
  status: number | null;
  busy: boolean;
  onRetry: () => void;
}) {
  const permission = status === 401 || status === 403;
  const connection = status === 0;

  const Icon = permission
    ? ShieldAlert
    : connection
      ? WifiOff
      : TriangleAlert;

  const title =
    status === 403
      ? "No tienes acceso al inventario"
      : status === 401
        ? "Tu sesión venció"
        : "No pudimos cargar el inventario";

  return (
    <div className="inventory-state" data-kind="error">
      <span className="inventory-state-icon">
        <Icon size={24} aria-hidden="true" />
      </span>

      <div className="inventory-state-copy" role="alert">
        <h3>{title}</h3>

        <p>
          {message ||
            "No se pudo completar la consulta. Intenta nuevamente."}
        </p>
      </div>

      <Button
        size="sm"
        onClick={onRetry}
        loading={busy}
        loadingText="Reintentando…"
      >
        <RefreshCw size={16} aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  );
}

export function InventoryEmptyState({
  filtered,
  onClear,
  onCreate,
}: {
  filtered: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  const Icon = filtered ? SearchX : PackageOpen;

  return (
    <div className="inventory-state">
      <span className="inventory-state-icon">
        <Icon size={24} aria-hidden="true" />
      </span>

      <div className="inventory-state-copy" role="status">
        <h3>
          {filtered
            ? "No encontramos artículos"
            : "Aún no hay artículos"}
        </h3>

        <p>
          {filtered
            ? "No hay coincidencias con tu búsqueda y los filtros seleccionados."
            : "Crea materias primas, semielaborados, productos terminados o de reventa para empezar a controlar existencias."}
        </p>
      </div>

      {filtered ? (
        <Button size="sm" variant="secondary" onClick={onClear}>
          Limpiar filtros
        </Button>
      ) : (
        <Button size="sm" onClick={onCreate}>
          <PackagePlus size={16} aria-hidden="true" />
          Nuevo artículo
        </Button>
      )}
    </div>
  );
}
