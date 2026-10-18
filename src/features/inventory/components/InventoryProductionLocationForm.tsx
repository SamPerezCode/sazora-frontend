import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { createProduction } from "../services/inventory-audit.service";
import { productionInput } from "../schemas/inventory-audit.schema";
import { estimateProduction } from "../utils/inventory-audit";
import { money, quantity, cost } from "../utils/inventory-value";
import { Button } from "./InventoryButton";
import {
  Choice,
  LocationChoice,
  Field,
  DataTable,
  Notice,
  WriteModal,
} from "./InventoryLocationUI";

const fresh = () => ({
  key: crypto.randomUUID(),
  inventoryItemId: "",
  quantity: "",
  percentage: "",
});

export function InventoryProductionLocationForm({
  data,
  initialLocationId,
  currency,
  onClose,
  onSaved,
}: {
  data: InventoryWorkspace;
  initialLocationId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAppShell();
  const [locationId, setLocation] = useState(initialLocationId);
  const [notes, setNotes] = useState("");
  const [inputs, setInputs] = useState(() => [fresh()]);
  const [outputs, setOutputs] = useState(() => [fresh()]);
  const [dirty, setDirty] = useState(false);

  const options = data.items
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.id,
      label: item.name,
    }));

  function prepared() {
    const body = productionInput.parse({
      locationId,
      notes: notes.trim() || null,
      inputs: inputs.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        notes: null,
      })),
      outputs: outputs.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        costAllocationPercentage:
          outputs.length === 1 ? "100" : line.percentage,
        notes: null,
      })),
    });

    return {
      body,
      estimate: estimateProduction(body, data),
    };
  }

  let preview: ReturnType<typeof prepared> | null = null;
  let problem = "";

  try {
    preview = prepared();
  } catch (error) {
    problem =
      error instanceof Error && !("issues" in error)
        ? error.message
        : "Completa artículos, cantidades y distribución para revisar los costos.";
  }

  function lines(out: boolean) {
    const rows = out ? outputs : inputs;
    const setter = out ? setOutputs : setInputs;

    const update = (
      key: string,
      patch: Partial<ReturnType<typeof fresh>>
    ) => {
      setDirty(true);
      setter((previous) =>
        previous.map((line) =>
          line.key === key ? { ...line, ...patch } : line
        )
      );
    };

    return (
      <section className="grid gap-4">
        <h3 className="font-semibold">
          {out ? "Productos obtenidos" : "Insumos consumidos"}
        </h3>

        {rows.map((line, index) => {
          const item = data.items.find(
            (item) => item.id === line.inventoryItemId
          );

          const balance = data.balances.find(
            (balance) =>
              balance.inventoryItemId === line.inventoryItemId &&
              balance.location.id === locationId
          );

          return (
            <div
              key={line.key}
              className="grid gap-2 rounded-xl border border-outline p-3"
            >
              <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Choice
                  label={"Artículo " + (index + 1)}
                  value={line.inventoryItemId}
                  options={options}
                  onValueChange={(value) =>
                    update(line.key, {
                      inventoryItemId: value,
                    })
                  }
                />

                <Field
                  label="Cantidad"
                  decimal
                  value={line.quantity}
                  onChange={(value) =>
                    update(line.key, { quantity: value })
                  }
                />

                {out ? (
                  <Field
                    label="Distribución (%)"
                    decimal
                    disabled={rows.length === 1}
                    value={
                      rows.length === 1 ? "100" : line.percentage
                    }
                    onChange={(value) =>
                      update(line.key, { percentage: value })
                    }
                  />
                ) : (
                  <span />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar línea"
                  disabled={rows.length === 1}
                  onClick={() => {
                    setDirty(true);
                    setter((previous) =>
                      previous.filter(
                        (entry) => entry.key !== line.key
                      )
                    );
                  }}
                >
                  <Trash2 size={17} />
                </Button>
              </div>

              {item && (
                <p className="text-sm text-muted">
                  Disponible:{" "}
                  {quantity(
                    balance?.currentStock ?? "0",
                    item.baseUnit
                  )}{" "}
                  · Promedio:{" "}
                  {cost(
                    balance?.averageUnitCost ?? null,
                    item.baseUnit,
                    currency
                  )}
                </p>
              )}
            </div>
          );
        })}

        <Button
          variant="secondary"
          disabled={rows.length >= 100}
          onClick={() => {
            setDirty(true);
            setter((previous) => [...previous, fresh()]);
          }}
        >
          <Plus size={17} />
          {out ? "Agregar producto" : "Agregar insumo"}
        </Button>
      </section>
    );
  }

  return (
    <WriteModal
      title="Registrar producción"
      wide
      dirty={dirty}
      onClose={onClose}
      onSaved={onSaved}
      prepare={() => {
        const result = prepared();

        return {
          description: (
            <div className="grid gap-3">
              <p>
                Registrar producción en{" "}
                {
                  data.locations.find(
                    (location) => location.id === locationId
                  )?.name
                }
                .
              </p>

              <p>
                Costo trasladado estimado:{" "}
                {money(result.estimate.total, currency)}.
              </p>

              <Notice>
                Se descontarán los insumos y se agregarán los
                productos obtenidos. El servidor calculará los costos
                definitivos.
              </Notice>
            </div>
          ),
          save: (signal: AbortSignal) =>
            createProduction(session, signal, result.body),
        };
      }}
    >
      <LocationChoice
        dirty={dirty}
        label="Ubicación"
        value={locationId}
        onValueChange={(value) => {
          setDirty(true);
          setLocation(value);
        }}
        options={data.locations.map((location) => ({
          value: location.id,
          label: location.name + " · " + location.code,
        }))}
      />

      <Field
        label="Notas"
        multiline
        maxLength={500}
        value={notes}
        onChange={(value) => {
          setDirty(true);
          setNotes(value);
        }}
      />

      {lines(false)}
      {lines(true)}

      <h3 className="font-semibold">Impacto antes de confirmar</h3>

      {!preview ? (
        <Notice>{problem}</Notice>
      ) : (
        <>
          <DataTable
            headers={[
              "Artículo",
              "Operación",
              "Cantidad",
              "Costo estimado",
              "Costo unitario estimado",
            ]}
          >
            {preview.estimate.inputs.map((line) => {
              const item = data.items.find(
                (item) => item.id === line.inventoryItemId
              )!;

              return (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>Consumo</td>
                  <td>{quantity(line.quantity, item.baseUnit)}</td>
                  <td>{money(line.value, currency)}</td>
                  <td>Promedio vigente</td>
                </tr>
              );
            })}

            {preview.estimate.outputs.map((line) => {
              const item = data.items.find(
                (item) => item.id === line.inventoryItemId
              )!;

              return (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    Resultado · {line.costAllocationPercentage} %
                  </td>
                  <td>{quantity(line.quantity, item.baseUnit)}</td>
                  <td>{money(line.value, currency)}</td>
                  <td>
                    {cost(line.unitCost, item.baseUnit, currency)}
                  </td>
                </tr>
              );
            })}
          </DataTable>

          <Notice>
            Costo trasladado estimado:{" "}
            {money(preview.estimate.total, currency)}. Impacto neto
            estimado: {money("0", currency)}.
          </Notice>
        </>
      )}
    </WriteModal>
  );
}
