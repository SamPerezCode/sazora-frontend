import type { ReactNode } from "react";
import { StatusBadge } from "../shared/ProductionUI";
import type { Status } from "../../types/production.types";

export interface ProductionOrderRecord {
  id: string;
  number: string;
  recipeName: string;
  recipeCode: string;
  plantName: string;
  plantCode: string;
  status: Status;
  plannedDate: string;
  responsible: string;
  products: string;
  producedValue: string;
  actions: ReactNode;
}

interface Props {
  rows: ProductionOrderRecord[];
  onOpen: (id: string) => void;
}

const columns = [
  { label: "Orden", width: 112 },
  { label: "Receta", width: 152 },
  { label: "Planta", width: 112 },
  { label: "Estado", width: 112 },
  { label: "Fecha prevista", width: 112 },
  { label: "Responsable", width: 112 },
  { label: "Productos esperados", width: 192 },
  { label: "Valor producido", width: 112 },
  { label: "Acciones", width: 84 },
];

function OrderLink({
  row,
  onOpen,
}: {
  row: ProductionOrderRecord;
  onOpen: Props["onOpen"];
}) {
  return (
    <button
      type="button"
      aria-label={"Ver detalle de " + row.number}
      onClick={() => onOpen(row.id)}
      className="inline-flex min-h-11 max-w-full items-center rounded-md text-left text-sm font-semibold text-heading underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:text-accent [overflow-wrap:anywhere]"
    >
      {row.number}
    </button>
  );
}

function OrderActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end [&_[data-action-trigger]>svg]:rotate-90">
      {children}
    </div>
  );
}

export function ProductionOrderRecords({ rows, onOpen }: Props) {
  if (!rows.length) return null;

  return (
    <div className="min-w-0 max-w-full">
      <ul
        aria-label="Órdenes de producción"
        className="m-0 grid min-w-0 list-none gap-3 p-0 md:hidden"
      >
        {rows.map((row) => {
          const fields = [
            { label: "Receta", value: row.recipeName },
            { label: "Planta", value: row.plantName },
            { label: "Fecha prevista", value: row.plannedDate },
            { label: "Responsable", value: row.responsible },
            { label: "Productos", value: row.products },
            ...(row.status === "COMPLETED"
              ? [
                  {
                    label: "Valor producido",
                    value: row.producedValue,
                  },
                ]
              : []),
          ];

          return (
            <li
              key={row.id}
              className="min-w-0 rounded-2xl border border-outline bg-surface p-4"
            >
              <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                <OrderLink row={row} onOpen={onOpen} />

                <div className="shrink-0">
                  <StatusBadge status={row.status} />
                </div>
              </div>

              <dl className="m-0 grid min-w-0 gap-1 text-xs leading-[18px]">
                {fields.map((field) => (
                  <div
                    key={field.label}
                    className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-3"
                  >
                    <dt className="min-w-0 text-muted">
                      {field.label}
                    </dt>

                    <dd className="m-0 min-w-0 text-right font-medium text-heading [overflow-wrap:anywhere]">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 border-t border-outline pt-1">
                <OrderActions>{row.actions}</OrderActions>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden min-w-0 md:block">
        <div
          role="region"
          aria-label="Tabla de órdenes de producción"
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-xl border border-outline bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <table className="w-full min-w-[1100px] table-fixed text-left text-xs leading-4 text-heading">
            <caption className="sr-only">
              Órdenes de producción
            </caption>

            <colgroup>
              {columns.map((column) => (
                <col
                  key={column.label}
                  style={{ width: column.width }}
                />
              ))}
            </colgroup>

            <thead className="bg-secondary/40 text-muted">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className="px-3 py-3 font-normal"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-16 border-t border-outline [&>td]:px-3 [&>td]:py-2 [&>td]:align-middle [&>td]:[overflow-wrap:anywhere]"
                >
                  <td>
                    <OrderLink row={row} onOpen={onOpen} />
                  </td>

                  <td>
                    <div>{row.recipeName}</div>
                    <div className="mt-1 text-muted">
                      {row.recipeCode}
                    </div>
                  </td>

                  <td>
                    {row.plantName} · {row.plantCode}
                  </td>

                  <td>
                    <StatusBadge status={row.status} />
                  </td>

                  <td>{row.plannedDate}</td>
                  <td>{row.responsible}</td>
                  <td>{row.products}</td>
                  <td>{row.producedValue}</td>

                  <td>
                    <OrderActions>{row.actions}</OrderActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
