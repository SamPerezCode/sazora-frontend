import { useCallback, useId, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import {
  DiscardChangesDialog,
  UnsavedChangesGuard,
} from "../../../components/feedback/UnsavedChangesGuard";
import { DateField } from "../../../components/forms/DateField";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useAdminForm } from "../../../hooks/useAdminForm";
import { useAdminResource } from "../../../hooks/useAdminResource";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import {
  taxDraft,
  taxTypeSchema,
  taxTypes,
} from "../schemas/tax-class.schema";
import type { TaxClass } from "../schemas/tax-class.schema";
import {
  createTaxRate,
  getTaxClass,
  saveTaxClass,
  setTaxClassStatus,
} from "../services/tax-class.service";

export type TaxAction =
  | { kind: "create" }
  | { kind: "edit" | "rate" | "status"; id: string };

interface Props {
  action: TaxAction;
  timezone: string;
  onClose: (refresh?: boolean) => void;
  onSaved: (item: TaxClass) => void;
}

export function TaxClassDialog(props: Props) {
  return props.action.kind === "create" ? (
    <TaxEditor {...props} original={undefined} />
  ) : (
    <ExistingTaxClass {...props} id={props.action.id} />
  );
}

function ExistingTaxClass(props: Props & { id: string }) {
  const modalId = useId();
  const { id } = props;

  const load = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      getTaxClass(id, session, signal),
    [id]
  );

  const resource = useAdminResource(
    load,
    "tax-class:" + id,
    "taxes.read"
  );

  if (!resource.data) {
    return (
      <BottomSheet
        id={modalId}
        open
        variant="modal"
        title="Clase de impuesto"
        className="configuration-modal tax-modal"
        onClose={() => props.onClose()}
      >
        {resource.pending ? (
          <LoadingState message="Consultando impuesto…" />
        ) : (
          <Alert>
            <p>{resource.error}</p>

            <Button variant="secondary" onClick={resource.refresh}>
              Reintentar
            </Button>
          </Alert>
        )}
      </BottomSheet>
    );
  }

  return <TaxEditor {...props} original={resource.data} />;
}

function TaxEditor({
  action,
  timezone,
  original,
  onClose,
  onSaved,
}: Props & { original: TaxClass | undefined }) {
  const modalId = useId();
  const { session } = useAppShell();

  const canManage = hasPermission(session, "taxes.manage");
  const form = useAdminForm(taxDraft(original));
  const [discard, setDiscard] = useState(false);

  const isStatus = action.kind === "status";
  const isRate = action.kind === "rate";
  const hasRate = isRate || action.kind === "create";

  const disabled =
    form.busy ||
    form.uncertain ||
    !canManage ||
    (isRate && !original?.isActive);

  const rateError =
    form.errors.rate ?? form.errors["initialRate.rate"];

  const fromError =
    form.errors.validFrom ?? form.errors["initialRate.validFrom"];

  const toError =
    form.errors.validTo ?? form.errors["initialRate.validTo"];

  function close() {
    if (form.busy) return;

    if (!isStatus && form.dirty && !form.uncertain) {
      setDiscard(true);
    } else {
      onClose(form.uncertain);
    }
  }

  async function submit() {
    if (disabled || (!isStatus && !form.dirty)) return;

    let saved: TaxClass | undefined;

    await form.save(
      async (draft, signal) => {
        if (isStatus || isRate) {
          if (!original) {
            throw new Error("Consulta nuevamente la clase.");
          }

          saved = isStatus
            ? await setTaxClassStatus(original, session, signal)
            : await createTaxRate(draft, original, session, signal);
        } else {
          saved = await saveTaxClass(
            draft,
            original,
            session,
            signal
          );
        }

        return taxDraft(saved);
      },
      () => {
        if (saved) {
          onSaved(saved);
        }
      }
    );
  }

  const title = isStatus
    ? (original?.isActive ? "Desactivar " : "Activar ") +
      original?.name
    : isRate
      ? "Nueva tarifa · " + original?.name
      : original
        ? "Editar clase de impuesto"
        : "Nueva clase de impuesto";

  return (
    <>
      <UnsavedChangesGuard
        dirty={!isStatus && form.dirty && !form.uncertain}
        busy={form.busy}
      />

      {discard && (
        <DiscardChangesDialog
          onCancel={() => setDiscard(false)}
          onDiscard={() => onClose()}
        />
      )}

      <BottomSheet
        id={modalId}
        open
        variant="modal"
        title={title}
        className={
          "configuration-modal tax-modal" +
          (isRate ? " tax-rate-modal" : "")
        }
        busy={form.busy}
        onClose={close}
      >
        <p className="tax-description">
          {isStatus
            ? original?.isActive
              ? "Dejará de estar disponible para nuevas operaciones. El historial se conserva."
              : "Volverá a estar disponible para nuevas operaciones."
            : isRate
              ? "Las tarifas históricas se conservan."
              : "Clase fiscal y vigencia de tarifa"}
        </p>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {!isStatus && (
            <fieldset className="tax-fields" disabled={disabled}>
              <legend className="sr-only">Datos del impuesto</legend>

              {!isRate && (
                <>
                  <TextField
                    label="Código"
                    name="code"
                    placeholder="Ej. IVA_19"
                    required
                    maxLength={50}
                    data-dialog-initial-focus
                    value={form.draft.code}
                    error={form.errors.code}
                    onChange={(event) =>
                      form.change({
                        code: event.currentTarget.value,
                      })
                    }
                  />

                  <TextField
                    label="Nombre"
                    name="name"
                    placeholder="Ej. IVA 19%"
                    required
                    maxLength={120}
                    value={form.draft.name}
                    error={form.errors.name}
                    onChange={(event) =>
                      form.change({
                        name: event.currentTarget.value,
                      })
                    }
                  />

                  <SelectField
                    label="Tipo fiscal"
                    name="taxType"
                    placeholder="Selecciona un tipo fiscal"
                    value={form.draft.taxType}
                    options={taxTypes}
                    disabled={disabled || !!original}
                    error={form.errors.taxType}
                    onValueChange={(value) =>
                      form.change({
                        taxType: taxTypeSchema.parse(value),
                      })
                    }
                  />

                  <TextField
                    label="Descripción (opcional)"
                    name="description"
                    placeholder="Ej. Impuesto para productos gravados"
                    maxLength={500}
                    value={form.draft.description}
                    error={form.errors.description}
                    onChange={(event) =>
                      form.change({
                        description: event.currentTarget.value,
                      })
                    }
                  />
                </>
              )}

              {hasRate && (
                <>
                  <TextField
                    label="Tarifa (%)"
                    name="rate"
                    placeholder="Ej. 19.0000"
                    inputMode="decimal"
                    required
                    maxLength={8}
                    data-dialog-initial-focus={isRate || undefined}
                    value={form.draft.rate}
                    error={rateError}
                    onChange={(event) =>
                      form.change({
                        rate: event.currentTarget.value.replace(
                          ",",
                          "."
                        ),
                      })
                    }
                  />

                  <DateField
                    label="Vigente desde"
                    name="validFrom"
                    value={form.draft.validFrom}
                    timeZone={timezone}
                    clearable={false}
                    disabled={disabled}
                    error={fromError}
                    onValueChange={(validFrom) =>
                      form.change({ validFrom })
                    }
                  />

                  <DateField
                    label="Vigente hasta (opcional)"
                    name="validTo"
                    value={form.draft.validTo}
                    timeZone={timezone}
                    min={form.draft.validFrom || undefined}
                    disabled={disabled}
                    error={toError}
                    onValueChange={(validTo) =>
                      form.change({ validTo })
                    }
                  />
                </>
              )}
            </fieldset>
          )}

          {action.kind === "edit" && (
            <p className="tax-note">
              El tipo fiscal se conserva. Para cambiar la tarifa,
              utiliza “Nueva tarifa”.
            </p>
          )}

          {hasRate && (
            <p className="tax-note">
              Las fechas de vigencia son inclusivas y no pueden
              superponerse.
            </p>
          )}

          {isRate && !original?.isActive && (
            <Alert>Activa la clase antes de agregar tarifas.</Alert>
          )}

          {!canManage && (
            <Alert>No tienes permiso para modificar impuestos.</Alert>
          )}

          {form.message && <Alert>{form.message}</Alert>}

          <footer className="tax-footer">
            <Button
              variant="secondary"
              disabled={form.busy}
              onClick={close}
            >
              {form.uncertain
                ? "Cerrar y consultar listado"
                : "Cancelar"}
            </Button>

            <Button
              type="submit"
              loading={form.busy}
              loadingText="Guardando…"
              disabled={disabled || (!isStatus && !form.dirty)}
            >
              {isStatus
                ? "Confirmar"
                : isRate
                  ? "Guardar tarifa"
                  : "Guardar"}
            </Button>
          </footer>
        </form>
      </BottomSheet>
    </>
  );
}
