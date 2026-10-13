import { useId, useState } from "react";
import {
  Building2,
  MapPin,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ROLE_LABELS } from "../../../app/navigation";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { employeePermissions } from "../schemas/employee.schema";
import type { Employee } from "../schemas/employee.schema";
import {
  EmployeeIdentity,
  EmployeeRoles,
  EmployeeStatus,
  EmployeeViewState,
} from "./EmployeeVisuals";

interface Props {
  employees: readonly Employee[];
  ownMembershipId: string;
  disabled: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onManageLocations: (employee: Employee) => void;
  onCreate: () => void;
  onEdit: (kind: "edit" | "roles", employee: Employee) => void;
  onToggle: (employee: Employee) => void;
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

function formatLocationName(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CO");

  return (
    normalized.charAt(0).toLocaleUpperCase("es-CO") +
    normalized.slice(1)
  );
}

export function EmployeeList({
  employees,
  ownMembershipId,
  disabled,
  loading,
  error,
  onRetry,
  onCreate,
  onEdit,
  onToggle,
  onManageLocations,
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

  const locked = disabled || loading || !!error;

  function locations(employee: Employee, showSummary = false) {
    const access = employee.locationAccess;

    const globalAccess =
      access?.hasGlobalAccess ?? employee.roles.includes("ADMIN");

    if (globalAccess) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-heading">
          <Building2
            aria-hidden="true"
            size={15}
            className="shrink-0 text-accent"
          />
          Acceso global
        </span>
      );
    }

    const manageButton = (
      <button
        type="button"
        disabled={locked}
        onClick={() => onManageLocations(employee)}
        aria-label={
          "Ver o asignar ubicaciones a " + employee.fullName
        }
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg text-xs text-muted underline-offset-4 hover:text-heading hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-6"
      >
        {!showSummary && <MapPin aria-hidden="true" size={15} />}
        Ver o asignar
      </button>
    );

    // No confundir un resumen ausente con cero ubicaciones.
    if (!showSummary || !access) {
      return manageButton;
    }

    const assigned = access.locations;

    const primary =
      assigned.find((item) => item.id === access.defaultLocationId) ??
      assigned.find((item) => item.isDefault) ??
      assigned[0];

    const additional = Math.max(0, assigned.length - 1);

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {primary ? (
          <span
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-semibold text-heading"
            title={assigned
              .map((item) => formatLocationName(item.name))
              .join(" · ")}
          >
            <MapPin
              aria-hidden="true"
              size={15}
              className="shrink-0 text-muted"
            />

            <span className="truncate">
              {formatLocationName(primary.name)}
            </span>

            {additional > 0 && (
              <span
                className="shrink-0"
                aria-label={additional + " ubicaciones adicionales"}
              >
                +{additional}
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-semibold leading-none text-amber-800 dark:text-amber-300">
            <TriangleAlert aria-hidden="true" size={12} />
            Sin ubicación
          </span>
        )}

        {manageButton}
      </div>
    );
  }

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

      ...(!employee.roles.includes("ADMIN")
        ? [
            {
              id: "locations",
              label: "Gestionar ubicaciones",
              icon: <MapPin aria-hidden="true" size={16} />,
              onSelect: () => onManageLocations(employee),
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
              icon: <Power aria-hidden="true" size={16} />,
              danger: employee.membershipIsActive,
              separatorBefore: true,
              onSelect: () => onToggle(employee),
            },
          ]
        : []),
    ];

    return entries.length ? (
      <ActionMenu
        appearance="compact"
        label={"Acciones de " + employee.fullName}
        disabled={locked}
        actions={entries}
      />
    ) : (
      <span
        aria-label="Sin acciones disponibles"
        className="text-muted"
      >
        —
      </span>
    );
  }

  function identity(employee: Employee) {
    return (
      <EmployeeIdentity
        name={employee.fullName}
        email={employee.email}
        own={employee.membershipId === ownMembershipId}
      />
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-outline bg-surface p-4 sm:p-5">
      <div className="employee-search">
        <TextField
          type="search"
          label="Buscar empleados"
          placeholder="Buscar por nombre, correo o rol"
          icon={Search}
          value={query}
          aria-controls={listId}
          aria-describedby={summaryId}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setRequestedPage(1);
          }}
        />
      </div>

      <SelectField
        label="Filtrar por rol"
        hideLabel
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

      <p id={summaryId} role="status" className="text-xs text-muted">
        {loading ? (
          "Consultando empleados…"
        ) : error ? (
          "Listado no disponible"
        ) : (
          <>
            {employees.length}{" "}
            {employees.length === 1 ? "empleado" : "empleados"}
            {(words.length > 0 || roleFilter) &&
              " · " + filtered.length + " resultados"}
          </>
        )}
      </p>

      <div id={listId} aria-busy={loading}>
        {loading ? (
          <EmployeeViewState
            kind="loading"
            title="Cargando empleados…"
          />
        ) : error ? (
          <EmployeeViewState
            kind="error"
            title="No pudimos cargar los empleados"
            description={error}
            action={
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RotateCcw aria-hidden="true" size={16} />
                Reintentar
              </Button>
            }
          />
        ) : employees.length === 0 ? (
          <EmployeeViewState
            kind="empty"
            title="Aún no hay empleados"
            action={
              <Button
                size="sm"
                disabled={disabled}
                onClick={onCreate}
              >
                <Plus aria-hidden="true" size={16} />
                Nuevo empleado
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmployeeViewState
            kind="empty"
            title="No encontramos empleados con estos filtros"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setRoleFilter("");
                  setRequestedPage(1);
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[52rem] table-fixed text-left text-sm">
                <caption className="sr-only">
                  Empleados del negocio
                </caption>

                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[21%]" />
                  <col className="w-[29%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                  <col className="w-[6%]" />
                </colgroup>

                <thead className="border-b border-outline">
                  <tr>
                    {[
                      "Empleado",
                      "Roles",
                      "Ubicaciones",
                      "Estado",
                      "Último ingreso",
                      "Acciones",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-3 py-3 text-[0.6875rem] font-semibold uppercase text-muted"
                      >
                        <span
                          className={
                            label === "Acciones"
                              ? "sr-only"
                              : undefined
                          }
                        >
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline/60">
                  {visible.map((employee) => (
                    <tr
                      key={employee.membershipId}
                      className={
                        employee.membershipIsActive
                          ? ""
                          : "opacity-65"
                      }
                    >
                      <th
                        scope="row"
                        className="px-3 py-4 font-normal"
                      >
                        {identity(employee)}
                      </th>

                      <td className="px-3 py-4">
                        <EmployeeRoles roles={employee.roles} />
                      </td>

                      <td className="px-3 py-4">
                        {locations(employee, true)}
                      </td>

                      <td className="px-3 py-4">
                        <EmployeeStatus
                          active={employee.membershipIsActive}
                          accountActive={employee.isActive}
                        />
                      </td>

                      <td className="px-3 py-4 text-xs text-muted">
                        {lastLogin(employee.lastLoginAt)}
                      </td>

                      <td className="py-3">
                        <div className="flex justify-end">
                          {actions(employee)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-outline lg:hidden">
              {visible.map((employee) => (
                <li
                  key={employee.membershipId}
                  className={
                    "space-y-3 py-4 " +
                    (employee.membershipIsActive ? "" : "opacity-65")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    {identity(employee)}
                    {actions(employee)}
                  </div>

                  <EmployeeRoles roles={employee.roles} />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {locations(employee)}
                    <EmployeeStatus
                      active={employee.membershipIsActive}
                      accountActive={employee.isActive}
                    />
                  </div>

                  <p className="text-xs text-muted">
                    Último ingreso: {lastLogin(employee.lastLoginAt)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!loading && !error && employees.length > 10 && (
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
