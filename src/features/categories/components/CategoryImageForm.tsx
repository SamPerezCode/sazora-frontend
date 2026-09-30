import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { resolveFileUrl } from "../../../lib/files";
import { ApiError } from "../../../lib/http/client";
import type {
  Category,
  CategoryAction,
} from "../schemas/category.schema";
import { validateCategoryImage } from "../services/category.service";

interface CategoryImageFormProps {
  category: Category;
  busy: boolean;
  onSave: (action: CategoryAction) => Promise<void>;
  onCancel: () => void;
}

export function CategoryImageForm({
  category,
  busy,
  onSave,
  onCancel,
}: CategoryImageFormProps) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const objectUrl = useRef<string | null>(null);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;

      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
      }
    };
  }, []);

  async function save(action: CategoryAction) {
    if (busy) return;
    setError("");

    try {
      await onSave(action);
    } catch (cause) {
      if (alive.current) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "No pudimos guardar la imagen."
        );
      }
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (file) {
          void save({ kind: "image", id: category.id, file });
        }
      }}
    >
      <div className="flex justify-center">
        <Avatar
          name={category.name}
          src={preview ?? resolveFileUrl(category.imageUrl)}
          size="xl"
        />
      </div>

      <label
        htmlFor={id}
        className="block text-sm font-medium text-heading"
      >
        Imagen de {category.name}
      </label>

      <input
        id={id}
        type="file"
        data-dialog-initial-focus
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        aria-describedby={`${id}-help`}
        className="block w-full min-w-0 rounded-xl border border-outline p-2 text-xs text-heading file:mr-2 file:rounded-lg file:bg-secondary file:p-2 file:text-heading"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";

          if (!selected) return;

          const message = validateCategoryImage(selected);

          if (objectUrl.current) {
            URL.revokeObjectURL(objectUrl.current);
          }

          objectUrl.current = null;
          setFile(null);
          setPreview(null);
          setError(message ?? "");

          if (!message) {
            objectUrl.current = URL.createObjectURL(selected);
            setPreview(objectUrl.current);
            setFile(selected);
          }
        }}
      />

      <p id={`${id}-help`} className="text-xs text-muted">
        {file ? `${file.name} · ` : ""}
        JPEG, PNG o WebP. Máximo 5 MB.
      </p>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap justify-end gap-2">
        {category.imageUrl && (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              void save({ kind: "remove-image", id: category.id });
            }}
          >
            Eliminar imagen
          </Button>
        )}

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
          disabled={!file || busy}
          loading={busy}
          loadingText="Guardando…"
        >
          <ImagePlus aria-hidden="true" size={16} />
          Guardar imagen
        </Button>
      </div>
    </form>
  );
}
