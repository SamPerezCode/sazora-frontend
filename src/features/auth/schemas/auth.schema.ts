import { z } from "zod";

export const roleSchema = z.enum([
  "ADMIN",
  "WAITER",
  "KITCHEN",
  "PUBLIC_ORDER_MANAGER",
  "DELIVERY_DRIVER",
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

export const loginDataSchema = z.object({
  accessToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    fullName: z.string().min(1),
  }),
  business: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
  membership: z.object({
    id: z.string().min(1),
    roles: z.array(roleSchema).min(1),
  }),
});

export const currentSessionSchema = z.object({
  tokenType: z.literal("access"),
  userId: z.string().min(1),
  businessId: z.string().min(1),
  membershipId: z.string().min(1),
  authVersion: z.number().int().positive(),
  roles: z.array(roleSchema).min(1),
});

export const loginResponseSchema = z.object({
  status: z.literal("success"),
  data: loginDataSchema,
});

export const sessionResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    session: currentSessionSchema,
  }),
});
