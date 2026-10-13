import { z } from "zod";
import { ApiError, request } from "../../../lib/http/client";
import {
  employeeAssignmentsSchema,
  employeeLocationResponseSchema,
} from "../schemas/employee-location.schema";
import type { EmployeeAssignment } from "../schemas/employee-location.schema";
import { membershipIdSchema } from "../schemas/employee.schema";

export async function getEmployeeLocations(
  employeeMembershipId: string,
  accessToken: string,
  signal: AbortSignal
) {
  const id = membershipIdSchema.parse(employeeMembershipId);

  const response = await request(
    `/employees/${id}/locations`,
    employeeLocationResponseSchema,
    { accessToken, signal }
  );

  const access = response.data.locationAccess;

  if (access.employeeMembershipId !== id) {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Las asignaciones recibidas no corresponden al empleado."
    );
  }

  return access;
}

export async function saveEmployeeLocations(
  employeeMembershipId: string,
  assignments: EmployeeAssignment[],
  accessToken: string,
  signal: AbortSignal
): Promise<void> {
  const id = membershipIdSchema.parse(employeeMembershipId);

  /*
   * El documento no especifica el cuerpo de respuesta del PUT.
   * Verificamos el estado HTTP sin inventar propiedades de respuesta.
   */
  await request(`/employees/${id}/locations`, z.unknown(), {
    method: "PUT",
    accessToken,
    signal,
    body: {
      assignments: employeeAssignmentsSchema.parse(assignments),
    },
  });
}
