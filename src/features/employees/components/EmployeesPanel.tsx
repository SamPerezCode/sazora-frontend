import { useEffect, useId, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import type {
  Employee,
  EmployeeAction,
  EmployeeEditor,
} from "../schemas/employee.schema";
import { useEmployees } from "../hooks/useEmployees";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeList } from "./EmployeeList";

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

  const [editor, setEditor] = useState<EmployeeEditor | null>(null);
  const [notice, setNotice] = useState({
    message: "",
    error: false,
  });

  const modalId = useId();
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice.message) return;

    const timer = window.setTimeout(() => {
      setNotice({ message: "", error: false });
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(action: EmployeeAction) {
    await resource.mutate(action);

    if (!alive.current) return;

    setEditor(null);
    setNotice({
      error: false,
      message:
        action.kind === "create"
          ? "Empleado creado."
          : action.kind === "roles"
            ? "Roles actualizados."
            : "Datos actualizados.",
    });
  }

  async function toggle(employee: Employee) {
    if (resource.busy || editor) return;

    setNotice({ message: "", error: false });

    try {
      const saved = await resource.mutate({
        kind: "status",
        membershipId: employee.membershipId,
        isActive: !employee.membershipIsActive,
      });

      if (alive.current) {
        setNotice({
          error: false,
          message: saved.membershipIsActive
            ? "Acceso al negocio activado."
            : "Acceso al negocio desactivado.",
        });
      }
    } catch (error: unknown) {
      if (alive.current) {
        setNotice({
          error: true,
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos cambiar el acceso.",
        });
      }
    }
  }

  return (
    <>
      <Card>
        <h2 className="flex items-center gap-2 text-base font-bold text-heading">
          <Users
            aria-hidden="true"
            size={18}
            className="text-accent"
          />
          Empleados y roles
        </h2>

        <p className="mt-1 text-xs leading-relaxed text-muted">
          Administra tu equipo y las funciones que realiza en el
          negocio.
        </p>

        {resource.loading ? (
          <div className="py-8">
            <LoadingState message="Cargando empleados…" />
          </div>
        ) : resource.error ? (
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
        ) : (
          <EmployeeList
            employees={resource.employees}
            ownMembershipId={session.membership.id}
            disabled={resource.busy || !!editor}
            onCreate={() => {
              setNotice({ message: "", error: false });
              setEditor({ kind: "create" });
            }}
            onEdit={(kind, employee) => {
              setNotice({ message: "", error: false });
              setEditor({ kind, employee });
            }}
            onToggle={(employee) => {
              void toggle(employee);
            }}
          />
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Desactivar un empleado bloquea su acceso a este negocio y
          conserva su historial. Una cuenta global inactiva no puede
          iniciar sesión aunque su membresía esté activa.
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
            editor.kind === "create"
              ? "Nuevo empleado"
              : editor.kind === "roles"
                ? "Roles de " + editor.employee.fullName
                : "Editar empleado"
          }
          onClose={() => setEditor(null)}
        >
          <EmployeeForm
            key={
              editor.kind === "create"
                ? "create"
                : editor.kind + ":" + editor.employee.membershipId
            }
            editor={editor}
            busy={resource.busy}
            onSave={save}
            onCancel={() => setEditor(null)}
          />
        </BottomSheet>
      )}
    </>
  );
}
