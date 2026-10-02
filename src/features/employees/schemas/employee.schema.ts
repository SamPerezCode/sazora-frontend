import { z } from "zod";
import { roleSchema } from "../../auth/schemas/auth.schema";

export const membershipIdSchema = z.string().regex(/^[1-9]\d*$/);

export const assignableRoleSchema = roleSchema.exclude(["ADMIN"]);
export const assignableRoles = assignableRoleSchema.options;

export const employeeSchema = z.object({
  userId: membershipIdSchema,
  membershipId: membershipIdSchema,
  businessId: membershipIdSchema,
  fullName: z.string(),
  email: z.string(),
  isActive: z.boolean(),
  membershipIsActive: z.boolean(),
  roles: z.array(roleSchema),
  lastLoginAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const employeeListResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    employees: z.array(employeeSchema),
  }),
});

export const employeeResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    employee: employeeSchema,
  }),
});

export const employeeIdentitySchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre.")
    .max(150, "Máximo 150 caracteres."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Escribe un correo válido.")
    .max(254, "Máximo 254 caracteres."),
});

export const employeeRolesSchema = z
  .array(assignableRoleSchema)
  .transform((roles) => [...new Set(roles)])
  .pipe(
    z
      .array(assignableRoleSchema)
      .min(1, "Selecciona al menos un rol.")
      .max(4, "Puedes asignar hasta cuatro roles.")
  );

export const employeeCreateSchema = employeeIdentitySchema
  .extend({
    password: z
      .string()
      .min(12, "Usa al menos 12 caracteres.")
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "La contraseña no puede superar 72 bytes."
      ),
    passwordConfirmation: z.string(),
    roles: employeeRolesSchema,
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });

export const employeeUpdateSchema = employeeIdentitySchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "No hay cambios para guardar."
  );

export type Employee = z.infer<typeof employeeSchema>;
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export type EmployeeEditor =
  | { kind: "create" }
  | { kind: "edit" | "roles"; employee: Employee };

export type EmployeeAction =
  | {
      kind: "create";
      input: z.output<typeof employeeCreateSchema>;
    }
  | {
      kind: "edit";
      membershipId: string;
      input: z.output<typeof employeeUpdateSchema>;
    }
  | {
      kind: "roles";
      membershipId: string;
      roles: AssignableRole[];
    }
  | {
      kind: "status";
      membershipId: string;
      isActive: boolean;
    };

export function employeePermissions(
  employee: Employee,
  ownMembershipId: string
) {
  const self = employee.membershipId === ownMembershipId;
  const admin = employee.roles.includes("ADMIN");

  return {
    edit: !admin,
    roles: !admin && !self,
    status: !self,
  };
}
