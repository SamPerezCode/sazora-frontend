import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";

export interface SettingsField {
  name: string;
  label: string;
  placeholder?: string;
  max?: number;
  required?: boolean;
  type?: "email" | "tel";
  wide?: boolean;
  options?: readonly {
    value: string;
    label: string;
  }[];
}

const placeholders: Partial<Record<string, string>> = {
  code: "Ej. PV-01",
  name: "Ej. Sede principal",
  address: "Ej. Carrera 11 #82-14",
  countryCode: "Ej. CO",
  departmentName: "Ej. Cundinamarca",
  municipalityName: "Ej. Bogotá D. C.",
  postalCode: "Ej. 110221",
  departmentCode: "Código según tu registro",
  municipalityCode: "Código según tu registro",
  phone: "Ej. 601 745 2210",
  email: "Ej. sede@negocio.com",

  legalName: "Razón social como aparece en el RUT",
  commercialName: "Ej. Mokai Panadería Café",
  documentNumber: "Número de documento sin dígito de verificación",
  verificationDigit: "DV",
  taxRegimeCode: "Código del régimen según el RUT",
  vatResponsibilityCode: "Código de responsabilidad según el RUT",
  economicActivityCode: "Código de actividad según el RUT",
  fiscalAddress: "Dirección registrada en el RUT",
  billingEmail: "Ej. facturacion@negocio.com",
  billingPhone: "Ej. 601 745 2210",
  administrativeContactName: "Nombre completo del responsable",
  administrativeContactEmail: "Ej. administracion@negocio.com",
  administrativeContactPhone: "Ej. 310 555 0102",
};

interface SettingsFieldsProps {
  fields: readonly SettingsField[];
  values: object;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

export function SettingsFields({
  fields,
  values,
  errors,
  onChange,
}: SettingsFieldsProps) {
  const data = values as Record<string, unknown>;

  return (
    <div className="configuration-fields">
      {fields.map((field) => (
        <div
          key={field.name}
          className={field.wide ? "configuration-wide" : undefined}
        >
          {field.options ? (
            <SelectField
              label={field.label}
              name={field.name}
              value={String(data[field.name] ?? "")}
              placeholder={
                field.placeholder ?? "Selecciona una opción"
              }
              required={field.required}
              options={field.options}
              error={errors[field.name]}
              onValueChange={(value) => onChange(field.name, value)}
            />
          ) : (
            <TextField
              label={field.label}
              name={field.name}
              value={String(data[field.name] ?? "")}
              placeholder={
                field.placeholder ??
                placeholders[field.name] ??
                `Ingresa ${field.label.toLowerCase()}`
              }
              type={field.type ?? "text"}
              required={field.required}
              maxLength={field.max}
              error={errors[field.name]}
              onChange={(event) =>
                onChange(field.name, event.currentTarget.value)
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
