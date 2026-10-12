import { useCallback, useId, useState } from "react";
import { Factory, Store } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { SelectField } from "../../../components/forms/SelectField";
import {
  DiscardChangesDialog,
  UnsavedChangesGuard,
} from "../../../components/feedback/UnsavedChangesGuard";
import { useAdminForm } from "../../../hooks/useAdminForm";
import { useAdminResource } from "../../../hooks/useAdminResource";
import type { AuthSession } from "../../auth/types/auth.types";
import {
  getLocation,
  saveLocation,
  setLocationStatus,
} from "../services/organization.service";
import {
  emptyLocationDraft,
  locationFormSchema,
  locationTypes,
} from "../schemas/organization.schema";
import type {
  BusinessLocation,
  LocationDraft,
} from "../schemas/organization.schema";
import { SettingsFields } from "./SettingsFields";
import type { SettingsField } from "./SettingsFields";

const fields: SettingsField[] = [
  {
    name: "code",
    label: "Código",
    max: 30,
    required: true,
  },
  {
    name: "name",
    label: "Nombre",
    max: 150,
    required: true,
  },
  {
    name: "address",
    label: "Dirección",
    max: 250,
    wide: true,
  },
  {
    name: "countryCode",
    label: "País (código de dos letras)",
    max: 2,
    required: true,
  },
  {
    name: "departmentName",
    label: "Departamento",
    max: 100,
  },
  {
    name: "municipalityName",
    label: "Municipio",
    max: 100,
  },
  {
    name: "postalCode",
    label: "Código postal",
    max: 12,
  },
  {
    name: "phone",
    label: "Teléfono",
    max: 30,
    type: "tel",
  },
  {
    name: "email",
    label: "Correo",
    max: 254,
    type: "email",
  },
  {
    name: "departmentCode",
    label: "Código de departamento (opcional)",
    max: 5,
  },
  {
    name: "municipalityCode",
    label: "Código de municipio (opcional)",
    max: 10,
  },
];

export function LocationCapabilities({
  location,
}: {
  location: BusinessLocation;
}) {
  return (
    <div className="configuration-badges">
      {location.isInventoryLocation && <span>Inventario</span>}
      {location.isProductionLocation && <span>Producción</span>}
      {location.isSalesLocation && <span>Ventas</span>}
    </div>
  );
}

export function LocationDialog({
  action,
  onClose,
  onSaved,
}: {
  action: {
    kind: "create" | "edit" | "detail" | "status";
    id?: string;
  };
  onClose: () => void;
  onSaved: (location: BusinessLocation) => void;
}) {
  return action.kind === "create" ? (
    <LocationForm
      original={null}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : (
    <ExistingLocation
      id={action.id!}
      kind={action.kind}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ExistingLocation({
  id,
  kind,
  onClose,
  onSaved,
}: {
  id: string;
  kind: "edit" | "detail" | "status";
  onClose: () => void;
  onSaved: (location: BusinessLocation) => void;
}) {
  const modalId = useId();

  const load = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      getLocation(id, session, signal),
    [id]
  );

  const resource = useAdminResource(load, "location:" + id);

  if (!resource.data) {
    return (
      <BottomSheet
        id={modalId}
        open
        variant="modal"
        title="Ubicación"
        className="configuration-modal"
        onClose={onClose}
      >
        {resource.pending ? (
          <LoadingState message="Consultando ubicación…" />
        ) : (
          <Alert>
            <p>{resource.error}</p>

            <Button variant="secondary" onClick={resource.refresh}>
              Reintentar
            </Button>
          </Alert>
        )}
      </BottomSheet>
    );
  }

  return kind === "edit" ? (
    <LocationForm
      original={resource.data}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : (
    <LocationDetail
      location={resource.data}
      status={kind === "status"}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function LocationForm({
  original,
  onClose,
  onSaved,
}: {
  original: BusinessLocation | null;
  onClose: () => void;
  onSaved: (location: BusinessLocation) => void;
}) {
  const id = useId();
  const { session } = useAppShell();

  const form = useAdminForm<LocationDraft>(
    original
      ? locationFormSchema.parse(original)
      : emptyLocationDraft()
  );

  const [step, setStep] = useState(original ? 2 : 1);
  const [discard, setDiscard] = useState(false);

  function close() {
    if (form.busy) return;

    if (form.dirty && !form.uncertain) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  async function submit() {
    let saved: BusinessLocation | undefined;

    await form.save(
      async (draft, signal) => {
        saved = await saveLocation(
          draft,
          original,
          original?.id ?? null,
          session,
          signal
        );

        return locationFormSchema.parse(saved);
      },
      () => {
        if (saved) onSaved(saved);
      }
    );
  }

  return (
    <>
      <UnsavedChangesGuard dirty={form.dirty} busy={form.busy} />

      {discard && (
        <DiscardChangesDialog
          onCancel={() => setDiscard(false)}
          onDiscard={onClose}
        />
      )}

      <BottomSheet
        id={id}
        open
        variant="modal"
        title={original ? "Editar ubicación" : "Nueva ubicación"}
        className="configuration-modal"
        busy={form.busy}
        onClose={close}
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();

            if (step === 1) {
              if (
                locationTypes.some(
                  (type) => type.value === form.draft.locationType
                )
              ) {
                setStep(2);
              }
            } else {
              void submit();
            }
          }}
        >
          {!original && (
            <div className="configuration-step">
              <p>
                Paso {step} de 2 ·{" "}
                {step === 1
                  ? "Elige el tipo de lugar"
                  : "Datos de la ubicación"}
              </p>

              <progress
                value={step}
                max={2}
                aria-label="Progreso de nueva ubicación"
              />
            </div>
          )}

          <fieldset
            disabled={form.busy || form.uncertain}
            className="configuration-section"
          >
            <legend className="sr-only">Datos de la ubicación</legend>

            {step === 1 ? (
              locationTypes.map((type, index) => {
                const Icon = index === 0 ? Factory : Store;

                return (
                  <button
                    type="button"
                    key={type.value}
                    className="configuration-choice"
                    aria-pressed={
                      form.draft.locationType === type.value
                    }
                    onClick={() =>
                      form.change({
                        locationType: type.value,
                      })
                    }
                  >
                    <Icon size={24} />

                    <span>
                      <strong>{type.label}</strong>

                      <small>
                        {index === 0
                          ? "Produce, almacena y despacha productos."
                          : "Recibe inventario y registra ventas."}
                      </small>

                      <small>
                        Inventario ·{" "}
                        {index === 0 ? "Producción" : "Ventas"}
                      </small>
                    </span>
                  </button>
                );
              })
            ) : (
              <>
                {original && (
                  <SelectField
                    label="Tipo de ubicación"
                    required
                    value={form.draft.locationType}
                    options={locationTypes}
                    error={form.errors.locationType}
                    onValueChange={(value) =>
                      form.change({ locationType: value })
                    }
                  />
                )}

                {original &&
                  original.locationType !==
                    form.draft.locationType && (
                    <p className="configuration-warning">
                      Cambiar el tipo modificará las operaciones
                      permitidas para esta ubicación.
                    </p>
                  )}

                <SettingsFields
                  fields={fields}
                  values={form.draft}
                  errors={form.errors}
                  onChange={(name, value) =>
                    form.change({ [name]: value })
                  }
                />
              </>
            )}
          </fieldset>

          {form.message && <Alert>{form.message}</Alert>}

          <footer className="configuration-save">
            {!original && step === 2 && (
              <Button
                variant="secondary"
                disabled={form.busy || form.uncertain}
                onClick={() => setStep(1)}
              >
                Volver
              </Button>
            )}

            <Button
              variant="cancel"
              disabled={form.busy}
              onClick={close}
            >
              {form.uncertain
                ? "Cerrar y consultar listado"
                : "Cancelar"}
            </Button>

            <Button
              type="submit"
              loading={form.busy}
              loadingText="Guardando…"
              disabled={
                form.busy ||
                form.uncertain ||
                (step === 1 ? !form.draft.locationType : !form.dirty)
              }
            >
              {step === 1
                ? "Continuar"
                : original
                  ? "Guardar cambios"
                  : "Crear ubicación"}
            </Button>
          </footer>
        </form>
      </BottomSheet>
    </>
  );
}

function LocationDetail({
  location,
  status,
  onClose,
  onSaved,
}: {
  location: BusinessLocation;
  status: boolean;
  onClose: () => void;
  onSaved: (location: BusinessLocation) => void;
}) {
  const id = useId();
  const { session } = useAppShell();

  const form = useAdminForm({
    isActive: location.isActive,
  });

  async function confirm() {
    let saved: BusinessLocation | undefined;

    await form.save(
      async (_, signal) => {
        saved = await setLocationStatus(
          location.id,
          !location.isActive,
          session,
          signal
        );

        return { isActive: saved.isActive };
      },
      () => {
        if (saved) onSaved(saved);
      }
    );
  }

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      className="configuration-modal"
      title={
        status
          ? location.isActive
            ? "Desactivar ubicación"
            : "Reactivar ubicación"
          : location.name
      }
      busy={form.busy}
      onClose={onClose}
    >
      <UnsavedChangesGuard dirty={false} busy={form.busy} />

      {status ? (
        <p>
          {location.isActive
            ? "Esta ubicación dejará de estar disponible para nuevas operaciones. Su información y su historial se conservarán."
            : "Esta ubicación volverá a estar disponible para nuevas operaciones."}
        </p>
      ) : (
        <div className="configuration-section">
          <p>
            {
              locationTypes.find(
                (type) => type.value === location.locationType
              )?.label
            }
            {" · "}
            {location.isActive ? "Activa" : "Inactiva"}
          </p>

          <LocationCapabilities location={location} />

          <dl className="configuration-fields">
            {fields.map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>
                  {String(
                    location[field.name as keyof BusinessLocation] ??
                      "—"
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {form.message && <Alert>{form.message}</Alert>}

      <footer className="configuration-save">
        <Button
          variant="cancel"
          disabled={form.busy}
          onClick={onClose}
        >
          Cerrar
        </Button>

        {status && (
          <Button
            variant={location.isActive ? "danger" : "primary"}
            loading={form.busy}
            loadingText="Guardando…"
            disabled={form.busy || form.uncertain}
            onClick={() => void confirm()}
          >
            {location.isActive ? "Desactivar ubicación" : "Reactivar"}
          </Button>
        )}
      </footer>
    </BottomSheet>
  );
}
