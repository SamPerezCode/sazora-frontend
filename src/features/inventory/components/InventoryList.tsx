import { Ban, CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { InventoryItem } from "../schemas/inventory.schema";
import {
  formatQuantity,
  itemTypeLabels,
  stockLabels,
  unitLabels,
} from "../utils/inventory-format";
import { InventoryActions } from "./InventoryActions";
import type { InventoryAction } from "./InventoryActions";

interface Props {
  items: InventoryItem[];
  onAction: (action: InventoryAction, item: InventoryItem) => void;
}

function StockBadge({ item }: { item: InventoryItem }) {
  const state = !item.isActive ? "INACTIVE" : item.stockStatus;

  const Icon =
    state === "INACTIVE"
      ? Ban
      : state === "OUT_OF_STOCK"
        ? CircleX
        : state === "LOW_STOCK"
          ? CircleAlert
          : CircleCheck;

  return (
    <span className="inventory-badge" data-state={state}>
      <Icon size={13} aria-hidden="true" />

      {state === "INACTIVE" ? "Inactivo" : stockLabels[state]}
    </span>
  );
}

export function InventoryList({ items, onAction }: Props) {
  return (
    <div id="inventory-results">
      <div className="inventory-desktop">
        <table className="inventory-table">
          <caption className="sr-only">
            Existencias de inventario
          </caption>

          <thead>
            <tr>
              <th scope="col">Artículo</th>
              <th scope="col">SKU</th>
              <th scope="col">Tipo</th>
              <th scope="col">Unidad</th>

              <th scope="col" className="inventory-number">
                Stock actual
              </th>

              <th scope="col" className="inventory-number">
                Stock mínimo
              </th>

              <th scope="col">Estado</th>

              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                data-inactive={!item.isActive || undefined}
              >
                <td>
                  <strong>{item.name}</strong>
                </td>

                <td className="inventory-muted">{item.sku || "—"}</td>

                <td>{itemTypeLabels[item.itemType]}</td>
                <td>{unitLabels[item.baseUnit]}</td>

                <td className="inventory-number">
                  <strong>{formatQuantity(item.currentStock)}</strong>
                </td>

                <td className="inventory-number inventory-muted">
                  {formatQuantity(item.minimumStock)}
                </td>

                <td>
                  <StockBadge item={item} />
                </td>

                <td>
                  <InventoryActions item={item} onAction={onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="inventory-mobile">
        {items.map((item) => (
          <li
            key={item.id}
            className="inventory-card"
            data-inactive={!item.isActive || undefined}
          >
            <header>
              <div>
                <strong>{item.name}</strong>
                <p>{item.sku || "Sin SKU"}</p>
              </div>

              <InventoryActions item={item} onAction={onAction} />
            </header>

            <p>
              {itemTypeLabels[item.itemType]}
              {" · "}
              {unitLabels[item.baseUnit]}
            </p>

            <dl>
              <div>
                <dt>Stock actual</dt>
                <dd>{formatQuantity(item.currentStock)}</dd>
              </div>

              <div>
                <dt>Stock mínimo</dt>
                <dd>{formatQuantity(item.minimumStock)}</dd>
              </div>
            </dl>

            <footer>
              <StockBadge item={item} />
            </footer>
          </li>
        ))}
      </ul>
    </div>
  );
}
