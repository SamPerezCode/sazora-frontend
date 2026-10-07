import {
  Circle,
  CircleCheck,
  Flame,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { useKitchen } from "../hooks/useKitchen";
import type { KitchenStatus } from "../schemas/kitchen.schema";
import { KitchenTicketCard } from "./KitchenTicketCard";
import { isDelayed } from "../utils/kitchen.utils";

type Resource = ReturnType<typeof useKitchen>;

const columns: {
  status: KitchenStatus;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    status: "PENDING",
    label: "Pendientes",
    icon: Circle,
  },
  {
    status: "IN_PREPARATION",
    label: "En preparación",
    icon: Flame,
  },
  {
    status: "READY",
    label: "Listas",
    icon: CircleCheck,
  },
];

export function KitchenEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="kitchen-empty">
      <CircleCheck size={30} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function KitchenSummary({
  resource,
  now,
}: {
  resource: Resource;
  now: number;
}) {
  const counters = [
    ...columns.map((column) => ({
      label: column.status === "PENDING" ? "Nuevas" : column.label,
      icon: column.icon,
      tone: column.status,
      count: resource.tickets.filter(
        (ticket) => ticket.status === column.status
      ).length,
    })),
    {
      label: "Con retraso",
      icon: TriangleAlert,
      tone: "DELAYED",
      count: resource.tickets.filter((ticket) =>
        isDelayed(ticket, now)
      ).length,
    },
  ];

  return (
    <div className="kitchen-summary" aria-label="Resumen de comandas">
      {counters.map((counter) => (
        <div key={counter.tone} data-tone={counter.tone}>
          <counter.icon size={18} />

          <strong>{resource.loading ? "—" : counter.count}</strong>

          <span>{counter.label}</span>
        </div>
      ))}
    </div>
  );
}

export function KitchenColumn({
  status,
  label,
  icon: Icon,
  resource,
  now,
}: {
  status: KitchenStatus;
  label: string;
  icon: LucideIcon;
  resource: Resource;
  now: number;
}) {
  const tickets = resource.tickets
    .filter((ticket) => ticket.status === status)
    .sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );

  return (
    <section
      className="kitchen-column"
      data-status={status}
      aria-label={label}
    >
      <div className="kitchen-column-heading">
        <h2>
          <Icon size={17} />
          {label}
        </h2>

        <span>{resource.loading ? "—" : tickets.length}</span>
      </div>

      <div className="kitchen-column-content">
        {resource.loading ? (
          <div className="kitchen-skeleton" role="status">
            <span className="sr-only">Cargando comandas</span>

            {[0, 1].map((value) => (
              <div key={value} aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            ))}
          </div>
        ) : tickets.length ? (
          tickets.map((ticket) => (
            <KitchenTicketCard
              key={ticket.id}
              ticket={ticket}
              now={now}
              busy={resource.pending.includes(ticket.id)}
              disabled={resource.paused || !resource.synchronized}
              onAction={resource.mutate}
            />
          ))
        ) : (
          <KitchenEmptyState
            title={
              resource.error
                ? "Sin datos actualizados"
                : status === "READY"
                  ? "Nada listo aún"
                  : "Todo al día"
            }
            description={
              resource.error
                ? "Actualiza para consultar las comandas."
                : status === "PENDING"
                  ? "No hay comandas pendientes en esta vista."
                  : status === "IN_PREPARATION"
                    ? "No hay comandas en preparación."
                    : "Las comandas listas aparecerán aquí."
            }
          />
        )}
      </div>
    </section>
  );
}

export function KitchenBoard({
  resource,
  now,
}: {
  resource: Resource;
  now: number;
}) {
  return (
    <div className="kitchen-board">
      {columns.map((column) => (
        <KitchenColumn
          key={column.status}
          {...column}
          resource={resource}
          now={now}
        />
      ))}
    </div>
  );
}
