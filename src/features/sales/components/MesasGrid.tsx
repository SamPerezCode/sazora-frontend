import { Users } from "lucide-react";

import type { SalesTable } from "../services/sales.service";
import type { OrderSummary } from "../schemas/sales.schema";

import { cents, money } from "../schemas/sales.schema";
import { OrderStatusBadge } from "./OrderStatusBadge";

type Entry = {
  table: SalesTable;
  order?: OrderSummary;
};

type Props = {
  entries: Entry[];
  loading?: boolean;
  compact?: boolean;
  disabled: (entry: Entry) => boolean;
  onOpen: (id: string) => void;
  pendingCount?: (id: string) => number;
  emptyText?: string;
};

const grid =
  "grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

function MesaGrafico({
  table,
  occupied,
  compact,
}: {
  table: SalesTable;
  occupied: boolean;
  compact: boolean;
}) {
  const number =
    table.name.match(/\d+$/)?.[0] ??
    table.code.match(/\d+$/)?.[0] ??
    table.code;

  return (
    <span
      aria-hidden="true"
      className={
        "mesa-graphic motion-safe:transition-transform motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:scale-105 motion-safe:group-active:scale-95 " +
        (occupied ? "mesa-graphic-occupied" : "mesa-graphic-free") +
        (compact ? " mesa-graphic-compact" : "")
      }
    >
      <span className="mesa-seat mesa-seat-top" />
      <span className="mesa-seat mesa-seat-bottom" />
      <span className="mesa-seat mesa-seat-left" />
      <span className="mesa-seat mesa-seat-right" />

      <span className="mesa-top">
        <small>MESA</small>
        <strong>{number}</strong>
      </span>
    </span>
  );
}

export function MesasGrid({
  entries,
  loading = false,
  compact = false,
  disabled,
  onOpen,
  pendingCount,
  emptyText = "Prueba otro filtro para consultar las mesas del salón.",
}: Props) {
  if (loading) {
    return (
      <div className={grid} role="status" aria-label="Cargando mesas">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-72 rounded-lg bg-secondary motion-safe:animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="mp-empty" role="status">
        <strong>
          {compact
            ? "No hay mesas libres"
            : "No hay mesas para mostrar"}
        </strong>

        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={grid}>
      {entries.map((entry) => {
        const { table, order } = entry;

        const inactive = table.continuityOnly || !table.isActive;

        const pending = order ? (pendingCount?.(order.id) ?? 0) : 0;

        const people = order?.customerCount;

        const description =
          people != null
            ? people + (people === 1 ? " persona" : " personas")
            : table.capacity != null
              ? table.capacity +
                (table.capacity === 1 ? " lugar" : " lugares")
              : "Capacidad no indicada";

        return (
          <button
            key={table.id}
            type="button"
            disabled={disabled(entry)}
            onClick={() => onOpen(table.id)}
            aria-label={
              table.name +
              " · " +
              (compact || !order ? "Abrir mesa" : "Ver cuenta")
            }
            className={
              "mesa-option group flex min-w-0 flex-col items-start rounded-none border-0 bg-transparent p-3 text-heading shadow-none " +
              (compact ? "min-h-36" : "min-h-64")
            }
          >
            <span className="mesa-content">
              {!compact && (
                <OrderStatusBadge status={order?.status ?? "FREE"} />
              )}

              <MesaGrafico
                table={table}
                occupied={!!order}
                compact={compact}
              />

              {compact ? (
                <>
                  <strong className="mesa-name">{table.name}</strong>

                  <span className="mesa-free-caption">
                    <span aria-hidden="true">●</span> Libre ·{" "}
                    {description}
                  </span>
                </>
              ) : (
                <>
                  <span className="mesa-name">{table.name}</span>

                  <span className="mesa-caption">
                    {!order
                      ? "Sin cuenta activa"
                      : order.status === "OPEN"
                        ? "Cuenta sin enviar"
                        : "Cuenta activa"}
                  </span>

                  <strong
                    className={
                      "mesa-amount" +
                      (!order ? " mesa-free-caption" : "")
                    }
                  >
                    {order
                      ? money(cents(order.subtotal))
                      : "Disponible"}
                  </strong>

                  {inactive && (
                    <span className="mesa-warning">
                      Mesa inactiva · finalizar cuenta
                    </span>
                  )}

                  <span className="mesa-people">
                    <Users size={15} aria-hidden="true" />
                    {description}
                  </span>

                  {pending > 0 && (
                    <span className="mesa-caption">
                      {pending} por enviar
                    </span>
                  )}

                  {order?.status === "CONFIRMED" && (
                    <span className="mesa-caption">
                      {order.kitchenWorkflowMode === "PRINT_ONLY"
                        ? "Solo comandas impresas"
                        : order.kitchenWorkflowMode ===
                            "PRINT_AND_SCREEN"
                          ? "Seguimiento en cocina"
                          : "Modo de cocina no disponible"}
                    </span>
                  )}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
