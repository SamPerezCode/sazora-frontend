import { useEffect, useId, useRef, useState } from "react";
import { Power, RotateCcw } from "lucide-react";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { getLocations } from "../../business/services/organization.service";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import {
  getPreparationArea,
  savePreparationArea,
} from "../services/preparation-area.service";
import {
  areaChanges,
  areaDraft,
  areaFormSchema,
  areaLocationIdsSchema,
  sameLocationIds,
} from "../schemas/preparation-area.schema";
import type {
  AreaAction,
  AreaDraft,
  AreaLocation,
  AreaPatch,
  PreparationArea,
} from "../schemas/preparation-area.schema";
import {
  AreaLocationChips,
  AreaLocationPicker,
} from "./PreparationAreaLocations";

export type AreaMode = "create" | "edit" | "locations" | "status";

interface Props {
  session: AuthSession;
  mode: AreaMode;
  areaId?: string;
  initialLocationId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (error: unknown) => boolean;
}

export function PreparationAreaForm({
  session,
  mode,
  areaId,
  initialLocationId,
  onClose,
  onSaved,
  onError,
}: Props) {
  const dialogId = useId();

  // Mantiene el contexto de apertura para que una actualización
  // de sesión no reinicialice un formulario que se está editando.
  const [loadContext] = useState(() => ({
    session,
    areaId,
    initialLocationId,
    onClose,
    onError,
  }));

  const [snapshot, setSnapshot] = useState<{
    area?: PreparationArea;
    locations: AreaLocation[];
    initialIds: string[];
  } | null>(null);

  const [draft, setDraft] = useState(areaDraft);
  const [selected, setSelected] = useState<string[]>([]);
  const [forceLocations, setForceLocations] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useTimedMessage(5000);
  const [loadError, setLoadError] = useState("");
  const [locationsFailed, setLocationsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  const write = useRef<AbortController | null>(null);

  useEffect(() => {
    const { session, areaId, initialLocationId, onClose, onError } =
      loadContext;

    const controller = new AbortController();

    void Promise.all([
      getLocations(session, controller.signal),
      areaId
        ? getPreparationArea(
            areaId,
            session.accessToken,
            controller.signal
          )
        : Promise.resolve(undefined),
    ])
      .then(([locations, area]) => {
        controller.signal.throwIfAborted();

        if (
          area &&
          (area.id !== areaId ||
            area.businessId !== session.business.id)
        ) {
          throw new ApiError(
            502,
            "INVALID_RESPONSE",
            "No pudimos verificar el área."
          );
        }

        const activeIds = new Set(
          locations
            .filter((location) => location.isActive)
            .map((location) => location.id)
        );

        const initialIds = area
          ? area.locations
              .filter((location) => activeIds.has(location.id))
              .map((location) => location.id)
          : activeIds.has(initialLocationId)
            ? [initialLocationId]
            : [];

        setSnapshot({ area, locations, initialIds });
        setDraft(areaDraft(area));
        setSelected(initialIds);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (onError(error)) {
          onClose();
          return;
        }

        setLoadError(
          error instanceof ApiError
            ? error.message
            : "No pudimos cargar el formulario."
        );
      });

    return () => controller.abort();
  }, [attempt, loadContext]);

  useEffect(
    () => () => {
      write.current?.abort();
    },
    []
  );

  const area = snapshot?.area;
  const parsed = areaFormSchema.safeParse(draft);

  const changedLocations =
    forceLocations ||
    !sameLocationIds(selected, snapshot?.initialIds ?? []);

  const patch: AreaPatch =
    area && parsed.success && mode !== "locations"
      ? areaChanges(area, parsed.data)
      : {};

  if (changedLocations) {
    patch.locationIds = selected;
  }

  const idsValid = areaLocationIdsSchema.safeParse(selected).success;

  const valid =
    mode === "status"
      ? !!area
      : mode === "create"
        ? parsed.success && idsValid
        : Object.keys(patch).length > 0 &&
          (mode === "locations" || parsed.success) &&
          (!changedLocations || idsValid);

  const available = new Map(
    snapshot?.locations.map((location) => [location.id, location])
  );

  const historical = (area?.locations ?? []).map(
    (location) =>
      available.get(location.id) ?? {
        ...location,
        isActive: false,
      }
  );

  const options = [
    ...(snapshot?.locations.filter((location) => location.isActive) ??
      []),
  ];

  for (const location of historical) {
    if (!options.some((item) => item.id === location.id)) {
      options.push(location);
    }
  }

  const title =
    mode === "create"
      ? "Nueva área"
      : mode === "edit"
        ? "Editar área"
        : mode === "locations"
          ? "Administrar ubicaciones"
          : area?.isActive === false
            ? "¿Activar esta área?"
            : "¿Desactivar esta área?";

  function change(key: keyof AreaDraft, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [key]: "",
    }));
  }

  async function refreshLocations(signal: AbortSignal) {
    try {
      const locations = await getLocations(session, signal);
      signal.throwIfAborted();

      const ids = new Set(
        locations
          .filter((location) => location.isActive)
          .map((location) => location.id)
      );

      setSnapshot((previous) =>
        previous ? { ...previous, locations } : previous
      );

      setSelected((previous) => previous.filter((id) => ids.has(id)));

      setForceLocations(true);
      setLocationsFailed(false);
    } catch (error) {
      if (signal.aborted) return;

      if (onError(error)) {
        onClose();
        return;
      }

      setLocationsFailed(true);
      setMessage(
        "No pudimos actualizar las ubicaciones. Reintenta antes de guardar."
      );
    }
  }

  async function retryLocations() {
    if (write.current) return;

    const controller = new AbortController();
    write.current = controller;
    setBusy(true);

    try {
      await refreshLocations(controller.signal);
    } finally {
      write.current = null;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  async function submit() {
    if (!valid || busy || write.current || locationsFailed) {
      return;
    }

    let action: AreaAction;

    if (mode === "status" && area) {
      action = {
        kind: "status",
        id: area.id,
        isActive: !area.isActive,
      };
    } else if (mode === "create" && parsed.success) {
      action = {
        kind: "create",
        input: {
          ...parsed.data,
          locationIds: selected,
        },
      };
    } else if (area) {
      action = {
        kind: "update",
        id: area.id,
        input: patch,
      };
    } else {
      return;
    }

    const controller = new AbortController();
    write.current = controller;

    setBusy(true);
    setErrors({});
    setMessage("");

    try {
      const saved = await savePreparationArea(
        action,
        session.accessToken,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (
        saved.businessId !== session.business.id ||
        (area && saved.id !== area.id)
      ) {
        throw new ApiError(
          502,
          "INVALID_RESPONSE",
          "No pudimos verificar el resultado. Consulta el listado antes de repetir."
        );
      }

      onSaved(
        mode === "create"
          ? "Área creada."
          : mode === "status"
            ? saved.isActive
              ? "Área activada."
              : "Área desactivada."
            : mode === "locations"
              ? "Ubicaciones actualizadas."
              : "Área actualizada."
      );

      onClose();
    } catch (error: unknown) {
      if (controller.signal.aborted) return;

      if (onError(error)) {
        onClose();
        return;
      }

      const next: Record<string, string> = {};

      if (error instanceof ApiError) {
        for (const issue of error.errors) {
          const field = issue.field.split(".")[0].split("[")[0];

          next[field] ??= issue.message;
        }

        if (error.code === "PREPARATION_AREA_NAME_CONFLICT") {
          next.name =
            "Ya existe un área de preparación con ese nombre.";
        }

        if (
          error.code === "PREPARATION_AREA_LOCATIONS_NOT_AVAILABLE"
        ) {
          next.locationIds =
            "Una o varias ubicaciones dejaron de estar disponibles. Revisa la selección.";

          await refreshLocations(controller.signal);
        }
      }

      if (controller.signal.aborted) return;

      setErrors(next);

      if (!Object.keys(next).length) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "No pudimos guardar el área."
        );
      }
    } finally {
      write.current = null;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  const saveLabel =
    mode === "create"
      ? "Crear área"
      : mode === "locations"
        ? "Guardar ubicaciones"
        : mode === "status"
          ? area?.isActive
            ? "Desactivar área"
            : "Activar área"
          : "Guardar cambios";

  return (
    <BottomSheet
      id={dialogId}
      open
      variant="modal"
      className="pa-modal"
      title={title}
      busy={busy}
      onClose={onClose}
    >
      {!snapshot ? (
        <div className="pa-modal-body" role="status">
          {loadError ? (
            <Alert>
              {loadError}

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setLoadError("");
                  setAttempt((value) => value + 1);
                }}
              >
                Reintentar
              </Button>
            </Alert>
          ) : (
            "Cargando área y ubicaciones…"
          )}
        </div>
      ) : (
        <form
          className="pa-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="pa-modal-body">
            <p className="pa-modal-description">
              {mode === "locations" ? (
                <>
                  <strong>{area?.name}</strong> · Solo se modificarán
                  las ubicaciones de esta área.
                </>
              ) : mode === "status" ? (
                area?.isActive ? (
                  "Dejará de estar disponible para la operación en todas sus ubicaciones asignadas. Los productos y el historial no serán eliminados."
                ) : (
                  "El área volverá a estar activa globalmente. Las ubicaciones inactivas conservarán su estado."
                )
              ) : (
                "Una misma área puede funcionar en varias sedes. No necesitas crear una copia del área para cada ubicación."
              )}
            </p>

            {message && <Alert>{message}</Alert>}

            {mode === "status" ? (
              <div className="pa-affected">
                <h3>{area?.name} · Ubicaciones afectadas</h3>

                <AreaLocationChips locations={historical} />
              </div>
            ) : (
              <>
                {mode !== "locations" && (
                  <fieldset disabled={busy} className="pa-fields">
                    <legend className="sr-only">
                      Datos del área
                    </legend>

                    <div>
                      <TextField
                        label="Nombre del área"
                        name="name"
                        required
                        maxLength={100}
                        autoFocus
                        data-dialog-initial-focus
                        value={draft.name}
                        error={errors.name}
                        onChange={(event) =>
                          change("name", event.target.value)
                        }
                      />

                      <div className="pa-counter">
                        {draft.name.length}/100
                      </div>
                    </div>

                    <div>
                      <TextAreaField
                        label="Descripción"
                        name="description"
                        maxLength={255}
                        rows={2}
                        value={draft.description}
                        error={errors.description}
                        onChange={(event) =>
                          change("description", event.target.value)
                        }
                      />

                      <div className="pa-counter">
                        {draft.description.length}/255
                      </div>
                    </div>

                    <div className="pa-order-field">
                      <TextField
                        label="Orden de visualización"
                        name="displayOrder"
                        type="number"
                        min={0}
                        max={65535}
                        step={1}
                        required
                        value={draft.displayOrder}
                        error={
                          errors.displayOrder ||
                          (!parsed.success
                            ? parsed.error.issues.find(
                                (issue) =>
                                  issue.path[0] === "displayOrder"
                              )?.message
                            : undefined)
                        }
                        onChange={(event) =>
                          change("displayOrder", event.target.value)
                        }
                      />
                    </div>
                  </fieldset>
                )}

                <AreaLocationPicker
                  locations={options}
                  selected={selected}
                  changed={changedLocations}
                  disabled={busy || locationsFailed}
                  error={
                    errors.locationIds ||
                    ((changedLocations || mode === "create") &&
                    !idsValid
                      ? "Selecciona entre 1 y 100 ubicaciones activas."
                      : undefined)
                  }
                  onChange={(ids) => {
                    setSelected(ids);

                    setErrors((previous) => ({
                      ...previous,
                      locationIds: "",
                    }));
                  }}
                />

                {locationsFailed && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void retryLocations()}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Actualizar ubicaciones
                  </Button>
                )}
              </>
            )}
          </div>

          <footer className="pa-modal-footer">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              size="sm"
              type="submit"
              loading={busy}
              loadingText="Guardando…"
              variant={
                mode === "status" && area?.isActive
                  ? "danger"
                  : "primary"
              }
              disabled={!valid || locationsFailed}
            >
              {mode === "status" && (
                <Power size={16} aria-hidden="true" />
              )}

              {saveLabel}
            </Button>
          </footer>
        </form>
      )}
    </BottomSheet>
  );
}
