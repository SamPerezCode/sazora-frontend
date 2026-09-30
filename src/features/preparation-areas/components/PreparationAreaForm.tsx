import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import {
  areaDraft,
  areaFormSchema,
} from "../schemas/preparation-area.schema";
import type {
  AreaDraft,
  AreaInput,
  PreparationArea,
} from "../schemas/preparation-area.schema";

interface PreparationAreaFormProps {
  area?: PreparationArea;
  busy: boolean;
  onSave: (values: AreaInput) => Promise<void>;
  onCancel: () => void;
}

export function PreparationAreaForm({
  area,
  busy,
  onSave,
  onCancel,
}: PreparationAreaFormProps) {
  const [draft, setDraft] = useState(() => areaDraft(area));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const alive = useRef(false);

  const baseline = areaDraft(area);

  const dirty =
    !area ||
    draft.name !== baseline.name ||
    draft.description !== baseline.description ||
    draft.displayOrder !== baseline.displayOrder;

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  function change(key: keyof AreaDraft, value: string): void {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [key]: "",
    }));

    setMessage("");
  }

  async function submit(form: HTMLFormElement): Promise<void> {
    if (busy || !dirty) return;

    const parsed = areaFormSchema.safeParse(draft);

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] ??= issue.message;
      }

      setErrors(next);

      requestAnimationFrame(() => {
        if (form.isConnected) {
          form
            .querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        }
      });

      return;
    }

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

        if (error.code === "PREPARATION_AREA_NAME_CONFLICT") {
          next.name = error.message;
        }
      }

      setErrors(next);

      setMessage(
        error instanceof ApiError
          ? error.message
          : "No pudimos guardar el área."
      );
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
          {area ? "Editar área" : "Nueva área"}
        </legend>

        <TextField
          autoFocus
          data-dialog-initial-focus
          name="name"
          label="Nombre del área"
          required
          maxLength={100}
          value={draft.name}
          error={errors.name}
          onChange={(event) => change("name", event.target.value)}
          className={
            errors.name ? "" : "border-outline dark:border-outline"
          }
        />

        <TextAreaField
          name="description"
          label="Descripción (opcional)"
          maxLength={255}
          rows={3}
          value={draft.description}
          error={errors.description}
          onChange={(event) =>
            change("description", event.target.value)
          }
        />

        <TextField
          name="displayOrder"
          label="Orden de presentación"
          type="number"
          inputMode="numeric"
          min={0}
          max={65535}
          step={1}
          required
          value={draft.displayOrder}
          error={errors.displayOrder}
          onChange={(event) =>
            change("displayOrder", event.target.value)
          }
          className={
            errors.displayOrder
              ? ""
              : "border-outline dark:border-outline"
          }
        />

        <p className="text-xs text-muted">
          Los números menores aparecen primero. Las áreas nuevas se
          crean activas.
        </p>
      </fieldset>

      {message && <Alert>{message}</Alert>}

      <div className="flex flex-wrap justify-end gap-2">
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
          disabled={!dirty || busy}
          loading={busy}
          loadingText="Guardando…"
        >
          <Save aria-hidden="true" size={16} />
          {area ? "Guardar cambios" : "Crear área"}
        </Button>
      </div>
    </form>
  );
}
