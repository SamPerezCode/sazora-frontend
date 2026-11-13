import { TextAreaField } from "../../../components/forms/TextAreaField";
import { TextField } from "../../../components/forms/TextField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { cents } from "../../../lib/money";
import { money } from "../../../lib/money";
import type { CartRow } from "../schemas/public-menu.schema";
import type { CheckoutDraft } from "../schemas/public-menu.schema";
import { checkoutSchema } from "../schemas/public-menu.schema";
import type { PublicLocation } from "../schemas/public-menu.schema";
import { Bike } from "lucide-react";
import { Store } from "lucide-react";
import { useState } from "react";

export function CheckoutDialog({
  draft,
  rows,
  location,
  currency,
  busy,
  uncertain,
  error,
  onDraft,
  onClose,
  onChangeLocation,
  onSubmit,
}: {
  draft: CheckoutDraft;
  rows: CartRow[];
  location: PublicLocation;
  currency: string;
  busy: boolean;
  uncertain: boolean;
  error: string;
  onDraft: (draft: CheckoutDraft) => void;
  onClose: () => void;
  onChangeLocation: () => void;
  onSubmit: (draft: CheckoutDraft) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const locked = busy || uncertain;

  const total = rows.reduce(
    (sum, row) =>
      sum + cents(row.product.currentPrice) * BigInt(row.quantity),
    0n
  );

  function change<K extends keyof CheckoutDraft>(
    key: K,
    value: CheckoutDraft[K]
  ) {
    onDraft({ ...draft, [key]: value });
    setErrors((previous) => ({ ...previous, [key]: "" }));
  }

  function continueOrSend() {
    if (locked) return;

    const result = checkoutSchema.safeParse(draft);

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ])
        )
      );
      setStep(1);
      return;
    }

    setErrors({});

    if (step === 1) {
      setStep(2);
    } else {
      onSubmit(result.data);
    }
  }

  return (
    <BottomSheet
      id="pm-checkout-dialog"
      open
      variant="modal"
      title={
        step === 1 ? "Completa tu solicitud" : "Revisa tu solicitud"
      }
      className="pm-dialog pm-dialog--checkout"
      busy={busy}
      onClose={onClose}
      onBack={step === 2 ? () => setStep(1) : undefined}
    >
      <p className="pm-dialog-caption">Paso {step} de 2</p>

      <div
        className="pm-progress"
        role="progressbar"
        aria-label="Pasos de la solicitud"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={step}
      >
        <span style={{ width: step === 1 ? "50%" : "100%" }} />
      </div>

      <form
        className="pm-dialog-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          continueOrSend();
        }}
      >
        <div className="pm-dialog-content pm-stack">
          <p className="pm-notice">
            Esta es una solicitud de pedido. El negocio debe revisarla
            y confirmarla.
          </p>

          {step === 1 ? (
            <fieldset
              disabled={locked}
              className="pm-stack pm-fieldset"
            >
              <div>
                <p className="pm-field-label">Tipo de servicio</p>

                <div className="pm-service-options">
                  <button
                    type="button"
                    aria-pressed={draft.serviceType === "TAKEAWAY"}
                    onClick={() => change("serviceType", "TAKEAWAY")}
                  >
                    <Store size={20} aria-hidden="true" />
                    Recoger en el punto de venta
                  </button>

                  <button
                    type="button"
                    aria-pressed={draft.serviceType === "DELIVERY"}
                    onClick={() => change("serviceType", "DELIVERY")}
                  >
                    <Bike size={20} aria-hidden="true" />
                    Domicilio
                  </button>
                </div>
              </div>

              <div className="pm-notice pm-between">
                <div>
                  <strong>{location.name}</strong>
                  {location.address && <p>{location.address}</p>}
                  {location.phone && <p>{location.phone}</p>}
                </div>

                <button
                  type="button"
                  className="pm-text-button"
                  onClick={onChangeLocation}
                >
                  Cambiar punto de venta
                </button>
              </div>

              <TextField
                label="Nombre"
                placeholder="Ej. Laura Gómez"
                autoComplete="name"
                required
                maxLength={150}
                value={draft.customerName}
                error={errors.customerName}
                onChange={(event) =>
                  change("customerName", event.target.value)
                }
              />

              <TextField
                label="Teléfono"
                placeholder="Ej. +57 300 123 4567"
                type="tel"
                autoComplete="tel"
                required
                maxLength={30}
                value={draft.customerPhone}
                error={errors.customerPhone}
                onChange={(event) =>
                  change("customerPhone", event.target.value)
                }
              />

              <TextField
                label="Correo (opcional)"
                placeholder="Ej. laura@correo.com"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={draft.customerEmail}
                error={errors.customerEmail}
                onChange={(event) =>
                  change("customerEmail", event.target.value)
                }
              />

              {draft.serviceType === "DELIVERY" && (
                <>
                  <TextAreaField
                    label="Dirección del domicilio"
                    placeholder="Calle, número, edificio y apartamento"
                    autoComplete="street-address"
                    required
                    maxLength={300}
                    value={draft.deliveryAddress}
                    error={errors.deliveryAddress}
                    onChange={(event) =>
                      change("deliveryAddress", event.target.value)
                    }
                  />

                  <TextAreaField
                    label="Indicaciones de entrega (opcional)"
                    placeholder="Ej. Portería, torre o indicaciones para llegar"
                    maxLength={300}
                    value={draft.deliveryInstructions ?? ""}
                    error={errors.deliveryInstructions}
                    onChange={(event) =>
                      change(
                        "deliveryInstructions",
                        event.target.value
                      )
                    }
                  />

                  <p className="pm-notice">
                    La cobertura, el valor del domicilio y el pago se
                    confirmarán por WhatsApp. La entrega depende de la
                    aceptación del negocio.
                  </p>
                </>
              )}

              <TextAreaField
                label="Notas generales (opcional)"
                placeholder="Ej. Llamar al llegar"
                maxLength={500}
                value={draft.notes}
                error={errors.notes}
                onChange={(event) =>
                  change("notes", event.target.value)
                }
              />
            </fieldset>
          ) : (
            <div className="pm-stack">
              <dl className="pm-review">
                <div>
                  <dt>Punto de venta</dt>
                  <dd>{location.name}</dd>
                </div>

                <div>
                  <dt>Tipo de servicio</dt>
                  <dd>
                    {draft.serviceType === "DELIVERY"
                      ? "Domicilio"
                      : "Recoger en el punto de venta"}
                  </dd>
                </div>

                <div>
                  <dt>Cliente</dt>
                  <dd>
                    {draft.customerName} · {draft.customerPhone}
                    {draft.customerEmail &&
                      " · " + draft.customerEmail}
                  </dd>
                </div>

                {draft.serviceType === "DELIVERY" && (
                  <div>
                    <dt>Dirección</dt>
                    <dd>{draft.deliveryAddress}</dd>
                  </div>
                )}

                {draft.serviceType === "DELIVERY" &&
                  draft.deliveryInstructions?.trim() && (
                    <div>
                      <dt>Indicaciones de entrega</dt>
                      <dd>{draft.deliveryInstructions}</dd>
                    </div>
                  )}
              </dl>

              <div>
                <p className="pm-field-label">Productos</p>

                <ul className="pm-summary-list">
                  {rows.map((row) => (
                    <li key={row.product.id}>
                      <div>
                        {row.quantity} × {row.product.name}
                        {row.notes && (
                          <small className="pm-muted">
                            {row.notes}
                          </small>
                        )}
                      </div>

                      <strong>
                        {money(
                          cents(row.product.currentPrice) *
                            BigInt(row.quantity),
                          currency
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>

              {draft.notes && (
                <div>
                  <p className="pm-field-label">Notas generales</p>
                  <p className="pm-item-notes">{draft.notes}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="pm-error pm-notice" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="pm-dialog-footer pm-stack">
          <p className="pm-between">
            <strong>Subtotal estimado</strong>
            <strong>{money(total, currency)}</strong>
          </p>

          <button
            type="submit"
            className="pm-primary"
            disabled={locked || rows.some((row) => !row.available)}
          >
            {busy
              ? "Enviando solicitud…"
              : step === 1
                ? "Revisar solicitud"
                : "Enviar solicitud"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
