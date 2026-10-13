import type { ReactNode } from "react";
import { UsersRound, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROLE_PRESENTATION } from "../../auth/role-presentation";
import { Avatar } from "../../../components/ui/Avatar";
import type { Employee } from "../schemas/employee.schema";

export function EmployeeRoles({
  roles,
}: {
  roles: Employee["roles"];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => {
        const { label, icon: Icon } = ROLE_PRESENTATION[role];
        return (
          <span
            key={role}
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-semibold leading-none " +
              (role === "ADMIN"
                ? "bg-accent/15 text-heading"
                : "bg-secondary text-heading")
            }
          >
            <Icon aria-hidden="true" size={12} className="shrink-0" />
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function EmployeeStatus({
  active,
  accountActive = true,
}: {
  active: boolean;
  accountActive?: boolean;
}) {
  return (
    <div className="space-y-1">
      <span
        className={
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.6875rem] font-semibold leading-none " +
          (active
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-secondary/50 text-muted")
        }
      >
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current"
        />
        {active ? "Activo" : "Inactivo"}
      </span>

      {!accountActive && (
        <p className="text-xs text-danger">Cuenta global inactiva</p>
      )}
    </div>
  );
}

export function EmployeeIdentity({
  name,
  email,
  own = false,
  roles,
}: {
  name: string;
  email: string;
  own?: boolean;
  roles?: Employee["roles"];
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        name={name}
        size="md"
        variant="profile"
        className="employee-avatar"
      />

      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
            {name}
          </span>

          {own && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold text-on-accent">
              Tú
            </span>
          )}
        </div>

        <p className="text-xs text-muted [overflow-wrap:anywhere]">
          {email}
        </p>

        {roles && <EmployeeRoles roles={roles} />}
      </div>
    </div>
  );
}

export function EmployeeViewState({
  kind,
  title,
  description,
  action,
  icon: EmptyIcon = UsersRound,
  rows = 4,
}: {
  kind: "loading" | "error" | "empty";
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  rows?: number;
}) {
  if (kind === "loading") {
    return (
      <div role="status" aria-label={title} className="space-y-3">
        <span className="sr-only">{title}</span>

        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-16 rounded-2xl bg-secondary/60 motion-safe:animate-pulse"
          />
        ))}
      </div>
    );
  }

  const Icon = kind === "error" ? WifiOff : EmptyIcon;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={
        "flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-8 text-center " +
        (kind === "error" ? "border-danger/40" : "border-outline")
      }
    >
      <Icon
        aria-hidden="true"
        size={30}
        className={kind === "error" ? "text-danger" : "text-muted"}
      />

      <h3 className="text-sm font-semibold text-heading">{title}</h3>

      {description && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}

      {action}
    </div>
  );
}
