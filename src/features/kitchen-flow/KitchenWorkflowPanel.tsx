import { useId, useMemo, useState } from "react";
import { CheckCircle2, Monitor, Printer, Save } from "lucide-react";

import { useAppShell } from "../../app/layout/shell-context";
import { Alert } from "../../components/feedback/Alert";
import { SelectField } from "../../components/forms/SelectField";
import { BottomSheet } from "../../components/layout/BottomSheet";
import { Button } from "../../components/ui/Button";

import { useSalesLocations } from "../sales/hooks/useSalesLocations";
import { useKitchenSettings } from "./useKitchenSettings";

import {
  kitchenErrorMessage,
  WORKFLOW_DESCRIPTIONS,
  WORKFLOW_LABELS,
} from "./kitchen-flow.schema";

import type { KitchenWorkflowMode } from "./kitchen-flow.schema";

import "./kitchen-flow.css";

const modes: KitchenWorkflowMode[] = [
  "PRINT_ONLY",
  "PRINT_AND_SCREEN",
];

const benefits: Record<KitchenWorkflowMode, string[]> = {
  PRINT_ONLY: [
    "Se imprime una comanda por área de preparación.",
    "Las adiciones generan nuevas versiones imprimibles.",
    "El mesero marca el pedido como entregado.",
    "Recomendado para cocinas que trabajan de forma manual.",
  ],
  PRINT_AND_SCREEN: [
    "Se imprime una comanda por área.",
    "Cocina actualiza pendiente, preparación y listo.",
    "El mesero visualiza el avance.",
    "Recomendado para operaciones con pantalla en cocina.",
  ],
};

export function KitchenWorkflowPanel() {
  const { session } = useAppShell();
  const locations = useSalesLocations(session);
  const dialogId = useId();

  const scope = useMemo(
    () =>
      locations.location
        ? {
            businessId: session.business.id,
            location: locations.location,
          }
        : null,
    [session.business.id, locations.location]
  );

  const settings = useKitchenSettings(
    session.accessToken,
    scope,
    locations.invalidate
  );

  const [choice, setChoice] = useState<KitchenWorkflowMode | null>(
    null
  );
  const [nextLocation, setNextLocation] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const selectedMode = choice ?? settings.data?.workflowMode ?? null;
  const dirty =
    !!settings.data && selectedMode !== settings.data.workflowMode;

  const admin = session.authorization.roles.includes("ADMIN");

  function changeLocation(id: string) {
    if (settings.saving || id === locations.location?.id) return;

    if (dirty) {
      setNextLocation(id);
      return;
    }

    setChoice(null);
    setMessage("");
    setSaveError("");
    locations.select(id);
  }

  async function save() {
    if (!admin || !dirty || !selectedMode || settings.saving) return;

    setMessage("");
    setSaveError("");

    try {
      const value = await settings.save(selectedMode);

      if (value) {
        setChoice(null);
        setMessage(
          `Modo de cocina actualizado para ${value.location.name}.`
        );
      }
    } catch (cause) {
      setSaveError(kitchenErrorMessage(cause));
    }
  }

  return (
    <>
      <section className="kf-settings configuration-card">
        <header>
          <h2>
            <Printer size={20} aria-hidden="true" />
            Flujo de trabajo de cocina
          </h2>
          <p>
            Define cómo se gestionan las comandas en cada punto de
            venta.
          </p>
        </header>

        {locations.loading ? (
          <p role="status">Cargando puntos de venta…</p>
        ) : locations.error ? (
          <Alert>
            <p>{locations.error}</p>
            <Button variant="soft" onClick={locations.retry}>
              Reintentar
            </Button>
          </Alert>
        ) : locations.options.length === 0 ? (
          <Alert>
            <p>No hay puntos de venta disponibles.</p>
            <Button variant="soft" onClick={locations.retry}>
              Actualizar acceso
            </Button>
          </Alert>
        ) : (
          <div className="kf-location">
            <SelectField
              label="Punto de venta"
              className="kf-location-select"
              value={locations.location?.id ?? ""}
              placeholder="Selecciona un punto de venta"
              disabled={settings.saving}
              options={locations.options.map((location) => ({
                value: location.id,
                label: `${location.name} · ${location.code}`,
              }))}
              onValueChange={changeLocation}
            />

            <p>
              La configuración se aplica únicamente a este punto de
              venta.
            </p>
          </div>
        )}

        {locations.issue && <Alert>{locations.issue}</Alert>}

        {!scope &&
          !locations.loading &&
          locations.options.length > 0 && (
            <p>
              Selecciona un punto de venta para consultar su modo.
            </p>
          )}

        {scope && settings.loading && (
          <p role="status">Cargando configuración…</p>
        )}

        {scope && settings.error && (
          <Alert>
            <p>{settings.error}</p>
            <Button variant="soft" onClick={settings.retry}>
              Reintentar
            </Button>
          </Alert>
        )}

        {scope && settings.data && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset
              className="kf-modes"
              disabled={!admin || settings.saving}
            >
              <legend className="sr-only">
                Modo de trabajo de cocina
              </legend>

              {modes.map((mode) => {
                const Icon =
                  mode === "PRINT_ONLY" ? Printer : Monitor;

                return (
                  <label
                    key={mode}
                    className="kf-mode"
                    data-selected={selectedMode === mode}
                  >
                    <input
                      type="radio"
                      name="kitchen-workflow"
                      value={mode}
                      checked={selectedMode === mode}
                      onChange={() => {
                        setChoice(mode);
                        setMessage("");
                        setSaveError("");
                      }}
                    />

                    <span className="kf-mode-heading">
                      <Icon size={24} aria-hidden="true" />
                      <span>
                        <strong>{WORKFLOW_LABELS[mode]}</strong>
                        <span>{WORKFLOW_DESCRIPTIONS[mode]}</span>
                      </span>
                    </span>

                    <ul>
                      {benefits[mode].map((benefit) => (
                        <li key={benefit}>
                          <CheckCircle2
                            size={15}
                            aria-hidden="true"
                          />
                          {benefit}
                        </li>
                      ))}
                    </ul>

                    {settings.data?.workflowMode === mode && (
                      <small className="kf-current">
                        Modo actual
                      </small>
                    )}
                  </label>
                );
              })}
            </fieldset>

            <p className="kf-info">
              Este cambio se aplicará a las órdenes que se confirmen
              después de guardar. Las órdenes que ya están en
              preparación conservarán su flujo actual.
            </p>

            {saveError && <Alert>{saveError}</Alert>}
            {message && <p role="status">{message}</p>}

            <footer className="kf-settings-footer">
              <p>
                {settings.saving
                  ? "Guardando…"
                  : dirty
                    ? "Hay cambios sin guardar."
                    : "Todo está guardado."}
              </p>

              <Button
                variant="soft"
                size="compact"
                disabled={!dirty || settings.saving}
                onClick={() => {
                  setChoice(null);
                  setMessage("");
                  setSaveError("");
                }}
              >
                Cancelar cambios
              </Button>

              <Button
                type="submit"
                size="compact"
                loading={settings.saving}
                loadingText="Guardando…"
                disabled={!admin || !dirty}
              >
                <Save size={16} aria-hidden="true" />
                Guardar modo de trabajo
              </Button>
            </footer>
          </form>
        )}
      </section>

      {nextLocation && (
        <BottomSheet
          id={dialogId}
          open
          variant="modal"
          title="¿Descartar los cambios sin guardar?"
          className="kf-dialog"
          onClose={() => setNextLocation(null)}
        >
          <div className="kf-dialog-content">
            <p>El modo seleccionado todavía no se ha guardado.</p>

            <div className="kf-actions">
              <Button
                variant="soft"
                onClick={() => setNextLocation(null)}
              >
                Continuar editando
              </Button>

              <Button
                onClick={() => {
                  const id = nextLocation;
                  setNextLocation(null);
                  setChoice(null);
                  setMessage("");
                  setSaveError("");
                  locations.select(id);
                }}
              >
                Descartar y cambiar
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
