import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Button } from "../../components/ui/Button";
import type { Pagination } from "./reports.schema";
import { number } from "./reports.format";

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rp-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rp-notice">
      <Info size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rp-empty" role="status">
      {children}
    </p>
  );
}

export function Metrics({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    help?: string;
  }[];
}) {
  return (
    <div className="rp-metrics">
      {items.map((item) => (
        <div className="rp-card rp-metric" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.help && <small>{item.help}</small>}
        </div>
      ))}
    </div>
  );
}

export function Ranking({
  items,
}: {
  items: {
    id: string;
    label: string;
    value: number;
    display: string;
    help: string;
  }[];
}) {
  const maximum = Math.max(1, ...items.map((item) => item.value));

  return items.length ? (
    <ul className="rp-ranking">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <span>{item.label}</span>
            <span>{item.display}</span>
          </div>

          <div className="rp-track" aria-hidden="true">
            <span
              style={{
                width: `${Math.max(
                  0,
                  (item.value / maximum) * 100
                )}%`,
              }}
            />
          </div>

          <small>{item.help}</small>
        </li>
      ))}
    </ul>
  ) : (
    <Empty>Sin registros para este período.</Empty>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="rp-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Tabla del informe"
    >
      <table className="rp-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({
  pagination: p,
  onPage,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
}) {
  return (
    <div className="rp-pager">
      <span>
        {p.total === 0
          ? "Sin registros"
          : `Mostrando ${number(
              (p.page - 1) * p.pageSize + 1
            )}–${number(
              Math.min(p.page * p.pageSize, p.total)
            )} de ${number(p.total)}`}
      </span>

      <div>
        <Button
          variant="soft"
          size="sm"
          disabled={p.page <= 1}
          onClick={() => onPage(p.page - 1)}
        >
          Anterior
        </Button>

        <span>
          {p.page} / {Math.max(1, p.totalPages)}
        </span>

        <Button
          variant="soft"
          size="sm"
          disabled={p.page >= p.totalPages}
          onClick={() => onPage(p.page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div
      className="rp-skeleton"
      role="status"
      aria-label="Cargando informe"
    >
      <div className="rp-metrics" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} />
        ))}
      </div>

      <div className="rp-grid" aria-hidden="true">
        <div />
        <div />
      </div>
    </div>
  );
}
