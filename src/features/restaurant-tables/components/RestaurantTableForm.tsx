import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import { tableFormSchema } from "../schemas/restaurant-table.schema";
import type {
  RestaurantTable,
  TableDraft,
  TableInput,
} from "../schemas/restaurant-table.schema";

interface Props {
  table?: RestaurantTable;
  busy: boolean;
  onSave: (values: TableInput) => Promise<void>;
  onCancel: () => void;
}

export function RestaurantTableForm({
  table,
  busy,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<TableDraft>({
    code: table?.code ?? "",
    name: table?.name ?? "",
    capacity: table?.capacity == null ? "" : String(table.capacity),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const alive = useRef(false);
  const saving = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function change(key: keyof TableDraft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  async function submit(form: HTMLFormElement) {
    if (busy || saving.current) return;

    const parsed = tableFormSchema.safeParse(draft);

    const focusError = () =>
      requestAnimationFrame(() => {
        if (form.isConnected) {
          form
            .querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        }
      });

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] ??= issue.message;
      }

      setErrors(next);
      focusError();
      return;
    }

    saving.current = true;
    setErrors({});
    setMessage("");

    try {
      await onSave(parsed.data);
    } catch (error: unknown) {
      if (!alive.current) return;

      const next: Record<string, string> = {};

      if (error instanceof ApiError) {
        for (const issue of error.errors) {
          next[issue.field] ??= issue.message;
        }

        if (error.code === "RESTAURANT_TABLE_CODE_CONFLICT") {
          next.code = error.message;
        }
      }

      setErrors(next);
      setMessage(
        error instanceof ApiError
          ? error.message
          : "No pudimos guardar la mesa."
      );

      focusError();
    } finally {
      saving.current = false;
    }
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">
          {table ? "Editar mesa" : "Nueva mesa"}
        </legend>

        <TextField
          data-dialog-initial-focus
          name="code"
          label="Código"
          placeholder="MESA-01"
          required
          maxLength={30}
          value={draft.code}
          error={errors.code}
          onChange={(event) => change("code", event.target.value)}
        />

        <TextField
          name="name"
          label="Nombre"
          placeholder="Mesa de la terraza"
          required
          maxLength={80}
          value={draft.name}
          error={errors.name}
          onChange={(event) => change("name", event.target.value)}
        />

        <TextField
          name="capacity"
          label="Capacidad (opcional)"
          type="number"
          inputMode="numeric"
          min={1}
          max={65535}
          step={1}
          placeholder="Sin definir"
          value={draft.capacity}
          error={errors.capacity}
          onChange={(event) => change("capacity", event.target.value)}
        />

        <p className="text-xs text-muted">
          El código se guarda en mayúsculas. Deja la capacidad vacía
          si no deseas definirla.
        </p>
      </fieldset>

      {message && <Alert>{message}</Alert>}

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          size="sm"
          disabled={busy}
          loading={busy}
          loadingText="Guardando…"
        >
          <Save aria-hidden="true" size={16} />
          {table ? "Guardar" : "Crear mesa"}
        </Button>
      </div>
    </form>
  );
}
