import { useState } from "react";

import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";

import type { RestaurantTable } from "../../restaurant-tables/schemas/restaurant-table.schema";

import type { OrderInput } from "../schemas/sales.schema";

export function OrderDetailsForm({
  initial,
  tables,
  busy,
  onSave,
  onCancel,
}: {
  initial: OrderInput;
  tables: RestaurantTable[];
  busy: boolean;
  onSave: (input: OrderInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const serviceType = initial.serviceType;

  const [tableId, setTableId] = useState(
    initial.restaurantTableId ?? ""
  );

  const [count, setCount] = useState(
    initial.customerCount?.toString() ?? ""
  );

  const [notes, setNotes] = useState(initial.notes ?? "");

  return (
    <form
      className="sales-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (
          busy ||
          serviceType === "DELIVERY" ||
          (serviceType === "TABLE" && !tableId)
        ) {
          return;
        }

        void onSave({
          serviceType,
          restaurantTableId: serviceType === "TABLE" ? tableId : null,
          customerCount:
            serviceType === "TABLE" && count ? Number(count) : null,
          notes: notes.trim() || null,
        });
      }}
    >
      <p className="sales-board-muted">
        {serviceType === "TABLE"
          ? "Cuenta de mesa"
          : "Pedido para recoger"}
      </p>

      {serviceType === "TABLE" && (
        <SelectField
          label="Mesa"
          value={tableId}
          disabled={busy}
          required
          placeholder="Selecciona una mesa libre"
          options={tables.map((table) => ({
            value: table.id,
            label: table.name,
          }))}
          onValueChange={setTableId}
        />
      )}

      {serviceType === "TABLE" && (
        <TextField
          label="Cantidad de personas"
          type="number"
          min={1}
          step={1}
          placeholder="Ej. 4"
          value={count}
          disabled={busy}
          onChange={(event) => setCount(event.target.value)}
        />
      )}

      <label className="sales-label">
        Observaciones
        <textarea
          placeholder="Ej. Cliente alérgico al maní"
          value={notes}
          disabled={busy}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <div className="sales-form-actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          size="sm"
          loading={busy}
          disabled={serviceType === "TABLE" && !tableId}
        >
          Guardar
        </Button>
      </div>
    </form>
  );
}
