import { z } from "zod";

const hex = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Usa un color con formato #RRGGBB.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((value) => value || null);

export const businessSettingsSchema = z.object({
  businessId: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  currencyCode: z.string(),
  tagline: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  openingHoursText: z.string().nullable(),
  instagram: z.string().nullable(),
  taxId: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: hex,
  accentColor: hex,
  kitchenTicketFooter: z.string().nullable(),
  publicMenuDescription: z.string().nullable(),
  publicMenuEnabled: z.boolean(),
  publicOrderingEnabled: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const businessSettingsResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    settings: businessSettingsSchema,
  }),
});

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe al menos 2 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  tagline: optionalText(160),
  phone: optionalText(30),
  address: optionalText(250),
  openingHoursText: optionalText(200),
  instagram: optionalText(100),
  taxId: optionalText(50),
  primaryColor: hex.transform((value) => value.toUpperCase()),
  accentColor: hex.transform((value) => value.toUpperCase()),
  kitchenTicketFooter: optionalText(500),
  publicMenuDescription: optionalText(500),
  publicMenuEnabled: z.boolean(),
  publicOrderingEnabled: z.boolean(),
});

export const sectionSchemas = {
  information: formSchema.pick({
    name: true,
    tagline: true,
    phone: true,
    address: true,
    openingHoursText: true,
    instagram: true,
    taxId: true,
  }),

  brand: formSchema.pick({
    primaryColor: true,
    accentColor: true,
  }),

  ticket: formSchema.pick({
    kitchenTicketFooter: true,
  }),

  menu: formSchema
    .pick({
      publicMenuDescription: true,
      publicMenuEnabled: true,
      publicOrderingEnabled: true,
    })
    .refine(
      (value) =>
        value.publicMenuEnabled || !value.publicOrderingEnabled,
      {
        path: ["publicOrderingEnabled"],
        message: "Activa el menú público antes de recibir pedidos.",
      }
    ),
};

export const SECTION_FIELDS = {
  information: [
    "name",
    "tagline",
    "phone",
    "address",
    "openingHoursText",
    "instagram",
    "taxId",
  ],
  brand: ["primaryColor", "accentColor"],
  ticket: ["kitchenTicketFooter"],
  menu: [
    "publicMenuDescription",
    "publicMenuEnabled",
    "publicOrderingEnabled",
  ],
} as const;

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export type BusinessDraft = z.input<typeof formSchema>;

export type BusinessPatch = Partial<z.output<typeof formSchema>>;

export type SettingsSection = keyof typeof SECTION_FIELDS;

export function toBusinessDraft(
  settings: BusinessSettings
): BusinessDraft {
  return {
    name: settings.name,
    tagline: settings.tagline ?? "",
    phone: settings.phone ?? "",
    address: settings.address ?? "",
    openingHoursText: settings.openingHoursText ?? "",
    instagram: settings.instagram ?? "",
    taxId: settings.taxId ?? "",
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    kitchenTicketFooter: settings.kitchenTicketFooter ?? "",
    publicMenuDescription: settings.publicMenuDescription ?? "",
    publicMenuEnabled: settings.publicMenuEnabled,
    publicOrderingEnabled: settings.publicOrderingEnabled,
  };
}

export function selectSection(
  section: SettingsSection,
  draft: BusinessDraft
): Partial<BusinessDraft> {
  return Object.fromEntries(
    SECTION_FIELDS[section].map((key) => [key, draft[key]])
  );
}

export type BusinessMutation =
  | {
      kind: "settings";
      patch: BusinessPatch;
    }
  | {
      kind: "logo";
      file: File | null;
    };

export interface BusinessSettingsResource {
  data: BusinessSettings | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  retry: () => void;
  mutate: (action: BusinessMutation) => Promise<BusinessSettings>;
}
