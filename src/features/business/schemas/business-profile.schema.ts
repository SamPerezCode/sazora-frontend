import { z } from "zod";

export const businessProfileSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().nullable(),
});

export const businessProfileResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    settings: businessProfileSchema,
  }),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export interface BusinessIdentity {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}
