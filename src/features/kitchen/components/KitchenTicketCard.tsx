import {
  Bike,
  Check,
  Circle,
  CircleCheck,
  Clock3,
  Flame,
  ShoppingBag,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type {
  KitchenItem,
  KitchenTicket,
  KitchenMutation,
} from "../schemas/kitchen.schema";
import {
  clockTime,
  elapsedMinutes,
  isDelayed,
  nextItemStatus,
  nextTicketStatus,
  serviceLabel,
} from "../utils/kitchen.utils";

export function KitchenTicketStatusBadge({
  item,
}: {
  item: KitchenItem;
}) {
  const labels = {
    PENDING: "Pendiente",
    IN_PREPARATION: "Preparando",
    READY: "Listo",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
  };

  return (
    <span
      className="kitchen-badge"
      data-status={item.preparationStatus}
    >
      {item.preparationStatus === "IN_PREPARATION" ? (
        <Flame size={11} />
      ) : item.preparationStatus === "READY" ? (
        <Check size={11} />
      ) : (
        <Circle size={10} />
      )}

      {item.fulfillmentMode === "READY_TO_SERVE" &&
      item.preparationStatus === "READY"
        ? "Listo para entregar"
        : labels[item.preparationStatus]}
    </span>
  );
}

export function KitchenElapsedTime({
  ticket,
  now,
}: {
  ticket: KitchenTicket;
  now: number;
}) {
  const delayed = isDelayed(ticket, now);

  return (
    <span className="kitchen-elapsed" data-delayed={delayed}>
      {delayed ? <TriangleAlert size={13} /> : <Clock3 size={13} />}
      {delayed && <strong>Retrasada · </strong>}
      Hace {elapsedMinutes(ticket.createdAt, now)} min
    </span>
  );
}

export function KitchenTicketItem({
  item,
  ticketId,
  disabled,
  onAction,
}: {
  item: KitchenItem;
  ticketId: string;
  disabled: boolean;
  onAction: (action: KitchenMutation) => void;
}) {
  const next = nextItemStatus(item);

  return (
    <li
      className="kitchen-item"
      data-cancelled={item.preparationStatus === "CANCELLED"}
    >
      <span className="kitchen-quantity">{item.quantity}</span>

      <div className="kitchen-item-content">
        <p className="kitchen-item-name">{item.productName}</p>

        {item.notes && (
          <p className="kitchen-item-note">
            <TriangleAlert size={13} />
            {item.notes}
          </p>
        )}

        <KitchenTicketStatusBadge item={item} />
      </div>

      {next && (
        <Button
          size="sm"
          variant={next === "READY" ? "primary" : "secondary"}
          disabled={disabled}
          onClick={() =>
            onAction({
              ticketId,
              itemId: item.id,
              status: next,
            })
          }
        >
          {next === "READY" ? (
            <Check size={14} />
          ) : (
            <Flame size={14} />
          )}

          {next === "READY" ? "Listo" : "Comenzar"}
        </Button>
      )}
    </li>
  );
}

export function KitchenTicketCard({
  ticket,
  now,
  busy,
  disabled,
  onAction,
}: {
  ticket: KitchenTicket;
  now: number;
  busy: boolean;
  disabled: boolean;
  onAction: (action: KitchenMutation) => void;
}) {
  const Icon =
    ticket.serviceType === "DELIVERY"
      ? Bike
      : ticket.serviceType === "TAKEAWAY"
        ? ShoppingBag
        : UtensilsCrossed;

  const next = nextTicketStatus(ticket);

  return (
    <article
      className="kitchen-ticket"
      data-status={ticket.status}
      data-delayed={isDelayed(ticket, now)}
      aria-busy={busy}
    >
      <h3>
        <Icon size={17} />

        <span>
          {serviceLabel(ticket)} · Orden #{ticket.orderId}
        </span>
      </h3>

      <div className="kitchen-ticket-meta">
        <p>
          Comanda #{ticket.id} · {ticket.preparationAreaName}
          {" · "}
          {clockTime(ticket.createdAt)}
          {ticket.currentVersion > 1 && (
            <span className="block mt-1 text-accent">
              Comanda modificada · Versión {ticket.currentVersion}
            </span>
          )}
        </p>

        <KitchenElapsedTime ticket={ticket} now={now} />
      </div>

      {ticket.orderNotes && (
        <p className="kitchen-order-note">
          <TriangleAlert size={14} />
          {ticket.orderNotes}
        </p>
      )}

      <ul className="kitchen-items">
        {ticket.items
          .filter((item) => item.preparationStatus !== "DELIVERED")
          .map((item) => (
            <KitchenTicketItem
              key={item.id}
              item={item}
              ticketId={ticket.id}
              disabled={disabled || busy}
              onAction={onAction}
            />
          ))}
      </ul>

      {next && (
        <Button
          className="kitchen-ticket-bulk"
          size="sm"
          variant={next === "READY" ? "primary" : "secondary"}
          loading={busy}
          disabled={disabled || busy}
          onClick={() =>
            onAction({
              ticketId: ticket.id,
              status: next,
            })
          }
        >
          {next === "READY" ? (
            <Check size={15} />
          ) : (
            <Flame size={15} />
          )}

          {next === "READY" ? "Marcar todo listo" : "Comenzar todo"}
        </Button>
      )}

      {ticket.status === "READY" && (
        <p className="kitchen-ready">
          <CircleCheck size={15} />
          Lista · esperando al mesero
        </p>
      )}
    </article>
  );
}
