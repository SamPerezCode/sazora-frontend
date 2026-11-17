import { Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";

import type { PaymentMethod } from "../../payment-methods/schemas/payment-method.schema";
import type { PaymentDraft } from "../schemas/checkout.schema";

export function PreorderPaymentFields({
  payment,
  index,
  methods,
  disabled,
  removable,
  onChange,
  onRemove,
}: {
  payment: PaymentDraft;
  index: number;
  methods: PaymentMethod[];
  disabled: boolean;
  removable: boolean;
  onChange: (next: PaymentDraft) => void;
  onRemove: () => void;
}) {
  const method = methods.find(
    (row) => row.id === payment.paymentMethodId
  );

  return (
    <fieldset className="pp-payment" disabled={disabled}>
      <legend className="sr-only">Forma de pago {index + 1}</legend>

      <div className="pp-method">
        <SelectField
          label={"Forma de pago " + (index + 1)}
          hideLabel
          placeholder="Selecciona una forma de pago"
          value={payment.paymentMethodId}
          disabled={disabled}
          options={methods.map((row) => ({
            value: row.id,
            label: row.name,
          }))}
          onValueChange={(paymentMethodId) =>
            onChange({
              ...payment,
              paymentMethodId,
              tenderedAmount: "",
              reference: "",
            })
          }
        />

        {removable && (
          <Button
            size="icon"
            variant="soft"
            disabled={disabled}
            aria-label={"Eliminar forma de pago " + (index + 1)}
            onClick={onRemove}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="pp-grid">
        <TextField
          label="Importe aplicado"
          inputMode="decimal"
          disabled={disabled}
          value={payment.amount}
          onChange={(event) =>
            onChange({
              ...payment,
              amount: event.target.value,
            })
          }
        />

        {method?.paymentType === "CASH" && (
          <TextField
            label="Valor recibido"
            inputMode="decimal"
            disabled={disabled}
            value={payment.tenderedAmount}
            placeholder={payment.amount}
            onChange={(event) =>
              onChange({
                ...payment,
                tenderedAmount: event.target.value,
              })
            }
          />
        )}

        {method?.requiresReference && (
          <div className="pp-reference">
            <TextField
              label="Referencia o dato para identificar el pago"
              required
              disabled={disabled}
              maxLength={120}
              placeholder="Ej. NEQUI-7890, nombre del pagador o últimos 4 dígitos"
              value={payment.reference}
              onChange={(event) =>
                onChange({
                  ...payment,
                  reference: event.target.value,
                })
              }
            />

            <small>
              Puedes registrar un dato corto para localizar el pago.
            </small>
          </div>
        )}
      </div>
    </fieldset>
  );
}
