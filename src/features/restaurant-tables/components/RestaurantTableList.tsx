import { useId, useState } from "react";
import {
  Pencil,
  Power,
  RotateCcw,
  Store,
  TriangleAlert,
} from "lucide-react";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Pagination } from "../../../components/ui/Pagination";
import {
  tableCapacityLabel,
  tableLocationLabel,
} from "../schemas/restaurant-table.schema";
import type { RestaurantTable } from "../schemas/restaurant-table.schema";

interface Props {
  tables: readonly RestaurantTable[];
  disabled: boolean;
  onEdit: (table: RestaurantTable) => void;
  onToggle: (table: RestaurantTable) => void;
}

function TableStatus({ active }: { active: boolean }) {
  return (
    <span className="rt-status" data-active={active}>
      <span aria-hidden="true">●</span>
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function PointOfSale({ table }: { table: RestaurantTable }) {
  return (
    <div>
      <div className="rt-location">
        <Store size={14} aria-hidden="true" />

        <span>
          {tableLocationLabel(table.location.name)}{" "}
          <span className="text-muted">· {table.location.code}</span>
        </span>

        {!table.location.isActive && (
          <span className="rt-location-inactive">
            <TriangleAlert size={12} aria-hidden="true" />
            Inactiva
          </span>
        )}
      </div>

      {!table.location.isActive && (
        <p className="rt-location-help">
          Esta mesa no está disponible para la operación porque su
          punto de venta está inactivo.
        </p>
      )}
    </div>
  );
}

export function RestaurantTableList({
  tables,
  disabled,
  onEdit,
  onToggle,
}: Props) {
  const listId = useId();

  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(tables.length / pageSize))
  );

  const visible = tables.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  function actions(table: RestaurantTable) {
    return (
      <ActionMenu
        appearance="compact"
        label={"Acciones de " + table.name}
        disabled={disabled}
        actions={[
          {
            id: "edit",
            label: "Editar mesa",
            icon: <Pencil size={16} aria-hidden="true" />,
            onSelect: () => onEdit(table),
          },
          {
            id: "status",
            label: table.isActive
              ? "Desactivar mesa"
              : "Reactivar mesa",
            danger: table.isActive,
            icon: table.isActive ? (
              <Power size={16} aria-hidden="true" />
            ) : (
              <RotateCcw size={16} aria-hidden="true" />
            ),
            onSelect: () => onToggle(table),
          },
        ]}
      />
    );
  }

  return (
    <div id={listId}>
      <div className="rt-table-scroll hidden md:block">
        <table className="rt-table">
          <caption className="sr-only">
            Mesas por punto de venta
          </caption>

          <colgroup>
            <col className="rt-col-code" />
            <col className="rt-col-name" />
            <col />
            <col className="rt-col-capacity" />
            <col className="rt-col-status" />
            <col className="rt-col-actions" />
          </colgroup>

          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Nombre</th>
              <th scope="col">Punto de venta</th>
              <th scope="col">Capacidad</th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {visible.map((table) => (
              <tr key={table.id}>
                <td className="rt-code">{table.code}</td>

                <th scope="row">{table.name}</th>

                <td>
                  <PointOfSale table={table} />
                </td>

                <td className="text-muted">
                  {tableCapacityLabel(table.capacity)}
                </td>

                <td>
                  <TableStatus active={table.isActive} />
                </td>

                <td className="rt-actions">{actions(table)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-outline/40 px-3 md:hidden">
        {visible.map((table) => (
          <li key={table.id} className="py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading [overflow-wrap:anywhere]">
                  {table.name}
                </p>

                <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
                  {table.code}
                </p>
              </div>

              {actions(table)}
            </div>

            <div className="mt-3">
              <PointOfSale table={table} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Capacidad: {tableCapacityLabel(table.capacity)}
              </p>

              <TableStatus active={table.isActive} />
            </div>
          </li>
        ))}
      </ul>

      {tables.length > 10 && (
        <div className="rt-pagination">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={tables.length}
            itemLabel={tables.length === 1 ? "mesa" : "mesas"}
            controlsId={listId}
            disabled={disabled}
            onPageChange={setRequestedPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setRequestedPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
