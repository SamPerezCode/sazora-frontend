import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { ROLE_PRESENTATION } from "../../auth/role-presentation";
import { employeeErrorMessage } from "../utils/employee-errors";
import { Alert } from "../../../components/feedback/Alert";
import { Checkbox } from "../../../components/forms/Checkbox";
import { PasswordField } from "../../../components/forms/PasswordField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/http/client";
import {
  assignableRoles,
  employeeCreateSchema,
  employeeIdentitySchema,
  employeeRolesSchema,
} from "../schemas/employee.schema";
import type {
  AssignableRole,
  EmployeeAction,
  EmployeeEditor,
} from "../schemas/employee.schema";

interface Props {
  editor: EmployeeEditor;
  busy: boolean;
  onSave: (action: EmployeeAction) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export function EmployeeForm({
  editor,
  busy,
  onSave,
  onCancel,
  submitLabel,
  onDirtyChange,
}: Props) {
  const employee =
    editor.kind === "create" ? undefined : editor.employee;

  const [draft, setDraft] = useState({
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    password: "",
    passwordConfirmation: "",
  });

  const [roles, setRoles] = useState<AssignableRole[]>(
    () =>
      employee?.roles.filter(
        (role): role is AssignableRole => role !== "ADMIN"
      ) ?? []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const rolesErrorId = useId();
  const alive = useRef(false);
  const saving = useRef(false);

  const dirty =
    editor.kind === "create"
      ? Object.values(draft).some((value) => value.length > 0) || roles.length > 0
      : editor.kind === "roles"
        ? [...roles].sort().join("|") !==
          [...editor.employee.roles].sort().join("|")
        : draft.fullName !== editor.employee.fullName ||
          draft.email !== editor.employee.email;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function change(key: keyof typeof draft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setMessage("");
  }

  async function submit(form: HTMLFormElement) {
    if (busy || saving.current) return;

    setErrors({});
    setMessage("");
    saving.current = true;

    try {
      let action: EmployeeAction;

      if (editor.kind === "create") {
        action = {
          kind: "create",
          input: employeeCreateSchema.parse({ ...draft, roles }),
        };
      } else if (editor.kind === "roles") {
        const values = z
          .object({ roles: employeeRolesSchema })
          .parse({ roles });

        const unchanged =
          values.roles.length === editor.employee.roles.length &&
          values.roles.every((role) =>
            editor.employee.roles.includes(role)
          );

        if (unchanged) {
          onCancel();
          return;
        }

        action = {
          kind: "roles",
          membershipId: editor.employee.membershipId,
          roles: values.roles,
        };
      } else {
        const values = employeeIdentitySchema.parse(draft);
        const input: { fullName?: string; email?: string } = {};

        if (values.fullName !== editor.employee.fullName) {
          input.fullName = values.fullName;
        }

        if (values.email !== editor.employee.email) {
          input.email = values.email;
        }

        if (!Object.keys(input).length) {
          onCancel();
          return;
        }

        action = {
          kind: "edit",
          membershipId: editor.employee.membershipId,
          input,
        };
      }

      await onSave(action);
    } catch (error: unknown) {
      if (!alive.current) return;

      const next: Record<string, string> = {};

      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          next[String(issue.path[0])] ??= issue.message;
        }
      } else {
        if (error instanceof ApiError) {
          for (const issue of error.errors) {
            const field = issue.field.startsWith("roles")
              ? "roles"
              : issue.field;

            next[field] ??= issue.message;
          }

          if (error.code === "EMPLOYEE_EMAIL_CONFLICT") {
            next.email = error.message;
          }

          if (error.code === "EMPLOYEE_ROLE_NOT_AVAILABLE") {
            next.roles = employeeErrorMessage(error, "");
          } else if (
            error.code === "VALIDATION_ERROR" &&
            editor.kind === "roles" &&
            !next.roles
          ) {
            next.roles = error.message;
          }
        }

        setMessage(
          employeeErrorMessage(error, "No pudimos guardar el empleado.")
        );
      }

      setErrors(next);

      requestAnimationFrame(() => {
        if (form.isConnected) {
          form
            .querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus();
        }
      });
    } finally {
      saving.current = false;
    }
  }

  return (
    <form
      noValidate
      className="employee-editor-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <fieldset
        disabled={busy}
        className="employee-editor-fields min-w-0 space-y-4"
      >
        <legend className="sr-only">Datos del empleado</legend>

        {editor.kind !== "create" && (
          <p className="text-sm text-muted">
            {editor.kind === "roles"
              ? "Los roles definen qué puede hacer " +
                editor.employee.fullName +
                "."
              : "Solo se modifican el nombre y el correo."}
          </p>
        )}

        {editor.kind !== "roles" && (
          <>
            <TextField
              name="fullName"
              label="Nombre completo"
              placeholder="Ej. Carlos Pérez"
              required
              maxLength={150}
              data-dialog-initial-focus
              autoComplete="name"
              value={draft.fullName}
              error={errors.fullName}
              onChange={(event) =>
                change("fullName", event.target.value)
              }
            />

            <TextField
              name="email"
              label="Correo electrónico"
              placeholder="Ej. carlos@restaurante.com"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={draft.email}
              error={errors.email}
              onChange={(event) =>
                change("email", event.target.value)
              }
            />
          </>
        )}

        {editor.kind === "create" && (
          <>
            <PasswordField
              name="password"
              label="Contraseña inicial"
              placeholder="Mínimo 12 caracteres"
              required
              autoComplete="new-password"
              disabled={busy}
              value={draft.password}
              error={errors.password}
              onChange={(event) =>
                change("password", event.target.value)
              }
            />

            <PasswordField
              name="passwordConfirmation"
              label="Confirmar contraseña"
              placeholder="Repite la contraseña"
              required
              autoComplete="new-password"
              disabled={busy}
              value={draft.passwordConfirmation}
              error={errors.passwordConfirmation}
              onChange={(event) =>
                change("passwordConfirmation", event.target.value)
              }
            />

            <p className="text-xs text-muted">
              Usa al menos 12 caracteres. Los caracteres especiales
              pueden ocupar más de un byte; el máximo es 72 bytes.
            </p>
          </>
        )}

        {editor.kind !== "edit" && (
          <fieldset className="employee-role-options min-w-0 space-y-2">
            <legend
              className={
                editor.kind === "roles"
                  ? "sr-only"
                  : "mb-2 text-sm font-semibold text-heading"
              }
            >
              Roles asignados
            </legend>

            {editor.kind === "create" && (
              <p className="text-xs text-muted">
                Selecciona una o varias funciones.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {assignableRoles.map((role, index) => {
                const presentation = ROLE_PRESENTATION[role];
                const Icon = presentation.icon;
                return (
                <div
                  key={role}
                  className="rounded-2xl border border-outline px-3 py-2"
                >
                  <Checkbox
                    name="roles"
                    value={role}
                    className="w-full [--checkbox-size:1.125rem] [--checkbox-gap:0.5rem]"
                    data-dialog-initial-focus={
                      editor.kind === "roles" && index === 0
                        ? true
                        : undefined
                    }
                    label={
                      <span className="min-w-0 text-xs font-semibold text-heading sm:text-sm">
                        <span className="flex items-center gap-1.5">
                          <Icon aria-hidden="true" size={16} className="shrink-0" />
                          {presentation.label}
                        </span>
                        {role === "PRODUCTION" && (
                          <span className="mt-1 block text-xs font-normal text-muted">
                            {presentation.description}
                          </span>
                        )}
                      </span>
                    }
                    checked={roles.includes(role)}
                    disabled={busy}
                    aria-invalid={!!errors.roles}
                    aria-describedby={
                      errors.roles ? rolesErrorId : undefined
                    }
                    onChange={(event) => {
                      const checked = event.target.checked;

                      setRoles((previous) =>
                        checked
                          ? [...previous, role]
                          : previous.filter((value) => value !== role)
                      );

                      setErrors((previous) => ({
                        ...previous,
                        roles: "",
                      }));

                      setMessage("");
                    }}
                  />
                </div>
                );
              })}
            </div>

            <p className="text-xs text-muted">
              Cocina atiende comandas y pedidos. Producción trabaja con procesos de planta
              y productos destinados a inventario o despacho.
            </p>

            {editor.kind === "roles" && roles.includes("PRODUCTION") && (
              <p role="status" className="rounded-xl border border-outline bg-secondary/30 p-3 text-sm text-heading">
                Después de guardar, verifica que el empleado tenga acceso a una planta de producción.
              </p>
            )}

            {errors.roles && (
              <p id={rolesErrorId} className="text-xs text-danger">
                {errors.roles}
              </p>
            )}
          </fieldset>
        )}
      </fieldset>

      {message && <Alert>{message}</Alert>}

      <div className="employee-modal-footer">
        <Button
          size="sm"
          variant="secondary"
          className="employee-cancel"
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
          {submitLabel ??
            (editor.kind === "create"
              ? "Crear empleado"
              : editor.kind === "roles"
                ? "Guardar roles"
                : "Guardar datos")}
        </Button>
      </div>
    </form>
  );
}
