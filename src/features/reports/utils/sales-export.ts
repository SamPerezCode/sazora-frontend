export function exportFilename(
  header: string | null,
  fallback: string
) {
  if (!header) return fallback;

  const extended = /filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(
    header
  );

  let candidate = "";

  if (extended) {
    const encoded = /^UTF-8'[^']*'(.*)$/i.exec(
      (extended[1] ?? extended[2] ?? "").trim()
    );

    if (encoded) {
      try {
        candidate = decodeURIComponent(encoded[1]);
      } catch {
        // Si filename* no es válido, utiliza filename.
      }
    }
  }

  if (!candidate) {
    const plain =
      /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header);

    candidate = (plain?.[1] ?? plain?.[2] ?? "").trim();
  }

  const filename = (candidate.split(/[\\/]/).pop() ?? "")
    .split("")
    .filter(
      (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127
    )
    .join("")
    .replace(/[<>:"|?*]/g, "_")
    .trim();

  return filename && filename !== "." && filename !== ".."
    ? filename
    : fallback;
}

export function saveReportFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();

    // Permite que el navegador inicie la descarga.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
