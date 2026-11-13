import { Minus } from "lucide-react";
import { Plus } from "lucide-react";

export function Quantity({
  value,
  disabled = false,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="pm-quantity" aria-label="Cantidad">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} aria-hidden="true" />
      </button>

      <output aria-live="polite">{value}</output>

      <button
        type="button"
        aria-label="Aumentar cantidad"
        disabled={disabled || value >= 100}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
