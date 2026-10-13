import { ApiError } from "../../../lib/http/client";

export function employeeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;

  if (error.code === "EMPLOYEE_ROLE_NOT_AVAILABLE") {
    return "El rol seleccionado no está disponible.";
  }
  if (error.code === "EMPLOYEE_NOT_FOUND") {
    return "El empleado ya no existe. Actualizamos el listado.";
  }
  if (error.status === 403) {
    return "No tienes permisos para administrar empleados.";
  }
  return error.message;
}
