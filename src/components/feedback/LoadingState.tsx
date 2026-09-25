import { LoaderCircle } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = "Cargando…",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 text-sm text-muted"
    >
      <LoaderCircle
        aria-hidden="true"
        size={20}
        strokeWidth={1.75}
        className="motion-safe:animate-spin"
      />
      <span>{message}</span>
    </div>
  );
}
