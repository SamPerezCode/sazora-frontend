import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { Info, CircleCheck, CircleAlert } from "lucide-react";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "./InventoryButton";
import { SelectField } from "../../../components/forms/SelectField";
import { ApiError } from "../../../lib/http/client";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex gap-2 rounded-xl border border-outline bg-secondary/30 p-3 text-sm text-muted"
    >
      <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StockBadge({ label }: { label: string }) {
  const good = label === "Disponible";

  return (
    <span
      className={
        good
          ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400"
          : label === "Saldo negativo" || label === "Agotado"
            ? "inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300"
            : "inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-xs text-orange-700 dark:text-orange-300"
      }
    >
      {good ? (
        <CircleCheck size={14} aria-hidden />
      ) : (
        <CircleAlert size={14} aria-hidden />
      )}
      {label}
    </span>
  );
}

export function Field({
  label,
  value,
  onChange,
  decimal = false,
  disabled = false,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  const className =
    "w-full min-w-0 rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-heading shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

  return (
    <label className="grid min-w-0 content-start gap-2 text-sm text-heading">
      <span>{label}</span>

      {multiline ? (
        <textarea
          className={className}
          rows={3}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={className + " h-10"}
          value={value}
          disabled={disabled}
          inputMode={decimal ? "decimal" : undefined}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function Choice(props: Parameters<typeof SelectField>[0]) {
  return (
    <SelectField
      {...props}
      className={
        "[&_.select-field-label]:mb-2 [&_.select-field-label]:text-sm [&_.select-field-label]:font-normal [&_.select-field-label]:normal-case [&_.select-field-label]:tracking-normal [&_.select-field-trigger]:h-10 [&_.select-field-trigger]:min-h-10 [&_.select-field-trigger]:rounded-xl " +
        (props.className ?? "")
      }
    />
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Tabla de inventario"
      className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-outline"
    >
      <table className="w-full text-left text-sm [&_th]:bg-secondary/40 [&_th]:p-3 [&_th]:font-normal [&_th]:text-muted [&_td]:border-t [&_td]:border-outline [&_td]:p-3">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Modal({
  title,
  children,
  footer,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const id = useId();

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title={title}
      busy={busy}
      onClose={onClose}
      className={
        (wide ? "max-w-6xl! " : "max-w-3xl! ") +
        "p-0! overflow-hidden! [&[open]]:flex [&[open]]:flex-col [&>.bottom-sheet-heading]:m-0 [&>.bottom-sheet-heading]:shrink-0 [&>.bottom-sheet-heading]:border-b [&>.bottom-sheet-heading]:border-outline [&>.bottom-sheet-heading]:px-5 [&>.bottom-sheet-heading]:py-4 [&>.bottom-sheet-heading_h2]:text-lg"
      }
    >
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
        {children}
      </div>

      <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-outline bg-background p-4">
        {footer ?? (
          <Button variant="soft" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </footer>
    </BottomSheet>
  );
}

export function WriteModal({
  title,
  children,
  dirty,
  prepare,
  onClose,
  onSaved,
  wide = false,
  submitLabel = "Revisar y confirmar",
  onContinue,
  onBack,
}: {
  title: string;
  children: ReactNode;
  dirty: boolean;
  wide?: boolean;
  submitLabel?: string;
  onContinue?: () => void;
  onBack?: () => void;
  prepare: () => {
    description: ReactNode;
    save: (signal: AbortSignal) => Promise<unknown>;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [review, setReview] = useState<ReturnType<
    typeof prepare
  > | null>(null);

  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);

  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function close() {
    if (lock.current) return;

    if (dirty && !uncertain) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  function check() {
    try {
      setError("");
      setReview(prepare());
    } catch (error) {
      setError(
        error instanceof z.ZodError
          ? (error.issues.find((issue) => issue.code === "custom")
              ?.message ??
              "Completa los campos obligatorios y revisa los valores decimales.")
          : error instanceof Error
            ? error.message
            : "Revisa los datos."
      );
    }
  }

  async function save() {
    if (!review || lock.current || uncertain) return;

    lock.current = true;
    setBusy(true);
    setError("");

    const request = new AbortController();
    controller.current = request;

    try {
      await review.save(request.signal);

      if (!request.signal.aborted) {
        onSaved();
      }
    } catch (error) {
      if (request.signal.aborted) return;

      const ambiguous =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500;

      setUncertain(ambiguous);

      setError(
        ambiguous
          ? "No pudimos verificar el resultado. Cierra y actualiza antes de volver a registrar."
          : error.status === 403
            ? "No tienes permiso para realizar esta operación."
            : error.message
      );

      setReview(null);
    } finally {
      lock.current = false;

      if (!request.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return (
    <>
      <Modal
        title={title}
        wide={wide}
        busy={busy}
        onClose={close}
        footer={
          <>
            <Button variant="soft" disabled={busy} onClick={close}>
              Cancelar
            </Button>

            {onBack && (
              <Button
                variant="soft"
                disabled={busy || uncertain}
                onClick={onBack}
              >
                Anterior
              </Button>
            )}

            <Button
              disabled={busy || uncertain}
              onClick={onContinue ?? check}
            >
              {onContinue ? "Continuar" : submitLabel}
            </Button>
          </>
        }
      >
        <fieldset
          disabled={busy || uncertain}
          className="grid min-w-0 gap-5"
        >
          {children}
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </Modal>

      {review && (
        <Modal
          title="Confirmar operación"
          busy={busy}
          onClose={() => !busy && setReview(null)}
          footer={
            <>
              <Button
                variant="soft"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Volver al formulario
              </Button>
              <Button loading={busy} onClick={() => void save()}>
                Confirmar registro
              </Button>
            </>
          }
        >
          {review.description}
        </Modal>
      )}

      {discard && (
        <Modal
          title="Descartar cambios"
          onClose={() => setDiscard(false)}
          footer={
            <>
              <Button
                variant="soft"
                onClick={() => setDiscard(false)}
              >
                Seguir editando
              </Button>
              <Button variant="danger" onClick={onClose}>
                Descartar
              </Button>
            </>
          }
        >
          Los cambios sin guardar se perderán.
        </Modal>
      )}
    </>
  );
}

export function LocationChoice({
  dirty,
  onValueChange,
  ...props
}: Parameters<typeof Choice>[0] & { dirty: boolean }) {
  const [pending, setPending] = useState<string | null>(null);

  return (
    <>
      <Choice
        {...props}
        onValueChange={(value) => {
          if (dirty && props.value && value !== props.value) {
            setPending(value);
          } else {
            onValueChange(value);
          }
        }}
      />

      {pending !== null && (
        <Modal
          title="Cambiar ubicación"
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="soft" onClick={() => setPending(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onValueChange(pending);
                  setPending(null);
                }}
              >
                Cambiar ubicación
              </Button>
            </>
          }
        >
          Los saldos, costos y mínimo local se revisarán en la nueva
          ubicación. Los demás datos del formulario se conservarán.
        </Modal>
      )}
    </>
  );
}
