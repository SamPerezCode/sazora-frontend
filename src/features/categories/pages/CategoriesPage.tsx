import { useEffect, useId, useRef, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { CategoryList } from "../components/CategoryList";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { CategoryForm } from "../components/CategoryForm";
import { CategoryImageForm } from "../components/CategoryImageForm";
import { categoryChanges } from "../schemas/category.schema";
import type {
  CategoryAction,
  CategoryInput,
} from "../schemas/category.schema";
import { useCategories } from "../hooks/useCategories";

type Editor =
  | { kind: "form"; id?: string }
  | { kind: "image"; id: string }
  | null;

export function CategoriesPage() {
  const { session } = useAppShell();

  return (
    <CategoriesContent
      key={`${session.business.id}:${session.membership.id}:${session.accessToken}`}
      session={session}
    />
  );
}

function CategoriesContent({ session }: { session: AuthSession }) {
  const resource = useCategories(session);
  const [editor, setEditor] = useState<Editor>(null);
  const [notice, setNotice] = useState({ message: "", error: false });
  const modalId = useId();
  const alive = useRef(false);

  const selected = editor?.id
    ? resource.categories.find((item) => item.id === editor.id)
    : undefined;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice.message) return;

    const timer = window.setTimeout(() => {
      setNotice((current) =>
        current === notice ? { message: "", error: false } : current
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function saveAction(action: CategoryAction) {
    await resource.mutate(action);

    if (!alive.current) return;

    setEditor(null);
    setNotice({
      error: false,
      message:
        action.kind === "create"
          ? "Categoría creada."
          : action.kind === "image"
            ? "Imagen guardada."
            : action.kind === "remove-image"
              ? "Imagen eliminada."
              : "Categoría actualizada.",
    });
  }

  async function saveForm(values: CategoryInput) {
    if (!selected) {
      return saveAction({ kind: "create", input: values });
    }

    const input = categoryChanges(selected, values);

    if (!Object.keys(input).length) {
      setEditor(null);
      return;
    }

    return saveAction({ kind: "update", id: selected.id, input });
  }

  async function changeStatus(id: string, isActive: boolean) {
    setNotice({ message: "", error: false });

    try {
      const saved = await resource.mutate({
        kind: "status",
        id,
        isActive,
      });

      if (alive.current) {
        setNotice({
          message: saved.isActive
            ? "Categoría activada."
            : "Categoría desactivada.",
          error: false,
        });
      }
    } catch (error) {
      if (alive.current) {
        setNotice({
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos cambiar el estado.",
          error: true,
        });
      }
    }
  }

  return (
    <div className="categories-page">
      <Card>
        <h2 className="flex items-center gap-2 text-base font-bold text-heading">
          <Tags
            aria-hidden="true"
            size={18}
            className="text-accent"
          />
          Categorías
        </h2>

        <p className="mt-1 text-xs leading-relaxed text-muted">
          Organiza las secciones de tu catálogo y menú.
        </p>

        <div className="mt-4 flex min-h-16 items-center justify-end">
          {resource.busy && (
            <span role="status" className="sr-only">
              Guardando…
            </span>
          )}

          <Button
            size="sm"
            className="whitespace-nowrap max-sm:gap-1 max-sm:px-2.5 max-sm:text-[11px]"
            disabled={
              resource.loading ||
              !!resource.error ||
              resource.busy ||
              !!editor
            }
            onClick={() => {
              setNotice({ message: "", error: false });
              setEditor({ kind: "form" });
            }}
          >
            <Plus aria-hidden="true" size={14} />
            Nueva categoría
          </Button>
        </div>

        {resource.loading && (
          <div className="py-8">
            <LoadingState message="Cargando categorías…" />
          </div>
        )}

        {resource.error && (
          <Alert className="mt-4">
            <p>{resource.error}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={resource.retry}
            >
              Reintentar
            </Button>
          </Alert>
        )}

        {!resource.loading && !resource.error && (
          <CategoryList
            categories={resource.categories}
            disabled={resource.busy || !!editor}
            onEdit={(id) => {
              setNotice({ message: "", error: false });
              setEditor({ kind: "form", id });
            }}
            onImage={(id) => {
              setNotice({ message: "", error: false });
              setEditor({ kind: "image", id });
            }}
            onToggle={changeStatus}
          />
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Al desactivar una categoría, sus productos dejan de estar
          disponibles para órdenes nuevas y en el menú público. Su
          historial se conserva.
        </p>
      </Card>

      {notice.message && (
        <div className="fixed inset-x-4 bottom-24 z-40 sm:left-auto sm:bottom-6 sm:w-96">
          <Alert variant={notice.error ? "error" : "success"}>
            {notice.message}
          </Alert>
        </div>
      )}

      {editor && (
        <BottomSheet
          id={modalId}
          open
          variant="modal"
          busy={resource.busy}
          title={
            editor.kind === "image"
              ? "Imagen de la categoría"
              : selected
                ? "Editar categoría"
                : "Nueva categoría"
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind === "image" && selected ? (
            <CategoryImageForm
              category={selected}
              busy={resource.busy}
              onSave={saveAction}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <CategoryForm
              key={selected?.id ?? "new"}
              category={selected}
              busy={resource.busy}
              onSave={saveForm}
              onCancel={() => setEditor(null)}
            />
          )}
        </BottomSheet>
      )}
    </div>
  );
}
