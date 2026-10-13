import { useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import {
  DiscardChangesDialog,
  UnsavedChangesGuard,
} from "../../../components/feedback/UnsavedChangesGuard";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type {
  Employee,
  EmployeeAction,
} from "../schemas/employee.schema";
import { useEmployees } from "../hooks/useEmployees";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeList } from "./EmployeeList";
import { EmployeeLocationsForm } from "./EmployeeLocationsForm";
import { employeeErrorMessage } from "../utils/employee-errors";

type CreateAction = Extract<EmployeeAction, { kind: "create" }>;

type Modal =
  | { kind: "create" }
  | { kind: "edit"; employee: Employee }
  | { kind: "roles"; employee: Employee }
  | { kind: "locations"; employee: Employee }
  | { kind: "status"; employee: Employee };

export function EmployeesPanel() {
  const { session } = useAppShell();

  return (
    <EmployeesContent
      session={session}
      key={[
        session.business.id,
        session.membership.id,
        session.accessToken,
      ].join(":")}
    />
  );
}

function EmployeesContent({ session }: { session: AuthSession }) {
  const resource = useEmployees(session);
  const modalId = useId();

  const [modal, setModal] = useState<Modal | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [creation, setCreation] = useState<CreateAction | null>(null);
  const [createdEmployee, setCreatedEmployee] =
    useState<Employee | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationDirty, setLocationDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [statusError, setStatusError] = useTimedMessage();

  const [notice, setNotice] = useState({
    message: "",
    error: false,
  });
  const [editorDirty, setEditorDirty] = useState(false);

  const isLoadingEmployees = resource.loading;
  const isUpdatingEmployee = resource.busy && modal?.kind === "edit";
  const isUpdatingRoles = resource.busy && modal?.kind === "roles";
  const isUpdatingStatus = resource.busy && modal?.kind === "status";

  const busy =
    resource.busy ||
    locationBusy ||
    isUpdatingEmployee ||
    isUpdatingRoles ||
    isUpdatingStatus;

  useEffect(() => {
    if (!notice.message) return;

    const timer = window.setTimeout(() => {
      setNotice({ message: "", error: false });
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  function clearModal() {
    setModal(null);
    setStep(1);
    setCreation(null);
    setCreatedEmployee(null);
    setLocationBusy(false);
    setLocationDirty(false);
    setDiscard(false);
    setStatusError("");
    setEditorDirty(false);
  }

  function finishLater() {
    clearModal();
    resource.retry();

    setNotice({
      error: true,
      message:
        "El empleado fue creado, pero no fue posible guardar sus ubicaciones. " +
        "Puedes configurarlas desde Gestionar ubicaciones.",
    });
  }

  function close() {
    if (busy) return;

    if (createdEmployee) {
      finishLater();
      return;
    }

    if (editorDirty || locationDirty) {
      setDiscard(true);
      return;
    }

    clearModal();
  }

  function unavailable(
    message = "Actualizamos el listado. Revisa el estado del empleado antes de continuar."
  ) {
    clearModal();
    resource.retry();
    setNotice({
      error: true,
      message,
    });
  }

  function open(next: Modal) {
    setNotice({ message: "", error: false });
    setStatusError("");
    setModal(next);
  }

  async function save(action: EmployeeAction) {
    try {
      await resource.mutate(action);

      clearModal();
      setNotice({
        error: false,
        message:
          action.kind === "roles"
            ? "Roles actualizados."
            : "Datos actualizados.",
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "EMPLOYEE_NOT_FOUND"
      ) {
        unavailable(employeeErrorMessage(error, ""));
      }

      throw error;
    }
  }

  async function create(action: CreateAction) {
    const employee = await resource.mutate(action);
    setCreatedEmployee(employee);
    return employee;
  }

  async function updateStatus() {
    if (modal?.kind !== "status" || busy) return;

    const employee = modal.employee;

    if (employee.membershipId === session.membership.id) return;

    setStatusError("");

    try {
      const saved = await resource.mutate({
        kind: "status",
        membershipId: employee.membershipId,
        isActive: !employee.membershipIsActive,
      });

      clearModal();
      setNotice({
        error: false,
        message: saved.membershipIsActive
          ? "Acceso al negocio activado."
          : "Acceso al negocio desactivado.",
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "EMPLOYEE_NOT_FOUND"
      ) {
        unavailable(employeeErrorMessage(error, ""));
        return;
      }

      setStatusError(
        employeeErrorMessage(error, "No pudimos cambiar el acceso.")
      );
    }
  }

  const title = !modal
    ? ""
    : modal.kind === "create"
      ? "Nuevo empleado"
      : modal.kind === "locations"
        ? "Ubicaciones de " + modal.employee.fullName
        : modal.kind === "roles"
          ? "Cambiar roles"
          : modal.kind === "status"
            ? modal.employee.membershipIsActive
              ? "Desactivar empleado"
              : "Activar empleado"
            : "Editar datos personales";

  return (
    <>
      <UnsavedChangesGuard
        dirty={!!modal && (editorDirty || locationDirty)}
        busy={busy}
      />

      <section className="employees-workspace space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-heading">
              Empleados y roles
            </h2>

            <p className="mt-1 text-sm text-muted">
              Los roles determinan qué puede hacer cada persona. Las
              ubicaciones determinan dónde puede hacerlo.
            </p>
          </div>

          <Button
            size="sm"
            disabled={
              busy || !!modal || resource.loading || !!resource.error
            }
            onClick={() => open({ kind: "create" })}
          >
            <Plus aria-hidden="true" size={16} />
            Nuevo empleado
          </Button>
        </header>

        <EmployeeList
          employees={resource.employees}
          ownMembershipId={session.membership.id}
          disabled={busy || !!modal}
          loading={isLoadingEmployees}
          error={resource.error}
          onRetry={resource.retry}
          onCreate={() => open({ kind: "create" })}
          onEdit={(kind, employee) => open({ kind, employee })}
          onManageLocations={(employee) => {
            if (!employee.roles.includes("ADMIN")) {
              open({ kind: "locations", employee });
            }
          }}
          onToggle={(employee) => {
            if (employee.membershipId !== session.membership.id) {
              open({ kind: "status", employee });
            }
          }}
        />

        <p className="text-xs text-muted">
          Desactivar un empleado bloquea su acceso a este negocio y
          conserva su historial. Una cuenta global inactiva no puede
          iniciar sesión aunque su acceso al negocio esté activo.
        </p>
      </section>

      {notice.message && (
        <div className="fixed inset-x-4 bottom-24 z-40 md:left-auto md:bottom-6 md:w-96">
          <Alert variant={notice.error ? "error" : "success"}>
            {notice.message}
          </Alert>
        </div>
      )}

      {modal && (
        <BottomSheet
          id={modalId}
          open
          variant="modal"
          className={
            modal.kind === "create" || modal.kind === "locations"
              ? "employees-modal"
              : "employees-modal employees-modal--compact"
          }
          title={title}
          busy={busy}
          onClose={close}
        >
          {modal.kind === "create" && (
            <>
              <p
                role="status"
                className="mb-4 shrink-0 text-sm text-muted"
              >
                Paso {step} de 2 ·{" "}
                {step === 1 ? "Datos y funciones" : "Ubicaciones"}
              </p>

              {!createdEmployee && (
                <div
                  className={
                    step === 1
                      ? "flex min-h-0 flex-1 flex-col"
                      : "hidden"
                  }
                >
                  <EmployeeForm
                    editor={{ kind: "create" }}
                    busy={busy}
                    submitLabel="Continuar"
                    onCancel={close}
                    onDirtyChange={setEditorDirty}
                    onSave={async (action) => {
                      if (action.kind !== "create") return;
                      setCreation(action);
                      setStep(2);
                    }}
                  />
                </div>
              )}

              {creation && (
                <div
                  className={
                    step === 2
                      ? "flex min-h-0 flex-1 flex-col"
                      : "hidden"
                  }
                >
                  <EmployeeLocationsForm
                    session={session}
                    creation={creation}
                    onCreate={create}
                    onBack={() => setStep(1)}
                    onCancel={close}
                    onFinishLater={finishLater}
                    onUnavailable={unavailable}
                    onBusyChange={setLocationBusy}
                    onDirtyChange={setLocationDirty}
                    onSaved={() => {
                      clearModal();
                      resource.retry();

                      setNotice({
                        error: false,
                        message: "Empleado creado correctamente.",
                      });
                    }}
                  />
                </div>
              )}
            </>
          )}

          {(modal.kind === "edit" || modal.kind === "roles") && (
            <EmployeeForm
              editor={modal}
              busy={busy}
              onSave={save}
              onCancel={close}
              onDirtyChange={setEditorDirty}
            />
          )}

          {modal.kind === "locations" && (
            <EmployeeLocationsForm
              session={session}
              employee={modal.employee}
              onCancel={close}
              onFinishLater={close}
              onUnavailable={unavailable}
              onBusyChange={setLocationBusy}
              onDirtyChange={setLocationDirty}
              onSaved={() => {
                clearModal();
                resource.retry();

                setNotice({
                  error: false,
                  message: "Ubicaciones actualizadas correctamente.",
                });
              }}
            />
          )}

          {modal.kind === "status" && (
            <div className="employee-editor-form">
              <div className="employee-editor-fields space-y-4">
                <p className="text-sm text-muted">
                  {modal.employee.membershipIsActive
                    ? "Este empleado no podrá acceder a la aplicación, pero su historial se conservará."
                    : "Se habilitará nuevamente el acceso de este empleado al negocio."}
                </p>

                <p className="font-semibold">
                  {modal.employee.fullName}
                </p>

                {statusError && <Alert>{statusError}</Alert>}
              </div>

              <div className="employee-modal-footer grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={close}
                >
                  Cancelar
                </Button>

                <Button
                  size="sm"
                  variant={
                    modal.employee.membershipIsActive
                      ? "danger"
                      : "primary"
                  }
                  loading={isUpdatingStatus}
                  loadingText="Guardando…"
                  disabled={busy}
                  onClick={() => void updateStatus()}
                >
                  {modal.employee.membershipIsActive
                    ? "Desactivar"
                    : "Activar"}
                </Button>
              </div>
            </div>
          )}
        </BottomSheet>
      )}

      {discard && (
        <DiscardChangesDialog
          onCancel={() => setDiscard(false)}
          onDiscard={clearModal}
        />
      )}
    </>
  );
}
