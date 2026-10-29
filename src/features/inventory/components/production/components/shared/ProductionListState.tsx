import {
  CircleX,
  LoaderCircle,
  PackageOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "../../../InventoryButton";

interface Props {
  state: "loading" | "empty" | "error";
  message?: string;
  onRetry?: () => void;
}

export function ProductionListState({
  state,
  message,
  onRetry,
}: Props) {
  if (state === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex min-h-[180px] items-center justify-center gap-2 px-4 py-10 text-sm text-muted"
      >
        <LoaderCircle
          size={18}
          aria-hidden
          className="motion-safe:animate-spin"
        />
        <span>{message || "Cargando producción…"}</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="grid min-w-0 gap-4">
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-sm leading-5 text-red-600 dark:text-red-400"
        >
          <CircleX
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0"
          />

          <p className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">
            {message ||
              "No fue posible cargar la producción. Intenta de nuevo."}
          </p>
        </div>

        {onRetry && (
          <Button
            size="compact"
            variant="secondary"
            onClick={onRetry}
          >
            <RefreshCw size={16} aria-hidden />
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[240px] flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-secondary text-muted">
        <PackageOpen size={21} aria-hidden />
      </div>

      <p className="text-sm font-semibold text-heading">
        Sin resultados
      </p>

      <p className="mt-1 text-xs leading-5 text-muted">
        {message || "No hay registros para esta selección."}
      </p>
    </div>
  );
}
