import { z } from "zod";
import { parseCalendarDate } from "../../../components/forms/calendar-date";

export const taxTypes = [
  { value: "VAT", label: "IVA" },
  { value: "CONSUMPTION", label: "Consumo" },
  { value: "EXEMPT", label: "Exento" },
  { value: "EXCLUDED", label: "Excluido" },
  { value: "NON_TAXED", label: "No gravado" },
  { value: "OTHER", label: "Otro" },
] as const;

export const taxTypeSchema = z.enum([
  "VAT",
  "CONSUMPTION",
  "EXEMPT",
  "EXCLUDED",
  "NON_TAXED",
  "OTHER",
]);

const id = z.string().regex(/^\d+$/);

const date = z
  .string()
  .refine(
    (value) => parseCalendarDate(value) !== null,
    "Selecciona una fecha válida."
  );

const percentage = z
  .string()
  .trim()
  .regex(
    /^(?:(?:0|[1-9]\d?)(?:\.\d{1,4})?|100(?:\.0{1,4})?)$/,
    "Ingresa una tarifa entre 0 y 100, con hasta cuatro decimales."
  );

const rateSchema = z.object({
  id,
  businessId: id,
  taxClassId: id,
  rate: percentage,
  validFrom: date,
  validTo: date.nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const taxClassSchema = z.object({
  id,
  businessId: id,
  code: z.string(),
  name: z.string(),
  taxType: taxTypeSchema,
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  rates: z.array(rateSchema),
});

export const taxClassesResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    taxClasses: z.array(taxClassSchema),
  }),
});

export const taxClassResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    taxClass: taxClassSchema,
  }),
});

export const taxDetailsFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "El código es obligatorio.")
    .max(50, "Máximo 50 caracteres.")
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          /^[A-Z0-9][A-Z0-9_-]*$/,
          "Usa letras, números, guiones o guiones bajos."
        )
    ),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "Máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres.")
    .transform((value) => value || null),
});

export const taxRateFormSchema = z
  .object({
    rate: percentage,
    validFrom: date,
    validTo: z
      .union([z.literal(""), date])
      .transform((value) => value || null),
  })
  .superRefine((value, context) => {
    if (value.validTo && value.validTo < value.validFrom) {
      context.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "La fecha final no puede ser anterior a la inicial.",
      });
    }
  });

export type TaxClass = z.infer<typeof taxClassSchema>;
export type TaxType = z.infer<typeof taxTypeSchema>;
export type TaxRate = z.infer<typeof rateSchema>;

export interface TaxDraft {
  code: string;
  name: string;
  description: string;
  taxType: TaxType;
  rate: string;
  validFrom: string;
  validTo: string;
}

export function taxDraft(original?: TaxClass): TaxDraft {
  return {
    code: original?.code ?? "",
    name: original?.name ?? "",
    description: original?.description ?? "",
    taxType: original?.taxType ?? "VAT",
    rate: "",
    validFrom: "",
    validTo: "",
  };
}

export function validateRate(draft: TaxDraft, original?: TaxClass) {
  const input = taxRateFormSchema.parse(draft);
  const taxType = original?.taxType ?? draft.taxType;
  const zero = /^0(?:\.0+)?$/.test(input.rate);

  const mustBeZero = ["EXEMPT", "EXCLUDED", "NON_TAXED"].includes(
    taxType
  );

  if (
    (mustBeZero && !zero) ||
    (["VAT", "CONSUMPTION"].includes(taxType) && zero)
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["rate"],
        message: mustBeZero
          ? "Este tipo fiscal requiere una tarifa de 0."
          : "IVA y consumo requieren una tarifa mayor que 0.",
      },
    ]);
  }

  const overlap = original?.rates.some(
    (rate) =>
      rate.isActive &&
      rate.validFrom <= (input.validTo ?? "9999-12-31") &&
      (rate.validTo ?? "9999-12-31") >= input.validFrom
  );

  if (overlap) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["validFrom"],
        message:
          "La vigencia se superpone con una tarifa existente. Revisa el historial.",
      },
    ]);
  }

  return input;
}

export function currentTaxRate(item: TaxClass, today: string) {
  return item.rates.find(
    (rate) =>
      rate.isActive &&
      rate.validFrom <= today &&
      (!rate.validTo || rate.validTo >= today)
  );
}

export function taxPercentage(value: string) {
  const [whole, decimals = ""] = value.split(".");

  return whole + "." + decimals.padEnd(4, "0") + "%";
}

export function taxDate(value: string) {
  return value.split("-").reverse().join("/");
}
