import { useEffect, useId, useRef, useState } from "react";
import {
  ChefHat,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAppShell } from "../../app/layout/shell-context";
import { Alert } from "../../components/feedback/Alert";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ApiError } from "../../lib/http/client";
import { areaChanges } from "./preparation-area.schema";
import { BottomSheet } from "../../components/layout/BottomSheet";
import { ActionMenu } from "../../components/ui/ActionMenu";
import type {
  AreaInput,
  PreparationArea,
} from "./preparation-area.schema";
import { PreparationAreaForm } from "./PreparationAreaForm";
import { usePreparationAreas } from "./usePreparationAreas";

export function PreparationAreasPanel() {
  const { session } = useAppShell();
  const resource = usePreparationAreas(session);
  const modalId = useId();

  // undefined: cerrado; null: crear; objeto: editar.
  const [editing, setEditing] = useState<
    PreparationArea | null | undefined
  >(undefined);

  const [notice, setNotice] = useState({
    message: "",
    error: false,
  });

  const alive = useRef(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice.message) return;

    const timeoutId = window.setTimeout(() => {
      setNotice((current) =>
        current === notice ? { message: "", error: false } : current
      );
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  function closeForm(): void {
    setEditing(undefined);

    requestAnimationFrame(() => {
      if (opener.current?.isConnected) {
        opener.current.focus();
      }
    });
  }

  async function save(values: AreaInput): Promise<void> {
    const area = editing ?? undefined;
    const patch = area ? areaChanges(area, values) : values;

    if (area && Object.keys(patch).length === 0) {
      closeForm();
      return;
    }

    await resource.mutate(
      area
        ? {
            kind: "update",
            id: area.id,
            input: patch,
          }
        : {
            kind: "create",
            input: values,
          }
    );

    if (!alive.current) return;

    setNotice({
      message: area ? "Área actualizada." : "Área creada.",
      error: false,
    });

    closeForm();
  }

  async function changeStatus(
    area: PreparationArea,
    isActive: boolean
  ): Promise<void> {
    setNotice({
      message: "",
      error: false,
    });

    try {
      const saved = await resource.mutate({
        kind: "status",
        id: area.id,
        isActive,
      });

      if (!alive.current) return;

      setNotice({
        message: `${saved.name}: ${
          saved.isActive ? "área activada" : "área desactivada"
        }.`,
        error: false,
      });
    } catch (error: unknown) {
      if (!alive.current) return;

      setNotice({
        message:
          error instanceof ApiError
            ? error.message
            : "No pudimos cambiar el estado.",
        error: true,
      });
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-base font-bold text-heading">
        <ChefHat
          aria-hidden="true"
          size={18}
          className="text-accent"
        />
        Áreas de preparación
      </h2>

      <p className="mt-1 text-xs leading-relaxed text-muted">
        Organiza dónde se prepara o despacha cada producto. Los
        cambios de estado se guardan al instante.
      </p>

      <div className="mt-4 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-full min-w-0 items-center">
          {resource.busy ? (
            <p role="status" className="text-xs text-muted">
              Guardando…
            </p>
          ) : notice.message ? (
            <div
              role={notice.error ? "alert" : "status"}
              aria-atomic="true"
              className={[
                "flex max-h-full w-full items-start gap-2",
                "overflow-y-auto rounded-xl border px-3 py-2",
                "text-xs leading-relaxed",
                notice.error
                  ? "border-danger/35 bg-danger/10 text-danger dark:text-[#efa38f]"
                  : "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200",
              ].join(" ")}
            >
              {notice.error ? (
                <CircleAlert
                  aria-hidden="true"
                  size={16}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <CircleCheck
                  aria-hidden="true"
                  size={16}
                  className="mt-0.5 shrink-0"
                />
              )}

              <span className="min-w-0 [overflow-wrap:anywhere]">
                {notice.message}
              </span>
            </div>
          ) : null}
        </div>

        <Button
          size="sm"
          className="whitespace-nowrap"
          disabled={
            resource.loading ||
            !!resource.error ||
            resource.busy ||
            editing !== undefined
          }
          onClick={(event) => {
            opener.current = event.currentTarget;
            setNotice({ message: "", error: false });
            setEditing(null);
          }}
        >
          <Plus aria-hidden="true" size={16} />
          Nueva área
        </Button>
      </div>

      {resource.loading && (
        <div className="py-8">
          <LoadingState message="Cargando áreas…" />
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

      {editing !== undefined && (
        <BottomSheet
          id={modalId}
          open
          variant="modal"
          title={editing ? "Editar área" : "Nueva área"}
          busy={resource.busy}
          onClose={closeForm}
        >
          <PreparationAreaForm
            key={editing?.id ?? "new"}
            area={editing ?? undefined}
            busy={resource.busy}
            onSave={save}
            onCancel={closeForm}
          />
        </BottomSheet>
      )}

      {!resource.loading && !resource.error && (
        <>
          {resource.areas.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              Todavía no tienes áreas. Crea al menos una para
              asignarla a tus productos.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-outline">
              {resource.areas.map((area) => (
                <li
                  key={area.id}
                  className="flex items-center gap-2 py-3"
                >
                  <ChefHat
                    aria-hidden="true"
                    size={16}
                    className="shrink-0 text-accent"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
                      {area.name}
                    </p>

                    {area.description && (
                      <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
                        {area.description}
                      </p>
                    )}
                  </div>

                  <span
                    className={[
                      "flex shrink-0 items-center gap-1 text-xs font-medium",
                      area.isActive ? "text-heading" : "text-muted",
                    ].join(" ")}
                  >
                    {area.isActive ? (
                      <CircleCheck
                        aria-hidden="true"
                        size={14}
                        className="text-accent"
                      />
                    ) : (
                      <CircleSlash aria-hidden="true" size={14} />
                    )}

                    {area.isActive ? "Activa" : "Inactiva"}
                  </span>

                  <ActionMenu
                    label={`Acciones de ${area.name}`}
                    disabled={resource.busy || editing !== undefined}
                    actions={[
                      {
                        id: "edit",
                        label: "Editar",
                        icon: <Pencil aria-hidden="true" size={16} />,
                        onSelect: (trigger) => {
                          opener.current = trigger;
                          setNotice({ message: "", error: false });
                          setEditing(area);
                        },
                      },
                      {
                        id: "status",
                        label: area.isActive
                          ? "Desactivar"
                          : "Activar",
                        icon: area.isActive ? (
                          <ToggleRight
                            aria-hidden="true"
                            size={20}
                            className="shrink-0"
                          />
                        ) : (
                          <ToggleLeft
                            aria-hidden="true"
                            size={20}
                            className="shrink-0"
                          />
                        ),
                        onSelect: () => {
                          void changeStatus(area, !area.isActive);
                        },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Desactivar un área conserva su historial e impide asignarla a
        productos nuevos o al cambiar su área.
      </p>
    </Card>
  );
}
