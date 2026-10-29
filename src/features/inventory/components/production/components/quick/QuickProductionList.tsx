import type { ReactNode } from "react";

import type {
  QuickProduction,
  QuickProductionSummary,
  QuickProductionLine,
} from "../../schemas/quick-production.schemas";

import {
  quickDate,
  quickLineText,
  quickCost,
} from "../../utils/quick-production.utils";

import { cash } from "../../utils/production.utils";

interface Props {
  rows: QuickProductionSummary[];
  details: QuickProduction[];
  pending: boolean;
  currency: string;
  zone: string;
  onOpen: (id: string) => void;
}

function LinesPreview({
  lines,
  noun,
}: {
  lines: QuickProductionLine[];
  noun: string;
}) {
  if (!lines.length) return <span>—</span>;

  return (
    <div className="min-w-0">
      <p>{quickLineText(lines[0])}</p>

      {lines.length > 1 && (
        <p className="mt-1 text-muted">
          +{lines.length - 1} {noun}
        </p>
      )}
    </div>
  );
}

export function QuickProductionList({
  rows,
  details,
  pending,
  currency,
  zone,
  onOpen,
}: Props) {
  const records = rows.map((row) => {
    const detail = details.find((item) => item.id === row.id);

    const fallback = pending ? "Cargando…" : "Consulta el detalle";

    const fields: {
      label: string;
      value: ReactNode;
    }[] = [
      {
        label: "Fecha",
        value: quickDate(row.createdAt, zone),
      },
      {
        label: "Planta",
        value: row.location?.name ?? "Sin ubicación",
      },
      {
        label: "Insumos",
        value: detail ? (
          <LinesPreview
            lines={detail.lines.filter(
              (line) => line.direction === "OUT"
            )}
            noun="insumos"
          />
        ) : (
          fallback
        ),
      },
      {
        label: "Resultados",
        value: detail ? (
          <LinesPreview
            lines={detail.lines.filter(
              (line) => line.direction === "IN"
            )}
            noun="resultados"
          />
        ) : (
          fallback
        ),
      },
      {
        label: "Costo trasladado",
        value: detail ? cash(quickCost(detail), currency) : fallback,
      },
      {
        label: "Movimiento",
        value: "M-" + row.id,
      },
      {
        label: "Responsable",
        value: row.createdByName,
      },
    ];

    return {
      id: row.id,
      fields,
    };
  });

  function detailButton(id: string) {
    return (
      <button
        type="button"
        onClick={() => onOpen(id)}
        aria-label={"Ver detalle de producción P-" + id}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-medium text-heading hover:bg-secondary focus-visible:outline-2 focus-visible:outline-accent"
      >
        Ver detalle
      </button>
    );
  }

  return (
    <div className="min-w-0">
      <ul
        aria-label="Producciones rápidas"
        className="grid min-w-0 list-none gap-3 p-0 md:hidden"
      >
        {records.map((row) => (
          <li
            key={row.id}
            className="min-w-0 rounded-2xl border border-outline bg-surface p-4 shadow-sm dark:shadow-none"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                P-{row.id}
              </span>

              {detailButton(row.id)}
            </div>

            <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs leading-[18px]">
              {row.fields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-muted">{field.label}</dt>

                  <dd className="m-0 min-w-0 font-medium [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div
        role="region"
        aria-label="Tabla de producciones rápidas"
        tabIndex={0}
        className="hidden min-w-0 max-w-full overflow-x-auto rounded-xl border border-outline bg-surface focus-visible:outline-2 focus-visible:outline-accent md:block"
      >
        <table className="w-full min-w-[1120px] table-fixed text-left text-xs leading-4">
          <caption className="sr-only">Producciones rápidas</caption>

          <colgroup>
            {[104, 136, 144, 184, 184, 124, 112, 112, 100].map(
              (width, index) => (
                <col key={index} style={{ width }} />
              )
            )}
          </colgroup>

          <thead className="bg-secondary/40 text-muted">
            <tr>
              {[
                "Producción",
                "Fecha",
                "Planta",
                "Insumos",
                "Resultados",
                "Costo trasladado",
                "Movimiento",
                "Responsable",
                "Acciones",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-3 py-3 font-normal"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {records.map((row) => (
              <tr
                key={row.id}
                className="h-16 border-t border-outline [&>td]:px-3 [&>td]:py-2 [&>td]:align-middle [&>td]:[overflow-wrap:anywhere]"
              >
                <td>P-{row.id}</td>

                {row.fields.map((field) => (
                  <td key={field.label}>{field.value}</td>
                ))}

                <td>{detailButton(row.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
