import { useId, useState } from "react";
import {
  CircleCheck,
  CircleSlash,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { ROLE_LABELS } from "../../../app/navigation";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { employeePermissions } from "../schemas/employee.schema";
import type { Employee } from "../schemas/employee.schema";

interface Props {
  employees: readonly Employee[];
  ownMembershipId: string;
  disabled: boolean;
  onCreate: () => void;
  onEdit: (kind: "edit" | "roles", employee: Employee) => void;
  onToggle: (employee: Employee) => void;
}

function EmployeeStatus({ employee }: { employee: Employee }) {
  const Icon = employee.membershipIsActive
    ? CircleCheck
    : CircleSlash;

  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5 text-xs text-heading">
        <Icon
          aria-hidden="true"
          size={14}
          className={
            employee.membershipIsActive ? "text-accent" : "text-muted"
          }
        />
        {employee.membershipIsActive ? "Activo" : "Inactivo"}
      </span>

      {!employee.isActive && (
        <p className="text-xs text-danger">Cuenta global inactiva</p>
      )}
    </div>
  );
}

function Roles({ employee }: { employee: Employee }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {employee.roles.map((role) => (
        <span
          key={role}
          className="rounded-lg bg-secondary px-2 py-1 text-[0.6875rem] text-heading"
        >
          {ROLE_LABELS[role]}
        </span>
      ))}
    </div>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function lastLogin(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Sin ingresos";
}

export function EmployeeList({
  employees,
  ownMembershipId,
  disabled,
  onCreate,
  onEdit,
  onToggle,
}: Props) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listId = useId();
  const summaryId = useId();

  const words = normalize(query).trim().split(/\s+/).filter(Boolean);

  const filtered = employees.filter((employee) => {
    const text = normalize(
      [
        employee.fullName,
        employee.email,
        ...employee.roles.map((role) => ROLE_LABELS[role]),
      ].join(" ")
    );

    return (
      (!roleFilter ||
        employee.roles.some((role) => role === roleFilter)) &&
      words.every((word) => text.includes(word))
    );
  });

  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(filtered.length / pageSize))
  );

  const visible = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  function actions(employee: Employee) {
    const allowed = employeePermissions(employee, ownMembershipId);

    const entries = [
      ...(allowed.edit
        ? [
            {
              id: "edit",
              label: "Editar datos",
              icon: <Pencil aria-hidden="true" size={16} />,
              onSelect: () => onEdit("edit", employee),
            },
          ]
        : []),

      ...(allowed.roles
        ? [
            {
              id: "roles",
              label: "Cambiar roles",
              icon: <ShieldCheck aria-hidden="true" size={16} />,
              onSelect: () => onEdit("roles", employee),
            },
          ]
        : []),

      ...(allowed.status
        ? [
            {
              id: "status",
              label: employee.membershipIsActive
                ? "Desactivar"
                : "Activar",
              icon: employee.membershipIsActive ? (
                <ToggleRight aria-hidden="true" size={20} />
              ) : (
                <ToggleLeft aria-hidden="true" size={20} />
              ),
              onSelect: () => onToggle(employee),
            },
          ]
        : []),
    ];

    return entries.length ? (
      <ActionMenu
        label={"Acciones de " + employee.fullName}
        disabled={disabled}
        actions={entries}
      />
    ) : (
      <span
        className="text-xs text-muted"
        aria-label="Sin acciones disponibles"
      >
        —
      </span>
    );
  }

  function identity(employee: Employee) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={employee.fullName} size="sm" />

        <div className="min-w-0">
          <p className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
            {employee.fullName}

            {employee.membershipId === ownMembershipId && (
              <span className="ml-2 text-xs font-normal text-muted">
                (Tú)
              </span>
            )}
          </p>

          <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
            {employee.email}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,15rem)_minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <TextField
            type="search"
            label="Buscar empleados"
            placeholder="Nombre, correo o rol"
            icon={Search}
            value={query}
            aria-controls={listId}
            aria-describedby={summaryId}
            onChange={(event) => {
              setQuery(event.target.value);
              setRequestedPage(1);
            }}
          />
        </div>

        <SelectField
          label="Filtrar por rol"
          value={roleFilter}
          describedBy={summaryId}
          options={[
            { value: "", label: "Todos los roles" },
            ...Object.entries(ROLE_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          onValueChange={(value) => {
            setRoleFilter(value);
            setRequestedPage(1);
          }}
        />

        <Button
          size="sm"
          className="justify-self-end whitespace-nowrap lg:col-start-4"
          disabled={disabled}
          onClick={onCreate}
        >
          <Plus aria-hidden="true" size={16} />
          Nuevo empleado
        </Button>
      </div>

      <div
        id={listId}
        className="rounded-xl border border-outline/60 bg-surface/50"
      >
        {!visible.length ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {employees.length
              ? "No encontramos empleados con estos filtros."
              : "No hay empleados registrados."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl lg:block">
              <table className="w-full table-fixed text-left">
                <caption className="sr-only">
                  Empleados del negocio
                </caption>

                <colgroup>
                  <col className="w-[30%]" />
                  <col />
                  <col className="w-36" />
                  <col className="w-36" />
                  <col className="w-24" />
                </colgroup>

                <thead className="border-b border-outline/60 bg-secondary/30">
                  <tr>
                    {[
                      "Empleado",
                      "Roles",
                      "Acceso al negocio",
                      "Último ingreso",
                      "Acciones",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-4 py-3 text-[0.6875rem] font-medium uppercase text-muted"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline/40">
                  {visible.map((employee) => (
                    <tr
                      key={employee.membershipId}
                      className="hover:bg-secondary/30"
                    >
                      <th
                        scope="row"
                        className="px-4 py-4 font-normal"
                      >
                        {identity(employee)}
                      </th>

                      <td className="px-4 py-4">
                        <Roles employee={employee} />
                      </td>

                      <td className="px-4 py-4">
                        <EmployeeStatus employee={employee} />
                      </td>

                      <td className="px-4 py-4 text-xs text-muted">
                        {lastLogin(employee.lastLoginAt)}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          {actions(employee)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-outline/40 px-3 lg:hidden">
              {visible.map((employee) => (
                <li
                  key={employee.membershipId}
                  className="space-y-3 py-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    {identity(employee)}
                    {actions(employee)}
                  </div>

                  <Roles employee={employee} />

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="mb-1 text-[0.625rem] uppercase text-muted">
                        Acceso al negocio
                      </p>
                      <EmployeeStatus employee={employee} />
                    </div>

                    <p className="text-xs text-muted">
                      Último ingreso:{" "}
                      {lastLogin(employee.lastLoginAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p
        id={summaryId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-center text-xs text-muted sm:text-left"
      >
        {words.length || roleFilter
          ? filtered.length + " resultados · "
          : ""}
        Total: {employees.length}{" "}
        {employees.length === 1 ? "empleado" : "empleados"}
      </p>

      {employees.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={filtered.length === 1 ? "empleado" : "empleados"}
          controlsId={listId}
          disabled={disabled}
          onPageChange={setRequestedPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setRequestedPage(1);
          }}
        />
      )}
    </div>
  );
}
