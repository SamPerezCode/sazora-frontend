import { useState } from "react";

import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";

import type { OrderInput } from "../schemas/sales.schema";

import {
  CHANNELS,
  customerErrors,
  customerFields,
} from "../utils/preorders";

export function OrderCustomerForm({
  initial,
  existing,
  channels = ["IN_PERSON", "WHATSAPP", "PHONE"],
  busy,
  onSave,
  onCancel,
}: {
  initial: OrderInput;
  existing: boolean;
  channels?: readonly ("IN_PERSON" | "WHATSAPP" | "PHONE")[];
  busy: boolean;
  onSave: (input: OrderInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<OrderInput>({
    ...initial,
    sourceChannel: initial.sourceChannel ?? "IN_PERSON",
  });

  const [submitted, setSubmitted] = useState(false);

  const required =
    value.sourceChannel === "WHATSAPP" ||
    value.sourceChannel === "PHONE";

  const errors = customerErrors(value);

  return (
    <form
      className="sales-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();

        if (busy) return;

        setSubmitted(true);

        if (Object.keys(errors).length) return;

        await onSave({
          ...value,
          ...customerFields(value),
        });
      }}
    >
      <p>
        {existing
          ? "Puedes editar estos datos mientras el pedido esté abierto y pendiente de pago."
          : "Se envían junto con los productos al crear el pedido."}
      </p>

      {existing || channels.length === 1 ? (
        <p>
          Origen:{" "}
          {initial.sourceChannel
            ? CHANNELS[initial.sourceChannel]
            : "No informado"}
        </p>
      ) : (
        <SelectField
          label="Origen del pedido"
          required
          disabled={busy}
          value={value.sourceChannel ?? "IN_PERSON"}
          options={channels.map((channel) => ({
            value: channel,
            label: CHANNELS[channel],
          }))}
          onValueChange={(sourceChannel) => {
            if (
              sourceChannel === "IN_PERSON" ||
              sourceChannel === "WHATSAPP" ||
              sourceChannel === "PHONE"
            ) {
              setValue({
                ...value,
                sourceChannel,
              });
            }
          }}
        />
      )}

      <p className="sales-price-note">
        {required
          ? "Nombre y teléfono son obligatorios para este origen."
          : "Los datos del cliente son opcionales para pedidos presenciales."}
      </p>

      <TextField
        label={
          required
            ? "Nombre del cliente *"
            : "Nombre del cliente (opcional)"
        }
        autoComplete="name"
        required={required}
        disabled={busy}
        value={value.customerName ?? ""}
        error={submitted ? errors.customerName : undefined}
        onChange={(event) =>
          setValue({
            ...value,
            customerName: event.target.value,
          })
        }
      />

      <TextField
        label={required ? "Teléfono *" : "Teléfono (opcional)"}
        type="tel"
        autoComplete="tel"
        placeholder="Ej. 310 456 7812"
        required={required}
        disabled={busy}
        value={value.customerPhone ?? ""}
        error={submitted ? errors.customerPhone : undefined}
        onChange={(event) =>
          setValue({
            ...value,
            customerPhone: event.target.value,
          })
        }
      />

      <TextField
        label="Correo electrónico (opcional)"
        type="email"
        autoComplete="email"
        placeholder="cliente@correo.com"
        disabled={busy}
        value={value.customerEmail ?? ""}
        error={submitted ? errors.customerEmail : undefined}
        onChange={(event) =>
          setValue({
            ...value,
            customerEmail: event.target.value,
          })
        }
      />

      <label className="sales-label">
        Notas generales de la orden (opcional)
        <textarea
          maxLength={500}
          disabled={busy}
          value={value.notes ?? ""}
          onChange={(event) =>
            setValue({
              ...value,
              notes: event.target.value,
            })
          }
        />
        <small>{value.notes?.length ?? 0}/500</small>
      </label>

      {submitted && errors.notes && (
        <p role="alert">{errors.notes}</p>
      )}

      <div className="sales-form-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button type="submit" loading={busy}>
          Guardar datos
        </Button>
      </div>
    </form>
  );
}
