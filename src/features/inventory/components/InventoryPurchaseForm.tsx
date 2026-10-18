import { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { DateField } from "../../../components/forms/DateField";
import { calendarToday } from "../../../components/forms/calendar-date";
import { Button } from "./InventoryButton";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  loadPresentations,
  registerPurchase,
} from "../services/inventory-location.service";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { purchaseInputSchema } from "../schemas/inventory-location.schema";
import type { Presentation } from "../schemas/inventory-location.schema";
import {
  add,
  cost,
  divide,
  fixed,
  money,
  quantity,
  baseQuantity as purchaseQuantity,
  subtract,
  unvalued,
} from "../utils/inventory-value";
import {
  Choice,
  LocationChoice,
  DataTable,
  Field,
  Notice,
  WriteModal,
} from "./InventoryLocationUI";

interface Line {
  key: string;
  inventoryItemId: string;
  presentation: Presentation | null;
  purchasedQuantity: string;
  grossCost: string;
  discountAmount: string;
  additionalCostAmount: string;
}

const newLine = (): Line => ({
  key: crypto.randomUUID(),
  inventoryItemId: "",
  presentation: null,
  purchasedQuantity: "1",
  grossCost: "",
  discountAmount: "0",
  additionalCostAmount: "0",
});

function estimate(
  line: Line,
  data: InventoryWorkspace,
  locationId: string
) {
  if (!line.presentation) {
    throw new Error("Selecciona una presentación.");
  }

  const baseQuantity = purchaseQuantity(
    line.purchasedQuantity,
    line.presentation.conversionFactor
  );

  if (fixed(baseQuantity) <= 0n) {
    throw new Error("La cantidad base debe ser mayor que cero.");
  }

  const net = add(
    subtract(line.grossCost, line.discountAmount),
    line.additionalCostAmount
  );

  const balance = data.balances.find(
    (balance) =>
      balance.location.id === locationId &&
      balance.inventoryItemId === line.inventoryItemId
  );

  if (
    balance &&
    (unvalued(balance) || fixed(balance.currentStock) < 0n)
  ) {
    throw new Error(
      "La ubicación tiene un saldo negativo o sin valorar. Resuélvelo antes de comprar."
    );
  }

  const before = balance?.currentStock ?? "0";
  const after = add(before, baseQuantity);
  const value = add(balance?.inventoryValue ?? "0", net);

  return {
    baseQuantity,
    net,
    before,
    after,
    unitCost: divide(net, baseQuantity),
    oldAverage: balance?.averageUnitCost ?? null,
    average: divide(value, after),
  };
}

export function InventoryPurchaseForm({
  data,
  initialLocationId,
  currency,
  timezone,
  onClose,
  onSaved,
}: {
  data: InventoryWorkspace;
  initialLocationId: string;
  currency: string;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAppShell();

  const [step, setStep] = useState(1);
  const [locationId, setLocation] = useState(initialLocationId);
  const [supplier, setSupplier] = useState("");
  const [document, setDocument] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(() => calendarToday(timezone));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const touch =
    (setter: (value: string) => void) => (value: string) => {
      setDirty(true);
      setter(value);
    };

  function input() {
    if (
      !data.locations.some((location) => location.id === locationId)
    ) {
      throw new Error("Selecciona una ubicación activa.");
    }

    if (
      lines.some(
        (line) =>
          !data.items.some(
            (item) =>
              item.id === line.inventoryItemId && item.isActive
          )
      )
    ) {
      throw new Error("Selecciona artículos activos.");
    }

    const result = purchaseInputSchema.parse({
      locationId,
      supplierName: supplier.trim() || null,
      supplierDocument: document.trim() || null,
      externalReference: reference.trim() || null,
      documentDate: date || null,
      notes: notes.trim() || null,
      lines: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        presentationId: line.presentation?.id ?? "",
        purchasedQuantity: line.purchasedQuantity,
        grossCost: line.grossCost,
        discountAmount: line.discountAmount,
        additionalCostAmount: line.additionalCostAmount,
        notes: null,
      })),
    });

    lines.forEach((line) => estimate(line, data, locationId));

    return result;
  }

  function next() {
    try {
      setError("");

      if (!locationId) {
        throw new Error("Selecciona una ubicación.");
      }

      if (step === 1 && document.trim() && !supplier.trim()) {
        throw new Error("Indica el nombre del proveedor.");
      }

      if (step === 2) input();

      setStep((previous) => Math.min(3, previous + 1));
    } catch (error) {
      setError(
        error instanceof Error
          ? "issues" in error
            ? "Revisa cantidades, presentación, costos y artículos repetidos."
            : error.message
          : "Revisa los datos."
      );
    }
  }

  const review = () => (
    <div className="grid gap-4">
      <p>
        {
          data.locations.find(
            (location) => location.id === locationId
          )?.name
        }{" "}
        · {supplier || "Sin proveedor"} ·{" "}
        {date || "Sin fecha documental"}
      </p>

      <Notice>
        Estimación con los saldos consultados. El servidor calcula los
        costos definitivos al registrar.
      </Notice>

      <DataTable
        headers={[
          "Artículo",
          "Presentaciones",
          "Cantidad base",
          "Bruto",
          "Descuento",
          "Adicionales",
          "Neto",
          "Saldo anterior",
          "Saldo resultante",
          "Costo / unidad",
          "Promedio anterior",
          "Promedio estimado",
        ]}
      >
        {lines.map((line) => {
          const item = data.items.find(
            (item) => item.id === line.inventoryItemId
          )!;
          const result = estimate(line, data, locationId);

          return (
            <tr key={line.key}>
              <td>{item.name}</td>
              <td>
                {line.purchasedQuantity} × {line.presentation!.name}
              </td>
              <td>{quantity(result.baseQuantity, item.baseUnit)}</td>
              <td>{money(line.grossCost, currency)}</td>
              <td>{money(line.discountAmount, currency)}</td>
              <td>{money(line.additionalCostAmount, currency)}</td>
              <td>{money(result.net, currency)}</td>
              <td>{quantity(result.before, item.baseUnit)}</td>
              <td>{quantity(result.after, item.baseUnit)}</td>
              <td>
                {cost(result.unitCost, item.baseUnit, currency)}
              </td>
              <td>
                {cost(result.oldAverage, item.baseUnit, currency)}
              </td>
              <td>{cost(result.average, item.baseUnit, currency)}</td>
            </tr>
          );
        })}
      </DataTable>

      <strong>
        Costo neto total:{" "}
        {money(
          add(
            ...lines.map(
              (line) => estimate(line, data, locationId).net
            )
          ),
          currency
        )}
      </strong>
    </div>
  );

  return (
    <WriteModal
      title="Registrar compra"
      wide
      dirty={dirty}
      onClose={onClose}
      onSaved={onSaved}
      onContinue={step < 3 ? next : undefined}
      onBack={
        step > 1
          ? () => {
              setError("");
              setStep((previous) => previous - 1);
            }
          : undefined
      }
      submitLabel="Registrar compra"
      prepare={() => {
        const body = input();

        return {
          description: (
            <p>
              La compra quedará registrada en{" "}
              {
                data.locations.find(
                  (location) => location.id === locationId
                )?.name
              }
              . Los saldos y costos se actualizarán juntos.
            </p>
          ),
          save: (signal: AbortSignal) =>
            registerPurchase(session, signal, body),
        };
      }}
    >
      <p className="text-sm text-muted">
        Paso {step} de 3 ·{" "}
        {step === 1
          ? "Información documental"
          : step === 2
            ? "Líneas de compra"
            : "Revisión"}
      </p>

      {step === 1 && (
        <>
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
            <Field
              label="Proveedor"
              value={supplier}
              onChange={touch(setSupplier)}
              maxLength={160}
            />
            <Field
              label="Documento del proveedor"
              value={document}
              onChange={touch(setDocument)}
              maxLength={80}
            />
            <Field
              label="Referencia o número de factura"
              value={reference}
              onChange={touch(setReference)}
              maxLength={120}
            />
            <DateField
              label="Fecha del documento"
              value={date}
              timeZone={timezone}
              onValueChange={touch(setDate)}
            />
          </div>

          <Field
            label="Notas"
            value={notes}
            multiline
            onChange={touch(setNotes)}
            maxLength={500}
          />
        </>
      )}

      {step === 2 && (
        <>
          {lines.map((line, index) => (
            <PurchaseLine
              key={line.key}
              line={line}
              index={index}
              data={data}
              locationId={locationId}
              currency={currency}
              onChange={(patch) => {
                setDirty(true);
                setLines((previous) =>
                  previous.map((entry) =>
                    entry.key === line.key
                      ? { ...entry, ...patch }
                      : entry
                  )
                );
              }}
              onRemove={
                lines.length > 1
                  ? () => {
                      setDirty(true);
                      setLines((previous) =>
                        previous.filter(
                          (entry) => entry.key !== line.key
                        )
                      );
                    }
                  : undefined
              }
            />
          ))}

          <Button
            variant="soft"
            disabled={lines.length >= 100}
            onClick={() => {
              setDirty(true);
              setLines((previous) => [...previous, newLine()]);
            }}
          >
            <Plus size={16} />
            Agregar línea
          </Button>
        </>
      )}

      {step === 3 && review()}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </WriteModal>
  );
}

function PurchaseLine({
  line,
  index,
  data,
  locationId,
  currency,
  onChange,
  onRemove,
}: {
  line: Line;
  index: number;
  data: InventoryWorkspace;
  locationId: string;
  currency: string;
  onChange: (patch: Partial<Line>) => void;
  onRemove?: () => void;
}) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      line.inventoryItemId
        ? loadPresentations(session, signal, line.inventoryItemId)
        : Promise.resolve([]),
    [line.inventoryItemId]
  );

  const query = useInventoryQuery(
    "purchase-presentations:" + line.inventoryItemId,
    loader
  );

  let calculated: ReturnType<typeof estimate> | null = null;

  try {
    calculated = estimate(line, data, locationId);
  } catch {
    // Campos todavía incompletos.
  }

  const item = data.items.find(
    (item) => item.id === line.inventoryItemId
  );

  return (
    <section className="grid gap-4 border-b border-outline pb-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Línea {index + 1}</h3>

        <Button
          variant="soft"
          disabled={!onRemove}
          aria-label={"Quitar línea " + (index + 1)}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Choice
          label="Artículo"
          value={line.inventoryItemId}
          onValueChange={(value) =>
            onChange({
              inventoryItemId: value,
              presentation: null,
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
          label="Presentación"
          value={line.presentation?.id ?? ""}
          disabled={!item || query.pending || !!query.error}
          options={(query.data ?? [])
            .filter((presentation) => presentation.isActive)
            .map((presentation) => ({
              value: presentation.id,
              label: presentation.name,
            }))}
          onValueChange={(value) =>
            onChange({
              presentation:
                query.data?.find(
                  (presentation) => presentation.id === value
                ) ?? null,
            })
          }
        />

        <Field
          label="Cantidad de presentaciones"
          value={line.purchasedQuantity}
          decimal
          onChange={(value) => onChange({ purchasedQuantity: value })}
        />

        <Field
          label="Factor de conversión"
          value={line.presentation?.conversionFactor ?? ""}
          disabled
          onChange={() => {}}
        />

        <Field
          label="Costo bruto"
          value={line.grossCost}
          decimal
          onChange={(value) => onChange({ grossCost: value })}
        />

        <Field
          label="Descuento"
          value={line.discountAmount}
          decimal
          onChange={(value) => onChange({ discountAmount: value })}
        />

        <Field
          label="Costos adicionales"
          value={line.additionalCostAmount}
          decimal
          onChange={(value) =>
            onChange({ additionalCostAmount: value })
          }
        />
      </div>

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="soft" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {item &&
        !query.pending &&
        !query.error &&
        !query.data?.some(
          (presentation) => presentation.isActive
        ) && (
          <Notice>
            Agrega una presentación desde Existencias antes de comprar
            este artículo. Para unidad base, crea una con factor 1.
          </Notice>
        )}

      {calculated && item && (
        <div className="grid gap-3 rounded-xl bg-secondary/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            Cantidad base
            <br />
            <strong>
              {quantity(calculated.baseQuantity, item.baseUnit)}
            </strong>
          </p>
          <p>
            Costo neto
            <br />
            <strong>{money(calculated.net, currency)}</strong>
          </p>
          <p>
            Costo de compra / unidad
            <br />
            <strong>
              {cost(calculated.unitCost, item.baseUnit, currency)}
            </strong>
          </p>
          <p>
            Promedio estimado
            <br />
            <strong>
              {cost(calculated.average, item.baseUnit, currency)}
            </strong>
          </p>
        </div>
      )}
    </section>
  );
}
