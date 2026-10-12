import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

const optionalEmail = z
  .union([
    z.literal(""),
    z.string().trim().email("Correo no válido.").max(254),
  ])
  .nullable()
  .transform((value) => value?.toLowerCase() || null);

const requiredText = (max: number) =>
  z.string().trim().min(1, "Este campo es obligatorio.").max(max);

const country = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Usa el código de dos letras del país.")
  .transform((value) => value.toUpperCase());

const id = z.string().regex(/^[1-9]\d*$/);

export const fiscalFormSchema = z
  .object({
    legalName: requiredText(200).min(
      2,
      "Escribe al menos dos caracteres."
    ),
    commercialName: optionalText(200),

    personType: z.string().pipe(
      z.enum(["NATURAL_PERSON", "LEGAL_ENTITY"], {
        error: "Selecciona el tipo de persona.",
      })
    ),

    documentType: z
      .string()
      .pipe(z.enum(["NIT", "CC", "CE", "PASSPORT", "OTHER"])),

    documentNumber: requiredText(30).regex(
      /^[A-Za-z0-9-]+$/,
      "Documento no válido."
    ),

    verificationDigit: optionalText(1).refine(
      (value) => value === null || /^\d$/.test(value),
      "Usa un solo dígito."
    ),

    taxRegimeCode: optionalText(30),
    vatResponsibilityCode: optionalText(30),
    consumptionTaxApplicable: z.boolean(),
    economicActivityCode: optionalText(10),

    fiscalAddress: requiredText(250),
    countryCode: country,
    departmentCode: optionalText(5),
    departmentName: requiredText(100),
    municipalityCode: optionalText(10),
    municipalityName: requiredText(100),
    postalCode: optionalText(12),

    billingEmail: z
      .string()
      .trim()
      .email("Correo no válido.")
      .max(254)
      .transform((value) => value.toLowerCase()),

    billingPhone: optionalText(30),
    administrativeContactName: optionalText(150),
    administrativeContactEmail: optionalEmail,
    administrativeContactPhone: optionalText(30),

    taxResponsibilities: z
      .array(
        z.object({
          code: requiredText(30),
          name: requiredText(150),
        })
      )
      .max(50)
      .refine(
        (values) =>
          new Set(values.map((value) => value.code)).size ===
          values.length,
        "No repitas responsabilidades fiscales."
      ),
  })
  .superRefine((value, context) => {
    if (
      value.documentType === "NIT" &&
      value.verificationDigit === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationDigit"],
        message: "El NIT requiere dígito de verificación.",
      });
    }
  });

export type FiscalDraft = z.input<typeof fiscalFormSchema>;

export const fiscalProfileSchema = fiscalFormSchema.safeExtend({
  businessId: id,
  updatedAt: z.iso.datetime({ offset: true }),
});

export function emptyFiscalDraft(): FiscalDraft {
  return {
    legalName: "",
    commercialName: "",
    personType: "",
    documentType: "NIT",
    documentNumber: "",
    verificationDigit: "",
    taxRegimeCode: "",
    vatResponsibilityCode: "",
    consumptionTaxApplicable: false,
    economicActivityCode: "",
    fiscalAddress: "",
    countryCode: "CO",
    departmentCode: "",
    departmentName: "",
    municipalityCode: "",
    municipalityName: "",
    postalCode: "",
    billingEmail: "",
    billingPhone: "",
    administrativeContactName: "",
    administrativeContactEmail: "",
    administrativeContactPhone: "",
    taxResponsibilities: [],
  };
}

export const locationTypes = [
  {
    value: "PRODUCTION_WAREHOUSE",
    label: "Planta / bodega",
  },
  {
    value: "POINT_OF_SALE",
    label: "Punto de venta",
  },
] as const;

export const locationFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Mínimo dos caracteres.")
    .max(30)
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
          "Usa letras, números y guiones."
        )
    ),

  name: requiredText(150).min(2, "Mínimo dos caracteres."),

  locationType: z
    .string()
    .pipe(z.enum(["PRODUCTION_WAREHOUSE", "POINT_OF_SALE"])),

  address: optionalText(250),
  countryCode: country,
  departmentCode: optionalText(5),
  departmentName: optionalText(100),
  municipalityCode: optionalText(10),
  municipalityName: optionalText(100),
  postalCode: optionalText(12),
  phone: optionalText(30),
  email: optionalEmail,
});

export type LocationDraft = z.input<typeof locationFormSchema>;

export const locationSchema = locationFormSchema.extend({
  id,
  businessId: id,
  isInventoryLocation: z.boolean(),
  isProductionLocation: z.boolean(),
  isSalesLocation: z.boolean(),
  isActive: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type BusinessLocation = z.output<typeof locationSchema>;

export function emptyLocationDraft(): LocationDraft {
  return {
    code: "",
    name: "",
    locationType: "",
    address: "",
    countryCode: "CO",
    departmentCode: "",
    departmentName: "",
    municipalityCode: "",
    municipalityName: "",
    postalCode: "",
    phone: "",
    email: "",
  };
}
