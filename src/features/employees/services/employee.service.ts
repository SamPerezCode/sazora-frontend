import { request } from "../../../lib/http/client";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  employeeRolesSchema,
  employeeListResponseSchema,
  employeeResponseSchema,
  membershipIdSchema,
} from "../schemas/employee.schema";
import type { EmployeeAction } from "../schemas/employee.schema";

export async function getEmployees(
  accessToken: string,
  signal: AbortSignal
) {
  const response = await request(
    "/employees",
    employeeListResponseSchema,
    { accessToken, signal }
  );

  return response.data.employees;
}

export async function saveEmployee(
  action: EmployeeAction,
  accessToken: string,
  signal: AbortSignal
) {
  let path = "/employees";
  let method: "POST" | "PATCH" | "PUT";
  let body: unknown;

  if (action.kind === "create") {
    method = "POST";
    body = employeeCreateSchema.parse(action.input);
  } else {
    path += "/" + membershipIdSchema.parse(action.membershipId);

    if (action.kind === "roles") {
      path += "/roles";
      method = "PUT";
      body = {
        roles: employeeRolesSchema.parse(action.roles),
      };
    } else if (action.kind === "status") {
      path += "/status";
      method = "PATCH";
      body = { isActive: action.isActive };
    } else {
      method = "PATCH";
      body = employeeUpdateSchema.parse(action.input);
    }
  }

  const response = await request(path, employeeResponseSchema, {
    method,
    body,
    accessToken,
    signal,
  });

  return response.data.employee;
}
