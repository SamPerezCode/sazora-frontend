interface MeterBarProps {
  percentage: number | null;
  tone?: "accent" | "danger";
}

export function MeterBar({
  percentage,
  tone = "accent",
}: MeterBarProps) {
  const width =
    percentage !== null && Number.isFinite(percentage)
      ? Math.min(100, Math.max(0, percentage))
      : 0;

  return (
    <div
      aria-hidden="true"
      className="h-1.5 overflow-hidden rounded-full bg-secondary"
    >
      <div
        className={`h-full rounded-full ${
          tone === "danger" ? "bg-danger" : "bg-accent"
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
