import { useId, useState } from "react";
import {
  CircleCheck,
  CircleSlash,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { TextField } from "../../../components/forms/TextField";
import { ActionMenu } from "../../../components/ui/ActionMenu";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import type { RestaurantTable } from "../schemas/restaurant-table.schema";

interface Props {
  tables: readonly RestaurantTable[];
  disabled: boolean;
  onCreate: () => void;
  onEdit: (table: RestaurantTable) => void;
  onToggle: (table: RestaurantTable) => void;
}

function TableStatus({ active }: { active: boolean }) {
  const Icon = active ? CircleCheck : CircleSlash;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-heading">
      <Icon
        aria-hidden="true"
        size={14}
        className={active ? "text-accent" : "text-muted"}
      />
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function RestaurantTableList({
  tables,
  disabled,
  onCreate,
  onEdit,
  onToggle,
}: Props) {
  const [query, setQuery] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listId = useId();
  const summaryId = useId();

  const words = normalize(query).trim().split(/\s+/).filter(Boolean);

  const filtered = tables.filter((table) => {
    const text = normalize(table.code + " " + table.name);
    return words.every((word) => text.includes(word));
  });

  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(filtered.length / pageSize))
  );

  const visible = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  function actions(table: RestaurantTable) {
    return (
      <ActionMenu
        label={"Acciones de " + table.name}
        disabled={disabled}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil aria-hidden="true" size={16} />,
            onSelect: () => onEdit(table),
          },
          {
            id: "status",
            label: table.isActive ? "Desactivar" : "Activar",
            icon: table.isActive ? (
              <ToggleRight aria-hidden="true" size={20} />
            ) : (
              <ToggleLeft aria-hidden="true" size={20} />
            ),
            onSelect: () => onToggle(table),
          },
        ]}
      />
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full min-w-0 sm:max-w-[22.5rem]">
          <TextField
            type="search"
            label="Buscar mesas"
            icon={Search}
            placeholder="Código o nombre"
            value={query}
            aria-controls={listId}
            aria-describedby={summaryId}
            onChange={(event) => {
              setQuery(event.target.value);
              setRequestedPage(1);
            }}
          />
        </div>

        <Button
          size="sm"
          className="self-end whitespace-nowrap"
          disabled={disabled}
          onClick={onCreate}
        >
          <Plus aria-hidden="true" size={16} />
          Nueva mesa
        </Button>
      </div>

      <div
        id={listId}
        className="rounded-xl border border-outline/60 bg-surface/50"
      >
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {tables.length === 0
              ? "Todavía no tienes mesas registradas."
              : "No encontramos mesas con esa búsqueda."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">
                  Mesas del negocio
                </caption>

                <colgroup>
                  <col className="w-[20%]" />
                  <col />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-24" />
                </colgroup>

                <thead className="border-b border-outline/60 bg-secondary/30">
                  <tr>
                    {[
                      "Código",
                      "Nombre",
                      "Capacidad",
                      "Estado",
                      "Acciones",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-4 py-3 text-[0.6875rem] font-medium uppercase text-muted"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline/40">
                  {visible.map((table) => (
                    <tr
                      key={table.id}
                      className="hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3 text-xs text-muted [overflow-wrap:anywhere]">
                        {table.code}
                      </td>

                      <th
                        scope="row"
                        className="px-4 py-3 font-semibold text-heading [overflow-wrap:anywhere]"
                      >
                        {table.name}
                      </th>

                      <td className="px-4 py-3 text-xs text-muted">
                        {table.capacity ?? "Sin definir"}
                      </td>

                      <td className="px-4 py-3">
                        <TableStatus active={table.isActive} />
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex justify-center">
                          {actions(table)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-outline/40 px-3 lg:hidden">
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

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">
                      Capacidad:{" "}
                      {table.capacity == null
                        ? "sin definir"
                        : table.capacity + " personas"}
                    </p>

                    <TableStatus active={table.isActive} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p
        id={summaryId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-center text-xs text-muted sm:text-left"
      >
        {words.length > 0 ? filtered.length + " resultados · " : ""}
        Total: {tables.length}{" "}
        {tables.length === 1 ? "mesa" : "mesas"}
      </p>

      {tables.length > 10 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          itemLabel={filtered.length === 1 ? "mesa" : "mesas"}
          controlsId={listId}
          disabled={disabled}
          onPageChange={setRequestedPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setRequestedPage(1);
          }}
        />
      )}
    </div>
  );
}
