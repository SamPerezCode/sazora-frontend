import { useCallback, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import { readItem } from "../services/inventory-operations";
import {
  loadItemDetail,
  writeItem,
} from "../services/inventory-location.service";
import type {
  InventoryWorkspace,
  ItemWrite,
} from "../services/inventory-location.service";
import {
  editInputSchema,
  itemInputSchema,
  positive,
} from "../schemas/inventory-location.schema";
import {
  canValue,
  cost,
  fixed,
  money,
  multiply,
  physical,
  quantity,
  unvalued,
} from "../utils/inventory-value";
import {
  itemTypeLabels,
  unitLabels,
} from "../utils/inventory-format";
import {
  Choice,
  LocationChoice,
  DataTable,
  Field,
  Modal,
  Notice,
  StockBadge,
  WriteModal,
} from "./InventoryLocationUI";
import { Button } from "./InventoryButton";
import type { InventoryItem } from "../schemas/inventory.schema";

export type ItemAction = {
  kind:
    | "create"
    | "detail"
    | "edit"
    | "status"
    | "presentation"
    | "valuation";
  itemId?: string;
  locationId: string;
};

export function InventoryItemLocationDialog(props: {
  action: ItemAction;
  workspace: InventoryWorkspace;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return props.action.kind === "detail" ? (
    <Detail {...props} />
  ) : (
    <Editor {...props} />
  );
}

function Detail({
  action,
  currency,
  onClose,
}: Parameters<typeof InventoryItemLocationDialog>[0]) {
  const loader = useCallback(
    (session: AuthSession, signal: AbortSignal) =>
      loadItemDetail(session, signal, action.itemId!),
    [action.itemId]
  );

  const query = useInventoryQuery(
    "location-item:" + action.itemId,
    loader
  );

  const data = query.data;

  return (
    <Modal title="Detalle del artículo" onClose={onClose} wide>
      {query.pending && <p role="status">Cargando detalle…</p>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="soft" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {data && (
        <div className="grid gap-5">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Object.entries({
              Artículo: data.item.name,
              SKU: data.item.sku ?? "—",
              Tipo: itemTypeLabels[data.item.itemType],
              "Unidad base": unitLabels[data.item.baseUnit],
              Estado: data.item.isActive ? "Activo" : "Inactivo",
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <DataTable
            headers={[
              "Ubicación",
              "Existencia",
              "Mínimo local",
              "Costo promedio",
              "Valor",
              "Estado físico",
              "Valoración",
            ]}
          >
            {data.balances.map((balance) => (
              <tr key={balance.location.id}>
                <td>
                  {balance.location.name} · {balance.location.code}
                </td>
                <td>
                  {quantity(balance.currentStock, balance.baseUnit)}
                </td>
                <td>
                  {quantity(balance.minimumStock, balance.baseUnit)}
                </td>
                <td>
                  {cost(
                    balance.averageUnitCost,
                    balance.baseUnit,
                    currency
                  )}
                </td>
                <td>
                  {money(
                    fixed(balance.currentStock) === 0n
                      ? "0"
                      : balance.inventoryValue,
                    currency
                  )}
                </td>
                <td>
                  <StockBadge label={physical(balance)} />
                </td>
                <td>
                  {unvalued(balance)
                    ? "Sin valorar"
                    : fixed(balance.currentStock) === 0n
                      ? "Sin existencias"
                      : "Valorado"}
                </td>
              </tr>
            ))}
          </DataTable>

          {!data.balances.length && (
            <Notice>
              Este artículo todavía no tiene saldos por ubicación.
            </Notice>
          )}

          <h3 className="font-semibold">Presentaciones de compra</h3>

          <DataTable
            headers={["Nombre", "Factor", "Unidad base", "Estado"]}
          >
            {data.presentations.map((presentation) => (
              <tr key={presentation.id}>
                <td>{presentation.name}</td>
                <td>
                  {quantity(
                    presentation.conversionFactor,
                    presentation.baseUnit
                  )}
                </td>
                <td>{unitLabels[presentation.baseUnit]}</td>
                <td>
                  {presentation.isActive ? "Activa" : "Inactiva"}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </Modal>
  );
}

function Editor({
  action,
  workspace,
  currency,
  onClose,
  onSaved,
}: Parameters<typeof InventoryItemLocationDialog>[0]) {
  const { session } = useAppShell();

  const item = workspace.items.find(
    (item) => item.id === action.itemId
  );

  const [locationId, setLocation] = useState(action.locationId);

  const balance = workspace.balances.find(
    (balance) =>
      balance.inventoryItemId === item?.id &&
      balance.location.id === locationId
  );

  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");

  const [type, setType] = useState<InventoryItem["itemType"]>(
    item?.itemType ?? "RAW_MATERIAL"
  );

  const [base, setBase] = useState<InventoryItem["baseUnit"]>(
    item?.baseUnit ?? "KILOGRAM"
  );

  const [minimum, setMinimum] = useState(
    balance?.minimumStock ?? "0"
  );

  const [opening, setOpening] = useState("0");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [factor, setFactor] = useState("1");
  const [presentation, setPresentation] = useState("");
  const [dirty, setDirty] = useState(false);

  const touch =
    (setter: (value: string) => void) => (value: string) => {
      setDirty(true);
      setter(value);
    };

  const labels = {
    create: "Nuevo artículo",
    edit: "Editar artículo",
    status: item?.isActive
      ? "Desactivar artículo"
      : "Activar artículo",
    presentation: "Agregar presentación de compra",
    valuation: "Valorar existencia inicial",
    detail: "Detalle",
  };

  const locations = workspace.locations.filter(
    (location) =>
      action.kind !== "valuation" ||
      workspace.balances.some(
        (balance) =>
          balance.location.id === location.id &&
          balance.inventoryItemId === item?.id &&
          canValue(balance)
      )
  );

  const eligible = locations.some(
    (location) => location.id === locationId
  );

  const general = action.kind === "create" || action.kind === "edit";

  const prepare = () => {
    let operation: ItemWrite;

    if (general) {
      if (!eligible) {
        throw new Error(
          "Selecciona una ubicación activa habilitada para inventario."
        );
      }

      const body = {
        name,
        sku: sku.trim() || null,
        itemType: type,
        baseUnit: base,
        locationId,
        minimumStock: minimum,
      };

      operation =
        action.kind === "create"
          ? {
              kind: "create",
              body: itemInputSchema.parse({
                ...body,
                openingQuantity: opening,
                openingUnitCost: fixed(opening) === 0n ? null : price,
              }),
            }
          : {
              kind: "edit",
              itemId: item!.id,
              body: editInputSchema.parse(body),
            };
    } else if (action.kind === "valuation") {
      if (!eligible || !balance || !canValue(balance)) {
        throw new Error(
          "Selecciona un saldo heredado positivo sin valorar."
        );
      }

      positive.parse(price);

      if (reason.trim().length < 3) {
        throw new Error("Escribe el motivo de la valoración.");
      }

      operation = {
        kind: "valuation",
        itemId: item!.id,
        locationId,
        unitCost: price,
        reason,
      };
    } else if (action.kind === "presentation") {
      if (!presentation.trim()) {
        throw new Error("Escribe el nombre de la presentación.");
      }

      positive.parse(factor);

      operation = {
        kind: "presentation",
        itemId: item!.id,
        name: presentation,
        conversionFactor: factor,
      };
    } else {
      operation = {
        kind: "status",
        itemId: item!.id,
        isActive: !item!.isActive,
      };
    }

    return {
      description: (
        <div className="grid gap-3">
          <p>
            {labels[action.kind]}: {name || presentation}.
          </p>

          {(general || action.kind === "valuation") && (
            <p>
              Ubicación:{" "}
              {
                locations.find(
                  (location) => location.id === locationId
                )?.name
              }
              .
            </p>
          )}

          {general && <p>Mínimo local: {quantity(minimum, base)}.</p>}

          {action.kind === "create" && (
            <p>
              Existencia inicial: {quantity(opening, base)}. Costo:{" "}
              {cost(
                fixed(opening) > 0n ? price : null,
                base,
                currency
              )}
              .
            </p>
          )}

          {action.kind === "valuation" && balance && (
            <p>
              Valor resultante:{" "}
              {money(multiply(balance.currentStock, price), currency)}
              .
            </p>
          )}

          {action.kind === "presentation" && (
            <p>
              Una presentación equivale a {quantity(factor, base)}.
            </p>
          )}

          {action.kind === "status" && (
            <Notice>
              El historial, los saldos y los costos se conservan.
            </Notice>
          )}
        </div>
      ),
      save: async (signal: AbortSignal) => {
        if (item) {
          await readItem(item.id, session, signal);
        }

        return writeItem(session, signal, operation);
      },
    };
  };

  return (
    <WriteModal
      title={labels[action.kind]}
      dirty={dirty}
      prepare={prepare}
      onClose={onClose}
      onSaved={onSaved}
    >
      {item && (
        <p className="text-sm text-muted">
          {item.name} · {item.sku ?? "Sin SKU"}
        </p>
      )}

      {(general || action.kind === "valuation") && (
        <LocationChoice
          dirty={dirty}
          label="Ubicación"
          value={locationId}
          options={locations.map((location) => ({
            value: location.id,
            label: location.name + " · " + location.code,
          }))}
          onValueChange={touch((value) => {
            setLocation(value);
            setMinimum(
              workspace.balances.find(
                (balance) =>
                  balance.inventoryItemId === item?.id &&
                  balance.location.id === value
              )?.minimumStock ?? "0"
            );
          })}
        />
      )}

      {general && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nombre"
            value={name}
            onChange={touch(setName)}
            maxLength={150}
          />
          <Field
            label="SKU (opcional)"
            value={sku}
            onChange={touch(setSku)}
            maxLength={50}
          />
          <Choice
            label="Tipo"
            value={type}
            options={Object.entries(itemTypeLabels).map(
              ([value, label]) => ({ value, label })
            )}
            onValueChange={touch((value) =>
              setType(value as typeof type)
            )}
          />
          <Choice
            label="Unidad base"
            value={base}
            disabled={!!item}
            options={Object.entries(unitLabels).map(
              ([value, label]) => ({ value, label })
            )}
            onValueChange={touch((value) =>
              setBase(value as typeof base)
            )}
          />

          {action.kind === "create" && (
            <>
              <Field
                label="Existencia inicial"
                value={opening}
                decimal
                onChange={touch(setOpening)}
              />
              <Field
                label="Costo unitario inicial (si hay existencia)"
                value={price}
                decimal
                onChange={touch(setPrice)}
              />
            </>
          )}

          <Field
            label="Stock mínimo local"
            value={minimum}
            decimal
            onChange={touch(setMinimum)}
          />

          <p className="text-sm text-muted sm:col-span-2">
            El mínimo pertenece únicamente a la ubicación
            seleccionada.
          </p>
        </div>
      )}

      {action.kind === "presentation" && (
        <>
          <Notice>
            Las presentaciones existentes se consultan en Ver detalle.
            La API permite agregar nuevas presentaciones.
          </Notice>
          <Field
            label="Nombre"
            value={presentation}
            onChange={touch(setPresentation)}
            maxLength={120}
          />
          <Field
            label={"Factor en " + unitLabels[base]}
            value={factor}
            decimal
            onChange={touch(setFactor)}
          />
        </>
      )}

      {action.kind === "valuation" && (
        <>
          <p>
            Existencia actual:{" "}
            {balance
              ? quantity(balance.currentStock, base)
              : "Selecciona una ubicación"}
          </p>
          <Field
            label="Costo unitario"
            value={price}
            decimal
            onChange={touch(setPrice)}
          />
          <Field
            label="Motivo obligatorio"
            value={reason}
            multiline
            onChange={touch(setReason)}
            maxLength={500}
          />
          <Notice>
            La valoración asigna costo al saldo heredado y conserva su
            cantidad.
          </Notice>
        </>
      )}

      {action.kind === "status" && (
        <Notice>
          El cambio de estado afecta al artículo en todo el negocio.
        </Notice>
      )}
    </WriteModal>
  );
}
