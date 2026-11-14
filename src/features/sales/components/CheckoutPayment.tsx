import { Trash2 } from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import type { PaymentMethod } from "../../payment-methods/schemas/payment-method.schema";
import { cashMoney } from "../../cash/utils/cash-format";
import type { PaymentDraft } from "../schemas/checkout.schema";
import { calculateCheckout } from "../utils/checkout-calculation";

export function CheckoutPayment({
  payment,
  index,
  methods,
  currency,
  removable,
  disabled,
  change,
  remove,
}: {
  payment: PaymentDraft;
  index: number;
  methods: PaymentMethod[];
  currency: string;
  removable: boolean;
  disabled: boolean;
  change: (next: PaymentDraft) => void;
  remove: () => void;
}) {
  const method = methods.find(
    (row) => row.id === payment.paymentMethodId
  );

  const preview = calculateCheckout([payment], methods, "0");

  return (
    <section className="checkout-payment">
      <div className="checkout-row">
        <h3>Pago {index + 1}</h3>

        <Button
          size="icon"
          variant="secondary"
          disabled={disabled || !removable}
          aria-label={"Eliminar pago " + (index + 1)}
          onClick={remove}
        >
          <Trash2 size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="checkout-grid">
        <SelectField
          label="Forma de pago"
          placeholder="Seleccionar"
          value={payment.paymentMethodId}
          disabled={disabled}
          options={methods.map((row) => ({
            value: row.id,
            label: row.name,
          }))}
          onValueChange={(paymentMethodId) =>
            change({
              ...payment,
              paymentMethodId,
              tenderedAmount: "",
              reference: "",
            })
          }
        />

        <TextField
          label="Valor aplicado"
          inputMode="decimal"
          value={payment.amount}
          onChange={(event) =>
            change({
              ...payment,
              amount: event.target.value,
            })
          }
        />

        {method?.paymentType === "CASH" && (
          <>
            <TextField
              label="Valor entregado"
              inputMode="decimal"
              value={payment.tenderedAmount}
              onChange={(event) =>
                change({
                  ...payment,
                  tenderedAmount: event.target.value,
                })
              }
            />

            <TextField
              label="Cambio calculado"
              readOnly
              value={cashMoney(preview.change, currency)}
            />
          </>
        )}

        {method?.requiresReference && (
          <TextField
            label="Referencia obligatoria"
            required
            maxLength={120}
            value={payment.reference}
            onChange={(event) =>
              change({
                ...payment,
                reference: event.target.value,
              })
            }
          />
        )}

        <TextField
          label="Notas (opcional)"
          maxLength={500}
          value={payment.notes}
          onChange={(event) =>
            change({
              ...payment,
              notes: event.target.value,
            })
          }
        />
      </div>
    </section>
  );
}
