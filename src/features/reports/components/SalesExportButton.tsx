import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import { ApiError } from "../../../lib/http/client";

import { hasPermission } from "../../auth/utils/permissions";
import type { AuthSession } from "../../auth/types/auth.types";

import type { SalesFilters } from "../schemas/reports.schema";
import { downloadSalesReport } from "../services/reports.service";
import { saveReportFile } from "../utils/sales-export";

interface Props {
  session: AuthSession;
  locationId: string;
  filters: SalesFilters;
  disabled: boolean;
}

export function SalesExportButton({
  session,
  locationId,
  filters,
  disabled,
}: Props) {
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    []
  );

  async function download() {
    if (
      disabled ||
      controller.current ||
      !hasPermission(session, "sales.reports.read")
    ) {
      return;
    }

    const current = new AbortController();
    controller.current = current;

    setBusy(true);
    setError("");

    // Utiliza los filtros aplicados en el momento del clic.
    const selected = { ...filters };

    try {
      const file = await downloadSalesReport(
        session,
        locationId,
        selected,
        current.signal
      );

      current.signal.throwIfAborted();

      saveReportFile(file.blob, file.filename);
    } catch (cause) {
      if (current.signal.aborted) return;

      setError(
        cause instanceof ApiError
          ? cause.code === "SALES_EXPORT_LIMIT_EXCEEDED"
            ? "El informe supera el límite de exportación. Reduce el período o aplica más filtros."
            : cause.message
          : "No pudimos descargar el Excel. Intenta nuevamente."
      );
    } finally {
      if (controller.current === current) {
        controller.current = null;

        if (!current.signal.aborted) {
          setBusy(false);
        }
      }
    }
  }

  if (!hasPermission(session, "sales.reports.read")) {
    return null;
  }

  return (
    <>
      <Button
        className="rp-export-button"
        type="button"
        variant="soft"
        loading={busy}
        loadingText="Descargando…"
        disabled={disabled}
        onClick={() => void download()}
      >
        <Download size={16} aria-hidden="true" />
        Descargar Excel
      </Button>

      {error && (
        <div className="rp-export-error">
          <Alert>{error}</Alert>
        </div>
      )}
    </>
  );
}
