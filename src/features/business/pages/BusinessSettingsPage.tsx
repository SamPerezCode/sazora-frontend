import { useId, useRef, useState } from "react";
import {
  Building2,
  ChefHat,
  ImagePlus,
  Palette,
  Printer,
  RotateCcw,
  Save,
  UtensilsCrossed,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Toggle } from "../../../components/forms/Toggle";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { TextField } from "../../../components/forms/TextField";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { resolveFileUrl } from "../../../lib/files";
import { PreparationAreasPanel } from "../../preparation-areas/components/PreparationAreasPanel";
import type {
  BusinessSettings,
  BusinessSettingsResource,
  SettingsSection,
} from "../schemas/business-settings.schema";
import {
  BrandPreview,
  TicketPreview,
} from "../components/BusinessPreviews";
import { useSettingsEditor } from "../hooks/useSettingsEditor";

const tabs = [
  {
    id: "information",
    label: "Información del negocio",
    icon: Building2,
    description: "Nombre, contacto y datos que verán tus clientes.",
  },
  {
    id: "brand",
    label: "Marca y colores",
    icon: Palette,
    description:
      "Logo y colores de tu restaurante para el perfil y el menú público.",
  },
  {
    id: "ticket",
    label: "Comanda de cocina",
    icon: Printer,
    description: "Cómo se imprime el pedido para tu cocina.",
  },
  {
    id: "menu",
    label: "Menú público",
    icon: UtensilsCrossed,
    description: "Presentación y disponibilidad de tu menú público.",
  },
  {
    id: "areas",
    label: "Áreas de preparación",
    icon: ChefHat,
    description:
      "Organiza dónde se prepara o despacha cada producto.",
  },
] as const;

const informationFields = [
  {
    key: "name",
    label: "Nombre del restaurante",
    max: 120,
  },
  {
    key: "tagline",
    label: "Eslogan o frase corta",
    max: 160,
  },
  {
    key: "phone",
    label: "Teléfono de reservas y domicilios",
    max: 30,
  },
  {
    key: "address",
    label: "Dirección",
    max: 250,
  },
  {
    key: "openingHoursText",
    label: "Horario de atención",
    max: 200,
  },
  {
    key: "instagram",
    label: "Instagram",
    max: 100,
  },
  {
    key: "taxId",
    label: "NIT / identificación fiscal",
    max: 50,
  },
] as const;

const colors = [
  {
    key: "primaryColor",
    label: "Color principal",
  },
  {
    key: "accentColor",
    label: "Color de acento",
  },
] as const;

export function BusinessSettingsPage() {
  const { settings, session } = useAppShell();

  if (settings.loading) {
    return (
      <Card>
        <LoadingState message="Cargando tu negocio…" />
      </Card>
    );
  }

  if (settings.error || !settings.data) {
    return (
      <Alert>
        <p>
          {settings.error ?? "No pudimos consultar la configuración."}
        </p>

        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={settings.retry}
        >
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <BusinessSettingsEditor
      key={`${settings.data.businessId}:${session.membership.id}`}
      settings={settings.data}
      resource={settings}
    />
  );
}

function BusinessSettingsEditor({
  settings,
  resource,
}: {
  settings: BusinessSettings;
  resource: BusinessSettingsResource;
}) {
  const editor = useSettingsEditor(settings, resource);
  const { draft, notice } = editor;
  const [areasOpen, setAreasOpen] = useState(false);
  const active = areasOpen ? "areas" : editor.active;

  const id = useId();
  const upload = useRef<HTMLInputElement>(null);

  const selectedTab = tabs.find((tab) => tab.id === active)!;
  const Icon = selectedTab.icon;

  function activateTab(next: SettingsSection | "areas"): void {
    setAreasOpen(next === "areas");

    if (next !== "areas") {
      editor.setActive(next);
    }

    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <div className="business-settings">
      <div className="business-settings-editor">
        <div
          role="tablist"
          aria-label="Configuración del negocio"
          className="business-settings-tabs"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.id}`}
              aria-label={tab.label}
              title={tab.label}
              aria-selected={active === tab.id}
              aria-controls={`${id}-panel-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => activateTab(tab.id)}
              onKeyDown={(event) => {
                let next: number;

                if (event.key === "ArrowRight") {
                  next = (index + 1) % tabs.length;
                } else if (event.key === "ArrowLeft") {
                  next = (index + tabs.length - 1) % tabs.length;
                } else if (event.key === "Home") {
                  next = 0;
                } else if (event.key === "End") {
                  next = tabs.length - 1;
                } else {
                  return;
                }

                event.preventDefault();
                activateTab(tabs[next].id);
              }}
            >
              <tab.icon
                aria-hidden="true"
                size={18}
                strokeWidth={1.75}
              />

              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel-areas`}
          aria-labelledby={`${id}-tab-areas`}
          hidden={!areasOpen}
          tabIndex={0}
        >
          {areasOpen && <PreparationAreasPanel />}
        </div>

        {tabs
          .filter((tab) => tab.id !== "areas")
          .map((tab) => (
            <div
              key={tab.id}
              role="tabpanel"
              id={`${id}-panel-${tab.id}`}
              aria-labelledby={`${id}-tab-${tab.id}`}
              hidden={active !== tab.id}
              tabIndex={0}
            >
              {active === tab.id && (
                <Card>
                  <h2 className="flex items-center gap-2 text-base font-bold text-heading">
                    <Icon
                      aria-hidden="true"
                      size={18}
                      className="shrink-0 text-accent"
                    />
                    {selectedTab.label}
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {selectedTab.description}
                  </p>

                  <form
                    noValidate
                    className="mt-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void editor.save(
                        editor.active,
                        event.currentTarget
                      );
                    }}
                  >
                    <fieldset
                      disabled={resource.busy}
                      className="min-w-0 space-y-5"
                    >
                      <legend className="sr-only">
                        {selectedTab.label}
                      </legend>

                      {active === "information" && (
                        <div className="business-settings-fields">
                          {informationFields.map((field) => (
                            <TextField
                              key={field.key}
                              name={field.key}
                              label={field.label}
                              value={draft[field.key]}
                              onChange={(event) =>
                                editor.change(
                                  field.key,
                                  event.target.value
                                )
                              }
                              error={notice.errors[field.key]}
                              maxLength={field.max}
                              required={field.key === "name"}
                              type={
                                field.key === "phone" ? "tel" : "text"
                              }
                              className={
                                !notice.errors[field.key]
                                  ? "border-outline dark:border-outline"
                                  : ""
                              }
                            />
                          ))}
                        </div>
                      )}

                      {active === "brand" && (
                        <>
                          <div className="business-logo-controls">
                            <Avatar
                              name={draft.name}
                              src={
                                editor.selection?.url ??
                                resolveFileUrl(settings.logoUrl)
                              }
                              size="xl"
                            />

                            <div className="business-logo-actions space-y-2">
                              <div className="business-logo-buttons">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    upload.current?.click()
                                  }
                                >
                                  <ImagePlus
                                    aria-hidden="true"
                                    size={16}
                                  />
                                  Subir logo
                                </Button>

                                {settings.logoUrl &&
                                  !editor.selection && (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() =>
                                        void editor.saveLogo(true)
                                      }
                                    >
                                      Eliminar logo
                                    </Button>
                                  )}
                              </div>

                              <input
                                ref={upload}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                aria-label="Seleccionar logo"
                                onChange={(event) => {
                                  editor.selectLogo(
                                    event.target.files?.[0]
                                  );
                                  event.target.value = "";
                                }}
                              />

                              <p className="business-logo-help text-xs text-muted">
                                JPEG, PNG o WebP. Máximo 5 MB.
                              </p>
                            </div>
                          </div>

                          {editor.selection && (
                            <div className="space-y-2">
                              <p className="break-all text-xs text-muted">
                                {editor.selection.file.name}
                                {" · Vista previa sin guardar"}
                              </p>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void editor.saveLogo()
                                  }
                                >
                                  Guardar logo
                                </Button>

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={editor.clearSelection}
                                >
                                  Cancelar selección
                                </Button>
                              </div>
                            </div>
                          )}

                          {editor.logoNotice && (
                            <p
                              role={
                                editor.logoError ? "alert" : "status"
                              }
                              className={`text-xs ${
                                editor.logoError
                                  ? "text-[var(--shell-danger)]"
                                  : "text-muted"
                              }`}
                            >
                              {editor.logoNotice}
                            </p>
                          )}

                          <div className="business-settings-fields">
                            {colors.map((color) => (
                              <div
                                key={color.key}
                                className="business-color-field"
                              >
                                <input
                                  type="color"
                                  aria-label={`Seleccionar ${color.label.toLowerCase()}`}
                                  value={
                                    /^#[0-9a-f]{6}$/i.test(
                                      draft[color.key]
                                    )
                                      ? draft[color.key]
                                      : settings[color.key]
                                  }
                                  onChange={(event) =>
                                    editor.change(
                                      color.key,
                                      event.target.value
                                    )
                                  }
                                />

                                <TextField
                                  label={color.label}
                                  name={color.key}
                                  value={draft[color.key]}
                                  maxLength={7}
                                  onChange={(event) =>
                                    editor.change(
                                      color.key,
                                      event.target.value
                                    )
                                  }
                                  error={notice.errors[color.key]}
                                  spellCheck={false}
                                  className={
                                    !notice.errors[color.key]
                                      ? "border-outline dark:border-outline"
                                      : ""
                                  }
                                />
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={editor.resetColors}
                              disabled={
                                !editor.dirty("brand") ||
                                resource.busy
                              }
                            >
                              <RotateCcw
                                aria-hidden="true"
                                size={16}
                              />
                              Deshacer cambios de color
                            </Button>

                            <p className="text-xs leading-relaxed text-muted">
                              Vuelve a los últimos colores guardados.
                            </p>
                          </div>
                        </>
                      )}

                      {active === "ticket" && (
                        <>
                          <TextAreaField
                            name="kitchenTicketFooter"
                            label="Nota final de la comanda"
                            value={draft.kitchenTicketFooter}
                            maxLength={500}
                            error={notice.errors.kitchenTicketFooter}
                            onChange={(event) =>
                              editor.change(
                                "kitchenTicketFooter",
                                event.target.value
                              )
                            }
                          />

                          <p className="text-xs leading-relaxed text-muted">
                            El nombre de tu restaurante siempre
                            encabeza la comanda; Sazora aparece al pie
                            como firma de la aplicación.
                          </p>
                        </>
                      )}

                      {active === "menu" && (
                        <>
                          <TextAreaField
                            name="publicMenuDescription"
                            label="Descripción del menú público"
                            value={draft.publicMenuDescription}
                            maxLength={500}
                            error={
                              notice.errors.publicMenuDescription
                            }
                            onChange={(event) =>
                              editor.change(
                                "publicMenuDescription",
                                event.target.value
                              )
                            }
                          />

                          <div className="space-y-3">
                            <Toggle
                              name="publicMenuEnabled"
                              label="Habilitar menú público"
                              checked={draft.publicMenuEnabled}
                              disabled={resource.busy}
                              error={notice.errors.publicMenuEnabled}
                              onChange={(event) =>
                                editor.change(
                                  "publicMenuEnabled",
                                  event.target.checked
                                )
                              }
                            />

                            <Toggle
                              name="publicOrderingEnabled"
                              label="Permitir pedidos desde el menú público"
                              description="Para recibir pedidos, el menú público debe estar habilitado."
                              checked={draft.publicOrderingEnabled}
                              disabled={
                                !draft.publicMenuEnabled ||
                                resource.busy
                              }
                              error={
                                notice.errors.publicOrderingEnabled
                              }
                              onChange={(event) =>
                                editor.change(
                                  "publicOrderingEnabled",
                                  event.target.checked
                                )
                              }
                            />
                          </div>
                        </>
                      )}
                    </fieldset>

                    {notice.message && !notice.success && (
                      <Alert className="mt-5">{notice.message}</Alert>
                    )}

                    <div className="business-settings-save">
                      <p role="status" className="text-xs text-muted">
                        {resource.busy
                          ? "Guardando…"
                          : active === "brand" && editor.selection
                            ? "Logo pendiente de guardar."
                            : notice.success
                              ? notice.message
                              : editor.dirty(editor.active)
                                ? "Tienes cambios sin guardar."
                                : "Todo está guardado."}
                      </p>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          !editor.dirty(editor.active) ||
                          resource.busy
                        }
                        loading={resource.busy}
                        loadingText="Guardando…"
                      >
                        <Save aria-hidden="true" size={16} />
                        Guardar cambios
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          ))}
      </div>

      {!areasOpen && (
        <aside className="business-settings-preview">
          {active === "ticket" ? (
            <TicketPreview draft={draft} />
          ) : (
            <BrandPreview
              draft={draft}
              settings={settings}
              localLogo={editor.selection?.url ?? null}
            />
          )}
        </aside>
      )}
    </div>
  );
}
