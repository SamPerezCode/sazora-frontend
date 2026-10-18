import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "./InventoryButton";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { registerManual } from "../services/inventory-location.service";
import { manualInputSchema } from "../schemas/inventory-location.schema";
import {
  add,
  cost,
  fixed,
  quantity,
  subtract,
  unvalued,
} from "../utils/inventory-value";
import {
  Choice,
  LocationChoice,
  Field,
  Notice,
  WriteModal,
} from "./InventoryLocationUI";

export function InventoryLocalMovement({
  data,
  initialItemId,
  initialLocationId,
  currency,
  onClose,
  onSaved,
}: {
  data: InventoryWorkspace;
  initialItemId: string;
  initialLocationId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAppShell();
  const [locationId, setLocation] = useState(initialLocationId);

  const [type, setType] = useState<"ADJUSTMENT" | "WASTE" | "RETURN">(
    "ADJUSTMENT"
  );

  const [returnKind, setReturn] = useState<
    "CUSTOMER_RETURN" | "SUPPLIER_RETURN"
  >("CUSTOMER_RETURN");

  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const fresh = (itemId = "") => ({
    key: crypto.randomUUID(),
    inventoryItemId: itemId,
    direction: "IN" as "IN" | "OUT",
    quantity: "",
    unitCost: "",
  });

  const [lines, setLines] = useState(() => [fresh(initialItemId)]);
  const [dirty, setDirty] = useState(false);

  const touch =
    (setter: (value: string) => void) => (value: string) => {
      setDirty(true);
      setter(value);
    };

  const update = (
    key: string,
    patch: Partial<(typeof lines)[number]>
  ) => {
    setDirty(true);
    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, ...patch } : line
      )
    );
  };

  function direction(line: (typeof lines)[number]) {
    return type === "WASTE" ||
      (type === "RETURN" && returnKind === "SUPPLIER_RETURN")
      ? "OUT"
      : type === "RETURN"
        ? "IN"
        : line.direction;
  }

  function balance(itemId: string) {
    return data.balances.find(
      (balance) =>
        balance.inventoryItemId === itemId &&
        balance.location.id === locationId
    );
  }

  return (
    <WriteModal
      title="Registrar movimiento"
      wide
      dirty={dirty}
      onClose={onClose}
      onSaved={onSaved}
      prepare={() => {
        if (
          !data.locations.some(
            (location) => location.id === locationId
          )
        ) {
          throw new Error("Selecciona una ubicación.");
        }

        const input = manualInputSchema.parse({
          locationId,
          movementType: type,
          returnKind: type === "RETURN" ? returnKind : null,
          externalReference: reference.trim() || null,
          notes: reason,
          lines: lines.map((line) => {
            const current = balance(line.inventoryItemId);

            if (
              !data.items.some(
                (item) =>
                  item.id === line.inventoryItemId && item.isActive
              )
            ) {
              throw new Error("Selecciona artículos activos.");
            }

            if (current && unvalued(current)) {
              throw new Error(
                "Primero valora la existencia del artículo."
              );
            }

            const needsCost =
              (!current || fixed(current.currentStock) === 0n) &&
              !current?.averageUnitCost;

            return {
              inventoryItemId: line.inventoryItemId,
              direction: direction(line),
              quantity: line.quantity,
              unitCost:
                direction(line) === "IN" && needsCost
                  ? line.unitCost
                  : null,
              notes: null,
            };
          }),
        });

        return {
          description: (
            <div className="grid gap-3">
              <p>
                {
                  data.locations.find(
                    (location) => location.id === locationId
                  )?.name
                }{" "}
                · {reason}
              </p>

              {input.lines.map((line) => {
                const item = data.items.find(
                  (item) => item.id === line.inventoryItemId
                )!;
                const before = balance(item.id)?.currentStock ?? "0";

                return (
                  <p key={item.id}>
                    {item.name}:{" "}
                    {line.direction === "IN" ? "Entrada" : "Salida"}{" "}
                    {quantity(line.quantity, item.baseUnit)}. Saldo
                    estimado:{" "}
                    {quantity(
                      line.direction === "IN"
                        ? add(before, line.quantity)
                        : subtract(before, line.quantity),
                      item.baseUnit
                    )}
                    .
                  </p>
                );
              })}

              <Notice>
                La API validará los saldos y costos al confirmar.
              </Notice>
            </div>
          ),
          save: (signal: AbortSignal) =>
            registerManual(session, signal, input),
        };
      }}
    >
      <LocationChoice
        dirty={dirty}
        label="Ubicación"
        value={locationId}
        onValueChange={touch(setLocation)}
        options={data.locations.map((location) => ({
          value: location.id,
          label: location.name + " · " + location.code,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          label="Tipo de movimiento"
          value={type}
          onValueChange={touch((value) =>
            setType(value as typeof type)
          )}
          options={[
            { value: "ADJUSTMENT", label: "Ajuste" },
            { value: "WASTE", label: "Desperdicio" },
            { value: "RETURN", label: "Devolución" },
          ]}
        />

        <Field
          label="Referencia (opcional)"
          value={reference}
          onChange={touch(setReference)}
          maxLength={120}
        />

        {type === "RETURN" && (
          <Choice
            label="Tipo de devolución"
            value={returnKind}
            onValueChange={touch((value) =>
              setReturn(value as typeof returnKind)
            )}
            options={[
              { value: "CUSTOMER_RETURN", label: "De cliente" },
              { value: "SUPPLIER_RETURN", label: "A proveedor" },
            ]}
          />
        )}
      </div>

      <Field
        label="Motivo obligatorio"
        value={reason}
        multiline
        onChange={touch(setReason)}
        maxLength={500}
      />

      {lines.map((line) => {
        const current = balance(line.inventoryItemId);
        const item = data.items.find(
          (item) => item.id === line.inventoryItemId
        );

        const needsCost =
          direction(line) === "IN" &&
          (!current || fixed(current.currentStock) === 0n) &&
          !current?.averageUnitCost;

        return (
          <div
            key={line.key}
            className="grid gap-3 border-b border-outline pb-4"
          >
            <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Choice
                label="Artículo"
                value={line.inventoryItemId}
                onValueChange={(value) =>
                  update(line.key, {
                    inventoryItemId: value,
                    unitCost: "",
                  })
                }
                options={data.items
                  .filter((item) => item.isActive)
                  .map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
              />

              <Choice
                label="Dirección"
                value={direction(line)}
                disabled={type !== "ADJUSTMENT"}
                onValueChange={(value) =>
                  update(line.key, {
                    direction: value as "IN" | "OUT",
                  })
                }
                options={[
                  { value: "IN", label: "Entrada" },
                  { value: "OUT", label: "Salida" },
                ]}
              />

              <Field
                label="Cantidad"
                value={line.quantity}
                decimal
                onChange={(value) =>
                  update(line.key, { quantity: value })
                }
              />

              <Button
                variant="soft"
                disabled={lines.length === 1}
                aria-label="Quitar línea"
                onClick={() => {
                  setDirty(true);
                  setLines((previous) =>
                    previous.filter((entry) => entry.key !== line.key)
                  );
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>

            {item && (
              <p className="text-sm text-muted">
                Disponible:{" "}
                {quantity(
                  current?.currentStock ?? "0",
                  item.baseUnit
                )}{" "}
                · Promedio:{" "}
                {cost(
                  current?.averageUnitCost ?? null,
                  item.baseUnit,
                  currency
                )}
              </p>
            )}

            {needsCost && (
              <Field
                label="Costo unitario de entrada obligatorio"
                value={line.unitCost}
                decimal
                onChange={(value) =>
                  update(line.key, { unitCost: value })
                }
              />
            )}
          </div>
        );
      })}

      <Button
        variant="soft"
        disabled={lines.length >= 100}
        onClick={() => {
          setDirty(true);
          setLines((previous) => [...previous, fresh()]);
        }}
      >
        <Plus size={16} />
        Agregar línea
      </Button>
    </WriteModal>
  );
}
