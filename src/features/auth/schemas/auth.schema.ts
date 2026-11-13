import { z } from "zod";

export const roleSchema = z.enum([
  "ADMIN",
  "WAITER",
  "KITCHEN",
  "PUBLIC_ORDER_MANAGER",
  "DELIVERY_DRIVER",
  "PRODUCTION",
  "CASHIER",
  "INVENTORY_MANAGER",
]);

export const loginSchema = z.object({
  businessSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usa letras, números y guiones entre palabras."
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ingresa un correo electrónico válido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .refine(
      (password) => new TextEncoder().encode(password).length <= 72,
      "La contraseña no puede superar 72 bytes."
    ),
});

const identitySchema = z.object({
  user: z.object({
    id: z.string().min(1),
    fullName: z.string().min(1),
  }),
  business: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
});

// Los roles recibidos en autenticación pueden incluir códigos nuevos.
// El catálogo de roles administrables sigue usando roleSchema.
const sessionRolesSchema = z.array(z.string().trim().min(1)).min(1);
const permissionsSchema = z.array(z.string().trim().min(1));

export const authorizationModeSchema = z.enum([
  "SINGLE_ROLE",
  "ALL_ROLES",
]);

export const sessionLocationAccessSchema = z.object({
  hasGlobalAccess: z.boolean(),
  defaultLocationId: z.string().min(1).nullable(),
  locations: z.array(
    z.object({
      id: z.string().min(1),
      code: z.string(),
      name: z.string(),
      locationType: z.enum(["POINT_OF_SALE", "PRODUCTION_WAREHOUSE"]),
      isDefault: z.boolean(),
      isActive: z.boolean().optional(),
    })
  ),
});

export const directLoginSchema = identitySchema.extend({
  requiresRoleSelection: z.literal(false),
  authorizationMode: z.literal("SINGLE_ROLE"),
  accessToken: z.string().min(1),
  membership: z.object({
    id: z.string().min(1),
    roles: sessionRolesSchema,
    permissions: permissionsSchema,
  }),
  locationAccess: sessionLocationAccessSchema,
});

export const roleSelectionChallengeSchema = identitySchema.extend({
  requiresRoleSelection: z.literal(true),
  roleSelectionToken: z.string().min(1),
  roleSelectionExpiresInSeconds: z.number().int().positive(),
  membership: z.object({
    id: z.string().min(1),
    roles: sessionRolesSchema,
  }),
});

export const pendingRoleSelectionSchema =
  roleSelectionChallengeSchema.extend({
    expiresAt: z.number().int().positive(),
  });

export const roleChoiceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ALL_ROLES"),
  }),
  z.object({
    mode: z.literal("SINGLE_ROLE"),
    role: z.string().trim().min(1),
  }),
]);

export const selectRoleDataSchema = z.object({
  accessToken: z.string().min(1),
  authorizationMode: authorizationModeSchema,
  membership: z.object({
    id: z.string().min(1),
    assignedRoles: sessionRolesSchema,
    effectiveRoles: sessionRolesSchema,
    permissions: permissionsSchema,
  }),
  locationAccess: sessionLocationAccessSchema,
});

// Identidad persistida del acceso definitivo.
// Nunca se utiliza para almacenar el token temporal.
export const loginDataSchema = identitySchema.extend({
  accessToken: z.string().min(1),
  authorizationMode: authorizationModeSchema,
  membership: z.object({
    id: z.string().min(1),
    assignedRoles: sessionRolesSchema,
    roles: sessionRolesSchema,
    permissions: permissionsSchema,
  }),
  locationAccess: sessionLocationAccessSchema,
});

export const currentSessionSchema = z.object({
  tokenType: z.literal("access"),
  userId: z.string().min(1),
  businessId: z.string().min(1),
  membershipId: z.string().min(1),
  authVersion: z.number().int().positive(),
  roles: sessionRolesSchema,
  permissions: permissionsSchema,
  locationAccess: sessionLocationAccessSchema,
});

export const loginResponseSchema = z.object({
  status: z.literal("success"),
  data: z.discriminatedUnion("requiresRoleSelection", [
    directLoginSchema,
    roleSelectionChallengeSchema,
  ]),
});

export const selectRoleResponseSchema = z.object({
  status: z.literal("success"),
  data: selectRoleDataSchema,
});

export const sessionResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    session: currentSessionSchema,
  }),
});
