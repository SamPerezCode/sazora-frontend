import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { Check, MapPin, RotateCcw } from "lucide-react";
import { EmployeeLocationChoice } from "./EmployeeLocationChoice";
import {
  EmployeeIdentity,
  EmployeeStatus,
  EmployeeViewState,
} from "./EmployeeVisuals";
import { Alert } from "../../../components/feedback/Alert";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { employeeErrorMessage } from "../utils/employee-errors";
import {
  hasSelectedProductionPlant,
  isActiveProductionPlant,
  sortEmployeeLocations,
} from "../utils/production-locations";

import { Button } from "../../../components/ui/Button";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type { BusinessLocation } from "../../business/schemas/organization.schema";
import { getLocations } from "../../business/services/organization.service";
import type {
  Employee,
  EmployeeAction,
} from "../schemas/employee.schema";
import { normalizeEmployeeAssignments } from "../schemas/employee-location.schema";
import type {
  EmployeeAssignment,
  EmployeeLocationAccess,
} from "../schemas/employee-location.schema";
import {
  getEmployeeLocations,
  saveEmployeeLocations,
} from "../services/employee-location.service";

type CreateAction = Extract<EmployeeAction, { kind: "create" }>;

interface Props {
  session: AuthSession;
  employee?: Employee;
  creation?: CreateAction;
  onCreate?: (action: CreateAction) => Promise<Employee>;
  onSaved: () => void;
  onFinishLater: () => void;
  onCancel: () => void;
  onBack?: () => void;
  onUnavailable: (message?: string) => void;
  onBusyChange: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface Selection {
  ids: string[];
  defaultId: string | null;
}

function fingerprint(assignments: readonly EmployeeAssignment[]) {
  return assignments
    .map((item) => `${item.locationId}:${item.isDefault}`)
    .sort()
    .join("|");
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "FORBIDDEN":
        return "No tienes permisos para administrar empleados.";

      case "ADMIN_LOCATION_ASSIGNMENT_NOT_ALLOWED":
        return (
          "Los administradores tienen acceso global y no requieren " +
          "asignaciones de ubicación."
        );

      case "EMPLOYEE_LOCATIONS_NOT_AVAILABLE":
        return (
          "No fue posible actualizar las ubicaciones porque la " +
          "información del empleado cambió. Actualiza los datos " +
          "e inténtalo nuevamente."
        );

      default:
        return employeeErrorMessage(error, "No pudimos guardar las ubicaciones.");
    }
  }

  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  return error instanceof Error
    ? error.message
    : "No pudimos guardar las ubicaciones.";
}

export function EmployeeLocationsForm({
  session,
  employee,
  creation,
  onCreate,
  onSaved,
  onFinishLater,
  onCancel,
  onBack,
  onUnavailable,
  onBusyChange,
  onDirtyChange,
}: Props) {
  const groupId = useId();
  const knownGlobal = employee?.roles.includes("ADMIN") ?? false;
  const membershipId = employee?.membershipId;

  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [access, setAccess] = useState<EmployeeLocationAccess | null>(
    null
  );

  const [selection, setSelection] = useState<Selection>({
    ids: [],
    defaultId: null,
  });

  const [attempt, setAttempt] = useState(0);
  const [isLoadingLocations, setIsLoadingLocations] =
    useState(!knownGlobal);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(
    Boolean(membershipId) && !knownGlobal
  );

  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isSavingLocations, setIsSavingLocations] = useState(false);
  const [readError, setReadError] = useState("");
  const [message, setMessage] = useTimedMessage();
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const [forceGlobal, setForceGlobal] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [missing, setMissing] = useState(false);
  const [partial, setPartial] = useState(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [confirmWithoutPlant, setConfirmWithoutPlant] = useState(false);

  const initialized = useRef(false);
  const pending = useRef(false);
  const writing = useRef<AbortController | null>(null);
  const createdEmployee = useRef<Employee | null>(null);

  const busy = isCreatingEmployee || isSavingLocations;
  const loading = isLoadingLocations || isLoadingAssignments;
  const globalAccess =
    knownGlobal || forceGlobal || !!access?.hasGlobalLocationAccess;

  function reloadLocations() {
    if (busy || loading || globalAccess || forbidden) return;

    const readId =
      membershipId ?? createdEmployee.current?.membershipId;

    setIsLoadingLocations(true);
    setIsLoadingAssignments(Boolean(readId));
    setReadError("");
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    if (knownGlobal) return;

    const controller = new AbortController();

    /*
     * En un reintento posterior al alta ya conocemos la membresía.
     * No volvemos a crear al empleado.
     */
    const readId =
      membershipId ?? createdEmployee.current?.membershipId;

    const locationsRequest = getLocations(
      session,
      controller.signal
    ).finally(() => {
      if (!controller.signal.aborted) {
        setIsLoadingLocations(false);
      }
    });

    const assignmentsRequest = readId
      ? getEmployeeLocations(
          readId,
          session.accessToken,
          controller.signal
        ).finally(() => {
          if (!controller.signal.aborted) {
            setIsLoadingAssignments(false);
          }
        })
      : Promise.resolve(null);

    void Promise.all([locationsRequest, assignmentsRequest])
      .then(([available, currentAccess]) => {
        if (controller.signal.aborted) return;

        const activeIds = new Set(
          available
            .filter((item) => item.isActive)
            .map((item) => item.id)
        );

        const firstLoad = !initialized.current;
        initialized.current = true;

        setLocations(available);
        setAccess(currentAccess);
        setNeedsRefresh(false);

        setSelection((previous) => {
          const ids = [
            ...new Set(
              firstLoad
                ? (currentAccess?.assignments ?? []).map(
                    (item) => item.locationId
                  )
                : previous.ids
            ),
          ].filter((id) => activeIds.has(id));

          const preferred = firstLoad
            ? (currentAccess?.defaultLocationId ??
              currentAccess?.assignments.find(
                (item) => item.isDefault
              )?.locationId ??
              null)
            : previous.defaultId;

          return {
            ids,
            defaultId:
              preferred && ids.includes(preferred)
                ? preferred
                : (ids[0] ?? null),
          };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (
          error instanceof ApiError &&
          error.code === "EMPLOYEE_NOT_FOUND"
        ) {
          setMissing(true);
          return;
        }

        if (
          error instanceof ApiError &&
          error.code === "ADMIN_LOCATION_ASSIGNMENT_NOT_ALLOWED"
        ) {
          setForceGlobal(true);
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          setForbidden(true);
        }

        setReadError(errorMessage(error));
      });

    return () => controller.abort();
  }, [session, membershipId, knownGlobal, attempt]);

  useEffect(() => {
    if (missing) onUnavailable("El empleado ya no existe. Actualizamos el listado.");
  }, [missing, onUnavailable]);

  useEffect(() => {
    return () => writing.current?.abort();
  }, []);

  const currentAssignments = selection.ids.map((locationId) => ({
    locationId,
    isDefault: locationId === selection.defaultId,
  }));

  const dirty =
    !globalAccess &&
    fingerprint(currentAssignments) !==
      fingerprint(access?.assignments ?? []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const activeIds = new Set(
    locations.filter((item) => item.isActive).map((item) => item.id)
  );

  const retiredAssignments = (access?.assignments ?? []).filter(
    (item) => !activeIds.has(item.locationId)
  );

  const unavailableAssignments = retiredAssignments.filter(
    (item) =>
      !locations.some((location) => location.id === item.locationId)
  );

  const locked =
    busy ||
    loading ||
    globalAccess ||
    forbidden ||
    creationUncertain ||
    needsRefresh ||
    !!readError;

  function toggle(locationId: string, checked: boolean) {
    if (locked || !activeIds.has(locationId)) return;

    setMessage("");
    setFieldErrors([]);

    setSelection((previous) => {
      const ids = checked
        ? [...new Set([...previous.ids, locationId])]
        : previous.ids.filter((id) => id !== locationId);

      return {
        ids,
        defaultId:
          previous.defaultId && ids.includes(previous.defaultId)
            ? previous.defaultId
            : (ids[0] ?? null),
      };
    });
  }

  const name = employee?.fullName ?? creation?.input.fullName ?? "";
  const roles = employee?.roles ?? creation?.input.roles ?? [];
  const isProduction = roles.includes("PRODUCTION");
  const orderedLocations = sortEmployeeLocations(locations, roles);
  const hasPlant = hasSelectedProductionPlant(locations, selection.ids);

  async function submit(allowWithoutPlant = false) {
    if (pending.current || locked || (!creation && !dirty)) return;

    if (isProduction && !hasPlant && !allowWithoutPlant) {
      setConfirmWithoutPlant(true);
      return;
    }

    pending.current = true;
    setConfirmWithoutPlant(false);
    const controller = new AbortController();
    writing.current = controller;
    onBusyChange(true);
    setMessage("");
    setFieldErrors([]);

    try {
      const assignments = normalizeEmployeeAssignments(
        selection.ids,
        selection.defaultId,
        locations
      );

      let target = employee ?? createdEmployee.current;

      if (!target) {
        if (!creation || !onCreate) {
          throw new Error("No se encontró el empleado.");
        }

        setIsCreatingEmployee(true);
        target = await onCreate(creation);
        createdEmployee.current = target;
        setIsCreatingEmployee(false);
      }

      controller.signal.throwIfAborted();

      if (target.roles.includes("ADMIN")) {
        throw new ApiError(
          409,
          "ADMIN_LOCATION_ASSIGNMENT_NOT_ALLOWED",
          "Los administradores tienen acceso global."
        );
      }

      // Al crear sin ubicaciones no necesitamos enviar un PUT vacío.
      if (employee || assignments.length > 0) {
        setIsSavingLocations(true);

        await saveEmployeeLocations(
          target.membershipId,
          assignments,
          session.accessToken,
          controller.signal
        );
      }

      controller.signal.throwIfAborted();
      onSaved();
    } catch (error: unknown) {
      if (controller.signal.aborted) return;

      if (createdEmployee.current) {
        setPartial(true);
      } else if (
        creation &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500)
      ) {
        // El POST podría haberse procesado: no repetirlo a ciegas.
        setCreationUncertain(true);
      }

      if (error instanceof ApiError) {
        if (error.code === "EMPLOYEE_NOT_FOUND") {
          setMissing(true);
          return;
        }

        if (error.code === "ADMIN_LOCATION_ASSIGNMENT_NOT_ALLOWED") {
          setForceGlobal(true);
        }

        if (error.code === "EMPLOYEE_LOCATIONS_NOT_AVAILABLE") {
          setNeedsRefresh(true);
        }

        if (error.status === 403) {
          setForbidden(true);
        }

        setFieldErrors(
          error.code === "EMPLOYEE_ROLE_NOT_AVAILABLE"
            ? ["Roles: El rol seleccionado no está disponible."]
            : error.errors.map((issue) =>
                `${issue.field.startsWith("roles") ? "Roles" : issue.field}: ${issue.message}`
              )
        );
      }

      if (error instanceof z.ZodError) {
        setFieldErrors(error.issues.map((issue) => issue.message));
      }

      setMessage(errorMessage(error));
    } finally {
      pending.current = false;
      writing.current = null;

      if (!controller.signal.aborted) {
        setIsCreatingEmployee(false);
        setIsSavingLocations(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <div className="employee-editor-form">
      <div className="shrink-0 space-y-4">
        <p className="text-sm text-muted">
          Define en qué sedes o áreas operativas puede trabajar este
          empleado y cuál utilizará de forma predeterminada.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-4">
          <EmployeeIdentity
            name={name}
            email={employee?.email ?? creation?.input.email ?? ""}
            roles={roles}
          />

          {employee && (
            <EmployeeStatus
              active={employee.membershipIsActive}
              accountActive={employee.isActive}
            />
          )}
        </div>
      </div>

      <div className="employee-editor-fields space-y-4">
        <p className="text-sm text-muted">
          Los roles definen qué puede hacer el empleado. Las
          ubicaciones definen dónde puede hacerlo.
        </p>

        {isProduction && !globalAccess && (
          <p className="rounded-xl border border-outline bg-secondary/30 p-3 text-sm text-heading">
            Este empleado tendrá funciones de producción. Se recomienda asignarle
            una planta de producción como ubicación predeterminada.
          </p>
        )}

        {partial && (
          <p
            role="status"
            className="rounded-xl border border-outline p-3 text-sm"
          >
            El empleado fue creado, pero no fue posible guardar sus
            ubicaciones.
          </p>
        )}

        {creationUncertain && (
          <p
            role="status"
            className="rounded-xl border border-outline p-3 text-sm"
          >
            No pudimos confirmar la creación. Revisa el listado antes
            de intentar crear nuevamente al empleado.
          </p>
        )}

        {globalAccess ? (
          <div className="rounded-xl border border-outline p-4">
            <strong>Acceso global</strong>
            <p className="mt-1 text-sm text-muted">
              Los administradores tienen acceso a todas las
              ubicaciones y no requieren asignaciones individuales.
            </p>
          </div>
        ) : (
          <>
            {loading && (
              <EmployeeViewState
                kind="loading"
                title="Consultando ubicaciones y asignaciones…"
                rows={3}
              />
            )}

            {!loading && readError && (
              <EmployeeViewState
                kind="error"
                title="No pudimos cargar las ubicaciones"
                description={readError}
                action={
                  !forbidden && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={reloadLocations}
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      Reintentar
                    </Button>
                  )
                }
              />
            )}

            {needsRefresh && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || loading}
                onClick={reloadLocations}
              >
                Actualizar datos
              </Button>
            )}

            {forbidden && (
              <p role="status" className="text-sm text-muted">
                No tienes permisos para editar estas asignaciones.
              </p>
            )}

            {!loading && !readError && (
              <>
                {retiredAssignments.length > 0 && (
                  <p className="rounded-xl border border-outline p-3 text-sm">
                    Las asignaciones a ubicaciones inactivas o no
                    disponibles serán retiradas al guardar.
                  </p>
                )}

                {locations.length === 0 &&
                unavailableAssignments.length === 0 ? (
                  <EmployeeViewState
                    kind="empty"
                    icon={MapPin}
                    title="Aún no hay ubicaciones creadas"
                    description="Crea sedes o la planta en “Sedes y planta” para poder asignarlas."
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span className="font-semibold uppercase">
                      Ubicaciones
                    </span>

                    <span>{selection.ids.length} seleccionadas</span>
                  </div>
                )}

                {locations.length > 0 && activeIds.size === 0 && (
                  <p className="text-sm text-muted">
                    No hay ubicaciones activas disponibles.
                  </p>
                )}

                <fieldset
                  disabled={locked}
                  aria-invalid={fieldErrors.length > 0}
                  aria-describedby={
                    fieldErrors.length
                      ? `${groupId}-errors`
                      : undefined
                  }
                  className="min-w-0 space-y-3"
                >
                  <legend className="sr-only">
                    Ubicaciones asignadas y predeterminada
                  </legend>

                  {orderedLocations.map((location) => (
                    <EmployeeLocationChoice
                      key={location.id}
                      location={location}
                      recommendation={
                        isProduction && isActiveProductionPlant(location)
                          ? creation ? "Recomendada" : "Recomendada para Producción"
                          : undefined
                      }
                      groupId={groupId}
                      checked={selection.ids.includes(location.id)}
                      isDefault={
                        selection.ids.includes(location.id) &&
                        selection.defaultId === location.id
                      }
                      locked={locked}
                      formerlyAssigned={retiredAssignments.some(
                        (item) => item.locationId === location.id
                      )}
                      onToggle={(checked) =>
                        toggle(location.id, checked)
                      }
                      onDefault={() => {
                        setSelection((previous) => ({
                          ...previous,
                          defaultId: location.id,
                        }));

                        setFieldErrors([]);
                        setMessage("");
                      }}
                    />
                  ))}

                  {unavailableAssignments.map((item) => (
                    <div
                      key={item.locationId}
                      className="rounded-xl border border-outline p-4 text-sm"
                    >
                      <strong>{item.name}</strong>
                      <p className="mt-1 text-muted">
                        {item.code} · No disponible · Se retirará al
                        guardar
                      </p>
                    </div>
                  ))}
                </fieldset>

                {selection.ids.length === 0 && (
                  <p className="rounded-xl border border-outline bg-secondary/30 p-3 text-sm">
                    Este empleado quedará sin una ubicación operativa
                    asignada. Cuando se active el control por
                    ubicación, no podrá ingresar a los módulos
                    operativos.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {message && <Alert>{message}</Alert>}

        {fieldErrors.length > 0 && (
          <ul
            id={`${groupId}-errors`}
            role="alert"
            className="list-inside list-disc text-sm text-danger"
          >
            {fieldErrors.map((error, index) => (
              <li key={`${index}:${error}`}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="employee-modal-footer">
        {creationUncertain ? (
          <Button
            className="col-span-2"
            variant="secondary"
            onClick={() => onUnavailable()}
          >
            Finalizar y revisar listado
          </Button>
        ) : partial ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="min-w-0 whitespace-normal"
              disabled={busy}
              onClick={onFinishLater}
            >
              <span>Finalizar y configurar después</span>
            </Button>

            <Button
              size="sm"
              className="min-w-0 whitespace-normal"
              disabled={locked}
              loading={isSavingLocations}
              loadingText="Guardando…"
              onClick={() => void submit()}
            >
              <span>Reintentar asignación</span>
            </Button>
          </>
        ) : globalAccess || forbidden ? (
          <Button
            className="col-span-2"
            variant="secondary"
            onClick={onCancel}
          >
            Cerrar
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="employee-cancel"
              disabled={busy}
              onClick={creation && onBack ? onBack : onCancel}
            >
              {creation && onBack ? "Volver" : "Cancelar"}
            </Button>

            <Button
              size="sm"
              className="min-w-0 whitespace-normal"
              disabled={locked || (!creation && !dirty)}
              loading={busy}
              loadingText={
                isCreatingEmployee ? "Creando…" : "Guardando…"
              }
              onClick={() => void submit()}
            >
              <Check
                aria-hidden="true"
                size={16}
                className="shrink-0"
              />

              <span>
                {creation ? "Crear empleado" : "Guardar asignaciones"}
              </span>
            </Button>
          </>
        )}
      </div>

      {confirmWithoutPlant && (
        <BottomSheet
          id={`${groupId}-plant-warning`}
          open
          variant="modal"
          className="employees-modal employees-modal--compact"
          title="Sin planta asignada"
          busy={busy}
          onClose={() => setConfirmWithoutPlant(false)}
        >
          <div className="employee-editor-form">
            <p className="employee-editor-fields text-sm text-muted">
              {creation && !partial
                ? "Este empleado tiene el rol Producción, pero no tiene una planta asignada. Podrás completar esta configuración posteriormente."
                : "El empleado conserva el rol Producción, pero no tendrá una planta asignada."}
            </p>
            <div className="employee-modal-footer">
              <Button
                size="sm"
                variant="secondary"
                data-dialog-initial-focus
                disabled={busy}
                onClick={() => setConfirmWithoutPlant(false)}
              >
                {creation && !partial ? "Volver y asignar planta" : "Volver y seleccionar planta"}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void submit(true)}>
                {creation && !partial ? "Crear de todas formas" : "Guardar de todas formas"}
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
