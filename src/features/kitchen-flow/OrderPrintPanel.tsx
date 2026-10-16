import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ChevronDown, Eye, Printer, RotateCcw } from "lucide-react";

import { ApiError } from "../../lib/http/client";
import { BottomSheet } from "../../components/layout/BottomSheet";
import { Button } from "../../components/ui/Button";

import { currentInitialPrint } from "./kitchen-print.store";
import { KitchenPrintPreview } from "./KitchenPrintPreview";

import type {
  KitchenPrintStore,
  PrintEntry,
} from "./kitchen-print.store";

import {
  kitchenErrorMessage,
  printDate,
  reprintInputSchema,
} from "./kitchen-flow.schema";

import type { KitchenPrint } from "./kitchen-flow.schema";

import "./kitchen-flow.css";

const statusLabels = {
  PENDING: "Pendiente de impresión",
  SENDING: "Enviando a impresión…",
  SENT: "Enviada a impresión",
  ERROR: "Error de impresión",
};

interface Props {
  orderId: string;
  printing: KitchenPrintStore;
  disabled?: boolean;
}

/*
 * La key hace que cambiar de orden reinicie el panel cerrado.
 * Cerrar el modal de cuenta también desmonta este componente.
 */
export function OrderPrintPanel(props: Props) {
  return <PrintPanelContent key={props.orderId} {...props} />;
}

function PrintPanelContent({
  orderId,
  printing,
  disabled = false,
}: Props) {
  const id = useId();

  const snapshot = useSyncExternalStore(
    printing.subscribe,
    printing.getSnapshot,
    printing.getSnapshot
  );

  const entries = printing.list(orderId, snapshot);

  const versions = entries
    .map(
      (entry) => `${entry.ticket.id}:${entry.ticket.currentVersion}`
    )
    .sort()
    .join("|");

  const [isPrintPanelOpen, setIsPrintPanelOpen] = useState(false);
  const [preview, setPreview] = useState<KitchenPrint | null>(null);

  const [copy, setCopy] = useState<{
    entry: PrintEntry;
    source: KitchenPrint;
  } | null>(null);

  const [reason, setReason] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyUncertain, setCopyUncertain] = useState(false);
  const [retrying, setRetrying] = useState(0);
  const [notice, setNotice] = useState("");

  const batchLock = useRef(false);
  const copyLock = useRef(false);

  const failed = entries.filter((entry) => entry.status === "ERROR");
  const pending = entries.filter(
    (entry) => entry.status === "PENDING"
  );

  useEffect(() => {
    // Reconstruye el badge sin abrir la sección.
    const tickets = printing
      .list(orderId)
      .map((entry) => entry.ticket);

    void Promise.allSettled(tickets.map(printing.restore));
  }, [printing, orderId, versions]);

  async function retryAll() {
    if (batchLock.current || disabled) return;

    batchLock.current = true;
    setRetrying(failed.length);
    setNotice("");

    try {
      const result = await printing.retryFailed(orderId);

      if (result.ok && result.count > 0) {
        setNotice("Todas las comandas fueron enviadas a impresión.");
      }
    } finally {
      batchLock.current = false;
      setRetrying(0);
    }
  }

  async function reprint() {
    if (!copy || copyLock.current || disabled || copyUncertain)
      return;

    const parsed = reprintInputSchema.safeParse({
      reason,
      printerName: printerName.trim() || null,
    });

    if (!parsed.success) {
      setCopyError(parsed.error.issues[0].message);
      return;
    }

    copyLock.current = true;
    setCopyBusy(true);
    setCopyError("");

    try {
      await printing.reprint(
        copy.entry.ticket,
        copy.source,
        parsed.data.reason,
        parsed.data.printerName
      );

      setCopy(null);
      setNotice("Reimpresión enviada correctamente.");
    } catch (cause) {
      const uncertain =
        !(cause instanceof ApiError) ||
        cause.status === 0 ||
        cause.status >= 500;

      setCopyUncertain(uncertain);
      setCopyError(
        uncertain
          ? "No pudimos verificar si la copia quedó registrada. Consulta el historial antes de solicitar otra reimpresión."
          : kitchenErrorMessage(cause)
      );
    } finally {
      copyLock.current = false;
      setCopyBusy(false);
    }
  }

  return (
    <>
      <section className="kf-print-panel">
        <button
          type="button"
          className="kf-print-toggle"
          aria-expanded={isPrintPanelOpen}
          aria-controls={`${id}-content`}
          onClick={() => {
            const next = !isPrintPanelOpen;
            setIsPrintPanelOpen(next);

            if (next) {
              void Promise.allSettled(
                printing
                  .list(orderId)
                  .map((entry) => printing.restore(entry.ticket))
              );
            }
          }}
        >
          <Printer size={16} aria-hidden="true" />
          <strong>Comandas e impresiones</strong>

          {failed.length > 0 ? (
            <span className="kf-print-badge" data-status="ERROR">
              {failed.length}{" "}
              {failed.length === 1
                ? "error de impresión"
                : "errores de impresión"}
            </span>
          ) : pending.length > 0 ? (
            <span className="kf-print-badge" data-status="PENDING">
              {pending.length}{" "}
              {pending.length === 1 ? "pendiente" : "pendientes"}
            </span>
          ) : null}

          <ChevronDown
            size={16}
            aria-hidden="true"
            className="kf-chevron"
          />
        </button>

        {failed.length > 0 && (
          <p className="kf-print-warning" role="status">
            Hay comandas con error de impresión. El pedido sigue
            confirmado.
          </p>
        )}

        <div id={`${id}-content`} hidden={!isPrintPanelOpen}>
          {(failed.length >= 2 || retrying > 0) && (
            <div className="kf-print-batch">
              <Button
                variant="soft"
                size="compact"
                disabled={disabled || retrying > 0}
                onClick={() => void retryAll()}
              >
                <RotateCcw size={16} aria-hidden="true" />
                {retrying > 0
                  ? `Reintentando ${retrying} impresiones…`
                  : `Reintentar las ${failed.length} fallidas`}
              </Button>
            </div>
          )}

          {entries.length === 0 && (
            <p className="kf-print-empty">
              No hay comandas recuperables con el listado actual. Esto
              no significa que la cuenta nunca haya tenido comandas.
            </p>
          )}

          {entries.map((entry) => {
            const original = currentInitialPrint(entry);

            const availableSnapshot =
              original ??
              entry.prints.find(
                (print) =>
                  print.ticketVersion === entry.ticket.currentVersion
              );

            const busy =
              entry.status === "SENDING" ||
              entry.reprinting ||
              entry.loadingHistory;

            return (
              <article
                className="kf-print-item"
                key={`${entry.ticket.id}:${entry.ticket.currentVersion}`}
              >
                <strong>
                  {entry.ticket.preparationAreaName} · Versión{" "}
                  {entry.ticket.currentVersion}
                </strong>

                <span
                  className="kf-print-badge"
                  data-status={entry.status}
                  role="status"
                >
                  {entry.loadingHistory
                    ? "Consultando impresiones…"
                    : statusLabels[entry.status]}
                </span>

                {original && (
                  <p>
                    Enviada a impresión ·{" "}
                    {printDate(original.createdAt)}
                    {original.printerName
                      ? ` · ${original.printerName}`
                      : ""}
                  </p>
                )}

                {entry.error && (
                  <p className="kf-error">{entry.error}</p>
                )}

                {entry.historyError && (
                  <div role="alert">
                    <p>{entry.historyError}</p>
                    <Button
                      size="compact"
                      variant="soft"
                      disabled={busy || disabled}
                      onClick={() =>
                        void printing.restore(entry.ticket)
                      }
                    >
                      Actualizar historial
                    </Button>
                  </div>
                )}

                <div className="kf-actions">
                  {availableSnapshot && (
                    <button
                      type="button"
                      className="kf-text-button"
                      onClick={() => setPreview(availableSnapshot)}
                    >
                      <Eye size={16} aria-hidden="true" />
                      Ver
                    </button>
                  )}

                  {original ? (
                    <Button
                      variant="soft"
                      size="compact"
                      disabled={busy || disabled}
                      onClick={() => {
                        setReason("");
                        setPrinterName("");
                        setCopyError("");
                        setCopyUncertain(false);
                        setCopy({ entry, source: original });
                      }}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      {entry.reprinting
                        ? "Reimprimiendo…"
                        : "Reimprimir"}
                    </Button>
                  ) : (
                    <Button
                      variant="soft"
                      size="compact"
                      disabled={busy || disabled}
                      onClick={() => void printing.send(entry.ticket)}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      {entry.status === "SENDING"
                        ? "Enviando a impresión…"
                        : entry.status === "ERROR"
                          ? "Reintentar impresión"
                          : "Enviar a impresión"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {notice && <p role="status">{notice}</p>}

      {preview && (
        <KitchenPrintPreview
          print={preview}
          onClose={() => setPreview(null)}
        />
      )}

      {copy && (
        <BottomSheet
          id={`${id}-reprint`}
          open
          variant="modal"
          title="Reimprimir comanda"
          className="kf-dialog app-confirm-dialog"
          busy={copyBusy}
          onClose={() => setCopy(null)}
        >
          <form
            className="kf-dialog-content"
            onSubmit={(event) => {
              event.preventDefault();
              void reprint();
            }}
          >
            <p>
              {copy.source.contentSnapshot.preparationAreaName} ·
              Versión {copy.source.ticketVersion}
            </p>

            <label className="kf-field">
              Motivo de la reimpresión
              <textarea
                required
                maxLength={500}
                value={reason}
                disabled={copyBusy || copyUncertain}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            <label className="kf-field">
              Impresora — opcional
              <input
                maxLength={150}
                value={printerName}
                disabled={copyBusy || copyUncertain}
                onChange={(event) =>
                  setPrinterName(event.target.value)
                }
              />
            </label>

            {copyError && <p role="alert">{copyError}</p>}

            <div className="kf-actions">
              <Button
                variant="soft"
                disabled={copyBusy}
                onClick={() => setCopy(null)}
              >
                Cancelar
              </Button>

              {copyUncertain ? (
                <Button
                  type="button"
                  onClick={async () => {
                    await printing.restore(copy.entry.ticket);
                    setCopy(null);
                    setNotice(
                      "Historial actualizado. Revisa el registro antes de solicitar otra copia."
                    );
                  }}
                >
                  Consultar historial
                </Button>
              ) : (
                <Button
                  type="submit"
                  loading={copyBusy}
                  loadingText="Reimprimiendo…"
                  disabled={disabled || !reason.trim()}
                >
                  Reimprimir comanda
                </Button>
              )}
            </div>
          </form>
        </BottomSheet>
      )}
    </>
  );
}
