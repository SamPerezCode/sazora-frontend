export function SalesSummary({
  free,
  attending,
  closing,
}: {
  free: number;
  attending: number;
  closing: number;
}) {
  return (
    <section
      className="sales-room"
      aria-label="Resumen operativo del salón"
    >
      <h2>Estado del salón</h2>

      <div className="sales-stats">
        <div>
          <strong>{free}</strong>
          <span>Mesas libres</span>
        </div>

        <div>
          <strong>{attending}</strong>
          <span>En atención</span>
        </div>

        <div>
          <strong>{closing}</strong>
          <span>Por cerrar</span>
        </div>
      </div>
    </section>
  );
}
