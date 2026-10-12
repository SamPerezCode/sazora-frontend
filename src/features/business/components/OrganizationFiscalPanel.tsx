import { useState } from "react";
import { Plus, Save, TriangleAlert, X } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/feedback/Alert";
import { TextField } from "../../../components/forms/TextField";
import { Toggle } from "../../../components/forms/Toggle";
import {
  DiscardChangesDialog,
  UnsavedChangesGuard,
} from "../../../components/feedback/UnsavedChangesGuard";
import { useAdminResource } from "../../../hooks/useAdminResource";
import { useAdminForm } from "../../../hooks/useAdminForm";
import {
  getFiscalProfile,
  saveFiscalProfile,
} from "../services/organization.service";
import {
  emptyFiscalDraft,
  fiscalFormSchema,
} from "../schemas/organization.schema";
import type { FiscalDraft } from "../schemas/organization.schema";
import { SettingsFields } from "./SettingsFields";
import type { SettingsField } from "./SettingsFields";
import { ConfigurationState } from "./ConfigurationState";

const groups: {
  title: string;
  description: string;
  fields: SettingsField[];
}[] = [
  {
    title: "Identidad legal",
    description: "Cómo está registrada la organización.",
    fields: [
      {
        name: "personType",
        label: "Tipo de persona",
        required: true,
        options: [
          { value: "NATURAL_PERSON", label: "Natural" },
          { value: "LEGAL_ENTITY", label: "Jurídica" },
        ],
      },
      {
        name: "documentType",
        label: "Tipo de documento",
        required: true,
        options: [
          { value: "NIT", label: "NIT" },
          { value: "CC", label: "Cédula de ciudadanía" },
          { value: "CE", label: "Cédula de extranjería" },
          { value: "PASSPORT", label: "Pasaporte" },
          { value: "OTHER", label: "Otro" },
        ],
      },
      {
        name: "legalName",
        label: "Razón social",
        max: 200,
        required: true,
        wide: true,
      },
      {
        name: "commercialName",
        label: "Nombre comercial",
        max: 200,
        wide: true,
      },
      {
        name: "documentNumber",
        label: "Número de documento",
        max: 30,
        required: true,
      },
      {
        name: "verificationDigit",
        label: "Dígito de verificación",
        max: 1,
      },
    ],
  },
  {
    title: "Información tributaria",
    description: "Códigos y responsabilidades según el RUT.",
    fields: [
      {
        name: "taxRegimeCode",
        label: "Código del régimen tributario",
        max: 30,
      },
      {
        name: "vatResponsibilityCode",
        label: "Código de responsabilidad de IVA",
        max: 30,
      },
      {
        name: "economicActivityCode",
        label: "Código de actividad económica",
        max: 10,
        wide: true,
      },
    ],
  },
  {
    title: "Dirección fiscal",
    description: "Domicilio registrado en el RUT.",
    fields: [
      {
        name: "countryCode",
        label: "País (código de dos letras)",
        max: 2,
        required: true,
      },
      {
        name: "departmentName",
        label: "Departamento",
        max: 100,
        required: true,
      },
      {
        name: "municipalityName",
        label: "Municipio",
        max: 100,
        required: true,
      },
      {
        name: "postalCode",
        label: "Código postal",
        max: 12,
      },
      {
        name: "fiscalAddress",
        label: "Dirección",
        max: 250,
        wide: true,
        required: true,
      },
      {
        name: "departmentCode",
        label: "Código de departamento (opcional)",
        max: 5,
      },
      {
        name: "municipalityCode",
        label: "Código de municipio (opcional)",
        max: 10,
      },
    ],
  },
  {
    title: "Facturación y contacto",
    description: "Dónde llegarán las comunicaciones fiscales.",
    fields: [
      {
        name: "billingEmail",
        label: "Correo de facturación",
        max: 254,
        required: true,
        type: "email",
      },
      {
        name: "billingPhone",
        label: "Teléfono de facturación",
        max: 30,
        type: "tel",
      },
      {
        name: "administrativeContactName",
        label: "Responsable administrativo",
        max: 150,
        wide: true,
      },
      {
        name: "administrativeContactEmail",
        label: "Correo del responsable",
        max: 254,
        type: "email",
      },
      {
        name: "administrativeContactPhone",
        label: "Teléfono del responsable",
        max: 30,
        type: "tel",
      },
    ],
  },
];

export function OrganizationFiscalPanel() {
  const resource = useAdminResource(
    getFiscalProfile,
    "fiscal-profile"
  );

  return (
    <section className="configuration-section">
      <header>
        <h2>Información legal y fiscal</h2>
        <p>
          Datos legales de la organización que se utilizarán
          posteriormente para facturación.
        </p>
      </header>

      <p className="configuration-warning">
        <TriangleAlert size={18} />
        Copia esta información exactamente como aparece en el RUT.
      </p>

      {resource.pending ||
      resource.error ||
      resource.data === undefined ? (
        <ConfigurationState
          pending={resource.pending}
          error={resource.error}
          onRetry={resource.refresh}
        />
      ) : (
        <FiscalForm
          initial={
            resource.data === null
              ? emptyFiscalDraft()
              : fiscalFormSchema.parse(resource.data)
          }
          configured={resource.data !== null}
          onReload={resource.refresh}
        />
      )}
    </section>
  );
}

function FiscalForm({
  initial,
  configured,
  onReload,
}: {
  initial: FiscalDraft;
  configured: boolean;
  onReload: () => void;
}) {
  const { session } = useAppShell();
  const form = useAdminForm(initial);

  const [saved, setSaved] = useState(configured);
  const [discard, setDiscard] = useState(false);

  const responsibilities = form.draft.taxResponsibilities;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        void form.save(
          async (draft, signal) =>
            fiscalFormSchema.parse(
              await saveFiscalProfile(draft, session, signal)
            ),
          () => setSaved(true)
        );
      }}
    >
      <UnsavedChangesGuard dirty={form.dirty} busy={form.busy} />

      {discard && (
        <DiscardChangesDialog
          onCancel={() => setDiscard(false)}
          onDiscard={() => {
            form.reset();
            setDiscard(false);
          }}
        />
      )}

      <p className="configuration-status" role="status">
        {saved
          ? "Información fiscal configurada"
          : "Pendiente de configurar"}
      </p>

      <fieldset
        disabled={form.busy || form.uncertain}
        className="configuration-grid"
      >
        <legend className="sr-only">
          Información legal y fiscal
        </legend>

        {groups.map((group, index) => (
          <section className="configuration-card" key={group.title}>
            <h3>{group.title}</h3>
            <p>{group.description}</p>

            <SettingsFields
              fields={group.fields}
              values={form.draft}
              errors={form.errors}
              onChange={(name, value) =>
                form.change({ [name]: value })
              }
            />

            {index === 1 && (
              <div className="configuration-section">
                <Toggle
                  label="Aplica impuesto al consumo"
                  checked={form.draft.consumptionTaxApplicable}
                  onChange={(event) =>
                    form.change({
                      consumptionTaxApplicable: event.target.checked,
                    })
                  }
                />

                <h4>Responsabilidades fiscales</h4>

                {responsibilities.map((item, row) => (
                  <div
                    className="configuration-responsibility"
                    key={row}
                  >
                    <TextField
                      label="Código"
                      placeholder="Código según el RUT"
                      maxLength={30}
                      value={item.code}
                      error={
                        form.errors[
                          "taxResponsibilities." + row + ".code"
                        ]
                      }
                      onChange={(event) =>
                        form.change({
                          taxResponsibilities: responsibilities.map(
                            (value, i) =>
                              i === row
                                ? {
                                    ...value,
                                    code: event.target.value,
                                  }
                                : value
                          ),
                        })
                      }
                    />

                    <TextField
                      label="Nombre"
                      placeholder="Nombre de la responsabilidad fiscal"
                      maxLength={150}
                      value={item.name}
                      error={
                        form.errors[
                          "taxResponsibilities." + row + ".name"
                        ]
                      }
                      onChange={(event) =>
                        form.change({
                          taxResponsibilities: responsibilities.map(
                            (value, i) =>
                              i === row
                                ? {
                                    ...value,
                                    name: event.target.value,
                                  }
                                : value
                          ),
                        })
                      }
                    />

                    <Button
                      variant="cancel"
                      aria-label="Quitar responsabilidad"
                      onClick={() =>
                        form.change({
                          taxResponsibilities:
                            responsibilities.filter(
                              (_, i) => i !== row
                            ),
                        })
                      }
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="secondary"
                  disabled={responsibilities.length >= 50}
                  onClick={() =>
                    form.change({
                      taxResponsibilities: [
                        ...responsibilities,
                        { code: "", name: "" },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  Agregar responsabilidad
                </Button>
              </div>
            )}
          </section>
        ))}
      </fieldset>

      {form.message && (
        <Alert variant={form.success ? "success" : "error"}>
          {form.message}
        </Alert>
      )}

      <footer className="configuration-save">
        <p role="status">
          {form.busy
            ? "Guardando…"
            : form.dirty
              ? "Tienes cambios sin guardar."
              : saved
                ? "Todo está guardado."
                : "Completa la información fiscal."}
        </p>

        <div className="configuration-save-actions">
          {form.uncertain ? (
            <Button variant="secondary" onClick={onReload}>
              <span>Consultar estado guardado</span>
            </Button>
          ) : (
            <>
              <Button
                variant="cancel"
                disabled={!form.dirty || form.busy}
                onClick={() => setDiscard(true)}
              >
                <span>Cancelar cambios</span>
              </Button>

              <Button
                type="submit"
                loading={form.busy}
                loadingText="Guardando…"
                disabled={form.busy || !form.dirty}
              >
                <Save aria-hidden="true" size={16} />
                <span>Guardar información</span>
              </Button>
            </>
          )}
        </div>
      </footer>
    </form>
  );
}
