export function PublicRequestNotes({
  notes,
  delivery,
}: {
  notes: string | null;
  delivery: boolean;
}) {
  if (!notes?.trim()) return null;

  // Convención existente del formulario público.
  // La API guarda un único campo notes.
  const value = notes.replace(/\r\n/g, "\n").trim();
  const marker = "Indicaciones de entrega: ";

  const index = delivery
    ? value.startsWith(marker)
      ? 0
      : value.lastIndexOf("\n\n" + marker)
    : -1;

  const start = index < 0 ? -1 : index + (index === 0 ? 0 : 2);

  const general = start < 0 ? value : value.slice(0, index).trim();

  const instructions =
    start < 0 ? "" : value.slice(start + marker.length).trim();

  return (
    <>
      {general && (
        <div>
          <strong>Notas generales</strong>
          <p className="por-notes">{general}</p>
        </div>
      )}

      {instructions && (
        <div>
          <strong>Indicaciones de entrega</strong>
          <p className="por-notes">{instructions}</p>
        </div>
      )}
    </>
  );
}
