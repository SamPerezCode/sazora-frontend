import { useCallback, useId, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import {
  DiscardChangesDialog,
  UnsavedChangesGuard,
} from "../../../components/feedback/UnsavedChangesGuard";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Toggle } from "../../../components/forms/Toggle";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { useAdminForm } from "../../../hooks/useAdminForm";
import { useAdminResource } from "../../../hooks/useAdminResource";
import type { AuthSession } from "../../auth/types/auth.types";
import { hasPermission } from "../../auth/utils/permissions";
import {
  paymentMethodDraft,
  paymentTypes,
  paymentTypeSchema,
} from "../schemas/payment-method.schema";
import type { PaymentMethod } from "../schemas/payment-method.schema";
import {
  getPaymentMethod,
  savePaymentMethod,
  setPaymentMethodStatus,
} from "../services/payment-method.service";

export type PaymentMethodAction =
  | { kind: "create" }
  | { kind: "edit" | "status"; id: string };

interface DialogProps {
  action: PaymentMethodAction;
  onClose: (refresh?: boolean) => void;
  onSaved: (method: PaymentMethod) => void;
}

export function PaymentMethodDialog(props: DialogProps) {
  return props.action.kind === "create" ? (
    <PaymentMethodEditor {...props} original={undefined} />
  ) : (
    <ExistingPaymentMethod {...props} id={props.action.id} />
  );
}

function ExistingPaymentMethod(props: DialogProps & { id: string }) {
  const modalId = useId();
  const { id } = props;

  const load = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      getPaymentMethod(id, session, signal),
    [id]
  );

  const resource = useAdminResource(
    load,
    "payment-method:" + id,
    "business.settings.read"
  );

  if (!resource.data) {
    return (
      <BottomSheet
        id={modalId}
        open
        variant="modal"
        title="Forma de pago"
        className="configuration-modal payment-method-modal"
        onClose={() => props.onClose()}
      >
        {resource.pending ? (
          <LoadingState message="Consultando forma de pago…" />
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

  return <PaymentMethodEditor {...props} original={resource.data} />;
}

function PaymentMethodEditor({
  action,
  original,
  onClose,
  onSaved,
}: DialogProps & { original: PaymentMethod | undefined }) {
  const modalId = useId();
  const { session } = useAppShell();

  const canManage = hasPermission(
    session,
    "business.settings.manage"
  );

  const form = useAdminForm(paymentMethodDraft(original));
  const [discard, setDiscard] = useState(false);

  const isStatus = action.kind === "status";
  const isCash = form.draft.paymentType === "CASH";
  const disabled = form.busy || form.uncertain || !canManage;

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

    let saved: PaymentMethod | undefined;

    await form.save(
      async (draft, signal) => {
        if (isStatus) {
          if (!original) {
            throw new Error("Consulta nuevamente la forma de pago.");
          }

          saved = await setPaymentMethodStatus(
            original.id,
            !original.isActive,
            session,
            signal
          );
        } else {
          saved = await savePaymentMethod(
            draft,
            original?.id ?? null,
            session,
            signal
          );
        }

        return paymentMethodDraft(saved);
      },
      () => {
        if (saved) {
          onSaved(saved);
        }
      }
    );
  }

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
        className="configuration-modal payment-method-modal"
        title={
          isStatus
            ? (original?.isActive ? "Desactivar " : "Activar ") +
              original?.name
            : original
              ? "Editar forma de pago"
              : "Nueva forma de pago"
        }
        busy={form.busy}
        onClose={close}
      >
        <p className="payment-method-description">
          {isStatus
            ? original?.isActive
              ? "Dejará de estar disponible para nuevas operaciones. El historial se conserva."
              : "Volverá a estar disponible para nuevas operaciones."
            : "Configuración de cobro"}
        </p>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {!isStatus && (
            <fieldset
              className="payment-method-fields"
              disabled={disabled}
            >
              <legend className="sr-only">
                Datos de la forma de pago
              </legend>

              <div className="payment-method-grid">
                <TextField
                  label="Código"
                  name="code"
                  placeholder="Ej. NEQUI"
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
                  placeholder="Ej. Nequi"
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
                  label="Tipo"
                  name="paymentType"
                  required
                  disabled={disabled}
                  value={form.draft.paymentType}
                  options={paymentTypes}
                  error={form.errors.paymentType}
                  onValueChange={(value) => {
                    const paymentType =
                      paymentTypeSchema.parse(value);

                    form.change({
                      paymentType,
                      allowsChange:
                        paymentType === "CASH" &&
                        form.draft.allowsChange,
                    });
                  }}
                />

                <TextField
                  label="Orden"
                  name="displayOrder"
                  type="number"
                  placeholder="Ej. 0"
                  required
                  min={0}
                  max={65535}
                  step={1}
                  value={form.draft.displayOrder}
                  error={form.errors.displayOrder}
                  onChange={(event) =>
                    form.change({
                      displayOrder: event.currentTarget.value,
                    })
                  }
                />

                <Toggle
                  label="Requiere referencia"
                  checked={form.draft.requiresReference}
                  disabled={disabled}
                  error={form.errors.requiresReference}
                  onChange={(event) =>
                    form.change({
                      requiresReference: event.currentTarget.checked,
                    })
                  }
                />

                <Toggle
                  label="Permite cambio"
                  checked={form.draft.allowsChange}
                  disabled={disabled || !isCash}
                  error={form.errors.allowsChange}
                  onChange={(event) =>
                    form.change({
                      allowsChange: event.currentTarget.checked,
                    })
                  }
                />
              </div>

              <p className="payment-method-cash-note">
                {isCash
                  ? "Afecta efectivo de caja"
                  : "No afecta efectivo de caja. No permite devolver cambio."}
              </p>
            </fieldset>
          )}

          {!canManage && (
            <Alert>
              No tienes permiso para modificar formas de pago.
            </Alert>
          )}

          {form.message && <Alert>{form.message}</Alert>}

          <footer className="payment-method-footer">
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
              {isStatus ? "Confirmar" : "Guardar"}
            </Button>
          </footer>
        </form>
      </BottomSheet>
    </>
  );
}
