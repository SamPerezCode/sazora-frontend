import { z } from "zod";
import { membershipIdSchema } from "./employee.schema";
import type { BusinessLocation } from "../../business/schemas/organization.schema";

export const employeeLocationAccessSchema = z.object({
  employeeMembershipId: membershipIdSchema,
  hasGlobalLocationAccess: z.boolean(),
  defaultLocationId: membershipIdSchema.nullable(),
  assignments: z.array(
    z.object({
      locationId: membershipIdSchema,
      code: z.string(),
      name: z.string(),
      locationType: z.enum(["POINT_OF_SALE", "PRODUCTION_WAREHOUSE"]),
      isDefault: z.boolean(),
      assignedAt: z.iso.datetime({ offset: true }),
    })
  ),
});

export const employeeLocationResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    locationAccess: employeeLocationAccessSchema,
  }),
});

export const employeeAssignmentsSchema = z
  .array(
    z.object({
      locationId: membershipIdSchema,
      isDefault: z.boolean(),
    })
  )
  .superRefine((assignments, context) => {
    const ids = assignments.map((item) => item.locationId);

    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "No puedes repetir ubicaciones.",
      });
    }

    if (
      assignments.length > 0 &&
      assignments.filter((item) => item.isDefault).length !== 1
    ) {
      context.addIssue({
        code: "custom",
        message: "Selecciona una ubicación predeterminada.",
      });
    }
  });

export type EmployeeLocationAccess = z.infer<
  typeof employeeLocationAccessSchema
>;

export type EmployeeAssignment = z.infer<
  typeof employeeAssignmentsSchema
>[number];

export function normalizeEmployeeAssignments(
  selectedIds: readonly string[],
  defaultId: string | null,
  locations: readonly BusinessLocation[]
): EmployeeAssignment[] {
  const activeIds = new Set(
    locations.filter((item) => item.isActive).map((item) => item.id)
  );

  const ids = [
    ...new Set(selectedIds.map((value) => value.trim())),
  ].filter((id) => activeIds.has(id));

  return employeeAssignmentsSchema.parse(
    ids.map((locationId) => ({
      locationId,
      isDefault: locationId === defaultId,
    }))
  );
}

export const employeeLocationTypeLabels = {
  POINT_OF_SALE: "Punto de venta",
  PRODUCTION_WAREHOUSE: "Planta de producción",
} as const;
