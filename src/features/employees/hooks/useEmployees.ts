import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "../../auth/types/auth.types";
import { ApiError } from "../../../lib/http/client";
import { employeePermissions } from "../schemas/employee.schema";
import type {
  Employee,
  EmployeeAction,
} from "../schemas/employee.schema";
import {
  getEmployees,
  saveEmployee,
} from "../services/employee.service";

interface Snapshot {
  scope: string;
  attempt: number;
  employees: Employee[];
  error: string | null;
}

function sortEmployees(employees: Employee[]) {
  return [...employees].sort(
    (a, b) =>
      a.fullName.localeCompare(b.fullName, "es", {
        sensitivity: "base",
      }) || a.userId.localeCompare(b.userId, "es", { numeric: true })
  );
}

export function useEmployees(session: AuthSession) {
  const { accessToken, business, membership } = session;
  const businessId = business.id;
  const allowed = session.authorization.roles.includes("ADMIN");
  const scope = [businessId, membership.id, accessToken].join(":");

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingScope, setPendingScope] = useState<string | null>(
    null
  );

  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!allowed) return;

    const controller = new AbortController();
    read.current = controller;

    void getEmployees(accessToken, controller.signal)
      .then((employees) => {
        if (
          employees.some(
            (employee) => employee.businessId !== businessId
          )
        ) {
          throw new Error("Respuesta de otro negocio.");
        }

        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            employees: sortEmployees(employees),
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            scope,
            attempt,
            employees: [],
            error:
              error instanceof ApiError
                ? error.message
                : "No pudimos cargar los empleados.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, businessId, allowed, scope, attempt]);

  useEffect(
    () => () => {
      write.current?.abort();
      write.current = null;
    },
    [scope, allowed]
  );

  const current =
    snapshot?.scope === scope && snapshot.attempt === attempt
      ? snapshot
      : null;

  async function mutate(action: EmployeeAction) {
    if (!allowed || !current || current.error) {
      throw new Error("No puedes guardar empleados en este momento.");
    }

    if (write.current) {
      throw new Error("Espera a que termine el guardado.");
    }

    if (action.kind !== "create") {
      const target = current.employees.find(
        (employee) => employee.membershipId === action.membershipId
      );

      if (
        !target ||
        !employeePermissions(target, membership.id)[action.kind]
      ) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Esta acción no está permitida."
        );
      }
    }

    read.current?.abort();

    const controller = new AbortController();
    write.current = controller;
    setPendingScope(scope);

    try {
      const employee = await saveEmployee(
        action,
        accessToken,
        controller.signal
      );

      controller.signal.throwIfAborted();

      if (
        employee.businessId !== businessId ||
        (action.kind !== "create" &&
          employee.membershipId !== action.membershipId)
      ) {
        throw new Error("No pudimos verificar el empleado guardado.");
      }

      setSnapshot((previous) => ({
        scope,
        attempt,
        error: null,
        employees: sortEmployees([
          ...(previous?.scope === scope
            ? previous.employees
            : []
          ).filter(
            (item) => item.membershipId !== employee.membershipId
          ),
          employee,
        ]),
      }));

      return employee;
    } finally {
      if (write.current === controller) {
        write.current = null;
        setPendingScope(null);
      }
    }
  }

  return {
    employees: allowed ? (current?.employees ?? []) : [],
    loading: allowed && !current,
    error: allowed
      ? (current?.error ?? null)
      : "No tienes acceso a los empleados.",
    busy: pendingScope === scope,
    mutate,
    retry: () => {
      if (!write.current) {
        setAttempt((value) => value + 1);
      }
    },
  };
}
