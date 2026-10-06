import { useId, useState } from "react";

import {
  Check,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";

import { resolveFileUrl } from "../../../lib/files";

import { OrderDetailsForm } from "./OrderDetailsForm";

import { cents, money, STATUS_LABELS } from "../schemas/sales.schema";
import type { Order, OrderItem } from "../schemas/sales.schema";

import type { SalesData } from "../services/sales.service";
import type { SalesResource } from "../hooks/useSales";

import { OrderCancellationActions } from "./OrderCancellationActions";

const PREPARATION_LABELS = {
  PENDING: "Pendiente",
  IN_PREPARATION: "En preparación",
  READY: "Listo para entregar",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function OrderWorkspace({
  resource,
  order,
  data,
}: {
  resource: SalesResource;
  order: Omit<Order, "id" | "openedByMembershipId"> & {
    id: string | null;
  };
  data: SalesData;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const accountId = useId();
  const searchId = useId();

  const needsConfirmation =
    !!order.id && !!resource.confirmationIds[order.id];

  const cancellationPending =
    !!order.id && !!resource.cancellationIds[order.id];

  const awaitingConfirmation = !!order.id && order.status === "OPEN";

  const hasDelivered = data.tickets.some(
    (ticket) =>
      ticket.orderId === order.id &&
      ticket.items.some(
        (item) => item.preparationStatus === "DELIVERED"
      )
  );

  const blocked =
    resource.busy ||
    resource.uncertain ||
    !!resource.error ||
    needsConfirmation ||
    cancellationPending;

  const editable = order.status === "OPEN";
  const canAdd = editable || order.status === "CONFIRMED";

  const storedDraft = order.id
    ? (resource.drafts[order.id] ?? {})
    : (resource.localDraft?.items ?? {});

  const draft = canAdd ? storedDraft : {};

  const unsentAdditions =
    order.status === "DELIVERED" ? Object.entries(storedDraft) : [];

  const possibleCreatedOrder =
    resource.uncertain && !order.id && order.serviceType === "TABLE"
      ? data.orders.find(
          (entry) =>
            entry.serviceType === "TABLE" &&
            entry.restaurantTableId === order.restaurantTableId
        )
      : undefined;

  const items = order.items.filter(
    (item) => item.status === "ACTIVE"
  );

  const cancelledItems = order.items.filter(
    (item) => item.status === "CANCELLED"
  );

  const categories = [
    ...new Map(
      data.products.map((product) => [
        product.categoryId,
        product.categoryName,
      ])
    ).entries(),
  ];

  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const products = data.products.filter(
    (product) =>
      (!category || category === product.categoryId) &&
      normalized(
        [product.name, product.sku, product.description].join(" ")
      ).includes(normalized(query.trim()))
  );

  const draftEntries = Object.entries(draft);

  const pendingCount = draftEntries.reduce(
    (sum, [, item]) => sum + item.quantity,
    0
  );

  const total =
    cents(order.subtotal) +
    draftEntries.reduce(
      (sum, [, item]) =>
        sum + cents(item.price) * BigInt(item.quantity),
      0n
    );

  const invalidDraft = draftEntries.some(
    ([id]) => !data.products.some((product) => product.id === id)
  );

  const ticketItems = new Map(
    data.tickets
      .filter((ticket) => ticket.orderId === order.id)
      .flatMap((ticket) =>
        ticket.items.map(
          (item) =>
            [
              item.orderItemId,
              { ...item, ticketId: ticket.id },
            ] as const
        )
      )
  );

  const freeTables = data.tables.filter(
    (table) =>
      table.id === order.restaurantTableId ||
      (table.isActive &&
        !data.orders.some(
          (other) => other.restaurantTableId === table.id
        ))
  );

  function removeDraftItem(productId: string) {
    if (blocked || !canAdd) return;

    const next = { ...draft };

    delete next[productId];

    resource.setDraft(order.id, next);
  }

  function changeQuantity(productId: string, delta: number) {
    if (blocked || !canAdd) return;
    const next = { ...draft };

    const product = data.products.find(
      (entry) => entry.id === productId
    );

    const previous = next[productId];
    const quantity = (previous?.quantity ?? 0) + delta;

    if (quantity <= 0) {
      delete next[productId];
    } else if (previous || product) {
      next[productId] = {
        quantity,
        notes: previous?.notes ?? "",
        name: previous?.name ?? product!.name,
        price: previous?.price ?? product!.currentPrice,
      };
    }

    resource.setDraft(order.id, next);
  }

  return (
    <div className="sales-order-body">
      <div className="sales-order-meta">
        <span>
          {order.id
            ? `Orden #${order.id} · ${STATUS_LABELS[order.status]}`
            : "Borrador · Sin enviar"}

          {order.customerCount
            ? ` · ${order.customerCount} personas`
            : ""}
        </span>

        {editable && (
          <button
            type="button"
            className="sales-link"
            disabled={blocked}
            onClick={() => setShowDetails(!showDetails)}
          >
            <Pencil size={14} />

            {showDetails
              ? "Volver al catálogo"
              : "Datos de la cuenta"}
          </button>
        )}

        {order.notes && <p>{order.notes}</p>}
      </div>

      {(resource.notice ||
        resource.error ||
        resource.uncertain ||
        awaitingConfirmation ||
        needsConfirmation ||
        cancellationPending) && (
        <div className="sales-order-notice" role="status">
          <p>
            {resource.notice ||
              resource.error ||
              "La orden está guardada y pendiente de confirmación."}
          </p>

          {(awaitingConfirmation || needsConfirmation) &&
            !cancellationPending && (
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  resource.busy ||
                  resource.uncertain ||
                  pendingCount > 0
                }
                onClick={() => void resource.retryConfirmation()}
              >
                Reintentar confirmación
              </Button>
            )}

          {cancellationPending && (
            <Button
              size="sm"
              variant="secondary"
              disabled={resource.busy}
              onClick={() => void resource.verifyCancellation()}
            >
              Verificar cancelación
            </Button>
          )}

          {resource.uncertain ? (
            <>
              {!order.id && (
                <>
                  <p>
                    Revisa las cuentas activas antes de volver a
                    enviar.
                    {possibleCreatedOrder
                      ? ` Hay una orden #${possibleCreatedOrder.id} en esta mesa; comprueba si corresponde a este pedido.`
                      : ""}
                  </p>

                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={resource.busy}
                    onClick={() => resource.select(null)}
                  >
                    Ver cuentas activas sin reenviar
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={resource.busy}
                onClick={resource.retry}
              >
                Actualizar cuentas para revisar
              </Button>

              <Button
                size="sm"
                variant="secondary"
                disabled={resource.busy}
                onClick={() => void resource.reconcile()}
              >
                {resource.needsWriteVerification
                  ? "Verificar operación"
                  : "Ya revisé las cuentas: habilitar acciones"}
              </Button>
            </>
          ) : (
            resource.error && (
              <Button
                size="sm"
                variant="secondary"
                disabled={resource.busy}
                onClick={resource.retry}
              >
                Actualizar cuenta
              </Button>
            )
          )}
        </div>
      )}

      <div
        className="sales-order-layout"
        data-account={showAccount}
        data-readonly={!canAdd}
      >
        <section className="sales-catalog" aria-label="Catálogo">
          {showDetails && editable ? (
            <div className="sales-details">
              <OrderDetailsForm
                initial={order}
                tables={
                  order.id
                    ? freeTables
                    : freeTables.filter(
                        (table) =>
                          table.id === order.restaurantTableId
                      )
                }
                busy={blocked}
                onCancel={() => setShowDetails(false)}
                onSave={async (input) => {
                  const ok = order.id
                    ? await resource.action(
                        `/orders/${order.id}`,
                        "PATCH",
                        input
                      )
                    : resource.updateLocal(input);

                  if (ok) {
                    setShowDetails(false);
                  }

                  return ok;
                }}
              />
            </div>
          ) : (
            <>
              <div className="sales-catalog-tools">
                <label className="sales-search" htmlFor={searchId}>
                  <Search size={17} aria-hidden="true" />

                  <span className="sr-only">
                    Buscar plato o bebida
                  </span>

                  <input
                    id={searchId}
                    type="search"
                    placeholder="Buscar plato o bebida"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>

                <div
                  className="sales-chips"
                  aria-label="Filtrar por categoría"
                >
                  <button
                    type="button"
                    aria-pressed={!category}
                    onClick={() => setCategory("")}
                  >
                    Todo
                  </button>

                  {categories.map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={category === id}
                      onClick={() => setCategory(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sales-product-grid">
                {!products.length && (
                  <p className="sales-muted">
                    No hay productos disponibles con ese filtro.
                  </p>
                )}

                {products.map((product) => (
                  <article key={product.id} className="sales-product">
                    <Avatar
                      name={product.name}
                      src={resolveFileUrl(product.imageUrl)}
                      size="md"
                    />

                    <div className="sales-product-content">
                      <h3>{product.name}</h3>

                      <p>{product.description}</p>

                      <div className="sales-product-bottom">
                        <strong>
                          {money(cents(product.currentPrice))}
                        </strong>

                        {canAdd && (
                          <div className="sales-quantity">
                            {!!draft[product.id] && (
                              <>
                                <button
                                  type="button"
                                  className="sales-icon"
                                  disabled={blocked}
                                  aria-label={`Quitar uno de ${product.name} del borrador`}
                                  onClick={() =>
                                    changeQuantity(product.id, -1)
                                  }
                                >
                                  <Minus size={15} />
                                </button>

                                <span aria-label="Cantidad por enviar">
                                  {draft[product.id].quantity}
                                </span>
                              </>
                            )}

                            <button
                              type="button"
                              className="sales-icon sales-add"
                              disabled={blocked}
                              aria-label={`Agregar ${product.name}`}
                              onClick={() =>
                                changeQuantity(product.id, 1)
                              }
                            >
                              <Plus size={17} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <aside
          id={accountId}
          className="sales-current"
          aria-label="Cuenta actual"
        >
          <h3>
            <ReceiptText size={18} />

            {order.status === "DELIVERED"
              ? "Resumen de la cuenta"
              : "Cuenta actual"}

            <span>
              {items.reduce((sum, item) => sum + item.quantity, 0) +
                pendingCount}
            </span>
          </h3>

          <div className="sales-lines">
            {unsentAdditions.length > 0 && (
              <div className="sales-order-notice" role="status">
                <p>
                  Esta cuenta está por cerrar, pero conserva adiciones
                  locales sin enviar. No están incluidas en el
                  subtotal. Revísalas y descártalas antes de cerrar.
                </p>

                <ul>
                  {unsentAdditions.map(([id, item]) => (
                    <li key={id}>
                      {item.quantity} × {item.name}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={blocked}
                  onClick={() => {
                    if (order.id) {
                      resource.discardAdditions(order.id);
                    }
                  }}
                >
                  <Trash2
                    size={15}
                    aria-hidden="true"
                    className="text-[#ae483c] dark:text-[#efa38f]"
                  />
                  Descartar adiciones sin enviar
                </Button>
              </div>
            )}

            {!items.length && !pendingCount && (
              <p className="sales-muted">
                Agrega productos para comenzar la cuenta.
              </p>
            )}

            {order.status === "CONFIRMED" && items.length > 0 && (
              <h4 className="sales-eyebrow">Productos confirmados</h4>
            )}

            {items.map((item) => {
              const ticket = ticketItems.get(item.id);

              return (
                <article key={item.id} className="sales-line">
                  <strong>{item.productName}</strong>

                  <p>
                    {item.quantity} × {money(cents(item.unitPrice))}
                    {" · "}
                    {money(cents(item.lineTotal))}
                  </p>

                  {item.notes && <p>{item.notes}</p>}

                  <span className="sales-line-status">
                    {editable
                      ? "Sin enviar"
                      : ticket
                        ? PREPARATION_LABELS[ticket.preparationStatus]
                        : order.status === "DELIVERED" ||
                            order.status === "CLOSED"
                          ? "Entregado"
                          : "Sin comanda activa"}
                  </span>

                  <div className="sales-line-actions">
                    {editable && (
                      <>
                        <button
                          type="button"
                          className="sales-icon"
                          disabled={blocked}
                          aria-label={`Editar ${item.productName}`}
                          onClick={() =>
                            setEditing(
                              editing === item.id ? null : item.id
                            )
                          }
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          className="sales-link sales-remove-product"
                          disabled={blocked}
                          aria-label={`Retirar ${item.productName}`}
                          onClick={() =>
                            void resource.action(
                              `/orders/${order.id}/items/${item.id}`,
                              "DELETE"
                            )
                          }
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Quitar
                        </button>
                      </>
                    )}

                    {order.status === "CONFIRMED" &&
                      ticket &&
                      ["PENDING", "IN_PREPARATION", "READY"].includes(
                        ticket.preparationStatus
                      ) && (
                        <button
                          type="button"
                          className="sales-link"
                          disabled={blocked}
                          onClick={() =>
                            setEditing(
                              editing === item.id ? null : item.id
                            )
                          }
                        >
                          Cancelar producto
                        </button>
                      )}

                    {ticket?.preparationStatus === "READY" && (
                      <Button
                        size="sm"
                        disabled={blocked}
                        onClick={() =>
                          void resource.action(
                            `/kitchen-tickets/${ticket.ticketId}/items/${ticket.id}/status`,
                            "PATCH",
                            { status: "DELIVERED" }
                          )
                        }
                      >
                        <Check size={15} />
                        Entregar
                      </Button>
                    )}
                  </div>

                  {editing === item.id && canAdd && (
                    <ItemEditor
                      key={`${item.id}:${order.status}`}
                      item={item}
                      cancel={!editable}
                      busy={blocked}
                      onClose={() => setEditing(null)}
                      onSave={async (body) => {
                        const ok = await resource.action(
                          `/orders/${order.id}/items/${item.id}${
                            editable ? "" : "/cancel"
                          }`,
                          editable ? "PATCH" : "POST",
                          body
                        );

                        if (ok) {
                          setEditing(null);
                        }
                      }}
                    />
                  )}
                </article>
              );
            })}

            {canAdd && pendingCount > 0 && (
              <h4 className="sales-eyebrow">Productos por enviar</h4>
            )}

            {draftEntries.map(([id, item]) => (
              <article
                key={id}
                className="sales-line sales-draft-line"
              >
                <div className="sales-line-heading">
                  <strong>{item.name}</strong>

                  <button
                    type="button"
                    className="sales-link sales-remove-product"
                    disabled={blocked || !canAdd}
                    aria-label={`Quitar ${item.name} del carrito`}
                    onClick={() => removeDraftItem(id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Quitar
                  </button>
                </div>

                <p>
                  {item.quantity} × {money(cents(item.price))}
                </p>

                <label className="sales-label">
                  Nota del producto
                  <input
                    value={item.notes}
                    placeholder="Ej. Sin cebolla"
                    disabled={blocked}
                    onChange={(event) =>
                      resource.setDraft(order.id, {
                        ...draft,
                        [id]: {
                          ...item,
                          notes: event.target.value,
                        },
                      })
                    }
                  />
                </label>

                <div className="sales-quantity">
                  <button
                    type="button"
                    className="sales-icon"
                    disabled={blocked}
                    aria-label={`Quitar uno de ${item.name}`}
                    onClick={() => changeQuantity(id, -1)}
                  >
                    <Minus size={15} aria-hidden="true" />
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    type="button"
                    className="sales-icon"
                    disabled={blocked || !canAdd}
                    aria-label={`Agregar uno de ${item.name}`}
                    onClick={() => changeQuantity(id, 1)}
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}

            {cancelledItems.length > 0 && (
              <details className="sales-cancelled">
                <summary>
                  Productos cancelados
                  <span className="sales-cancelled-count">
                    {cancelledItems.reduce(
                      (sum, item) => sum + item.quantity,
                      0
                    )}
                  </span>
                </summary>

                <p className="sales-cancelled-help">
                  Estos productos no se incluyen en el subtotal.
                </p>

                {cancelledItems.map((item) => (
                  <article
                    key={item.id}
                    className="sales-cancelled-item"
                  >
                    <strong>
                      {item.quantity} × {item.productName}
                    </strong>

                    <p>
                      Motivo:{" "}
                      {item.cancellationReason ||
                        "Sin motivo registrado."}
                    </p>
                  </article>
                ))}
              </details>
            )}
          </div>
        </aside>

        <footer className="sales-order-footer">
          <div className="sales-total">
            <div>
              <span>
                {pendingCount ? "Subtotal estimado" : "Subtotal"}
              </span>

              <strong>{money(total)}</strong>
            </div>

            {canAdd && pendingCount > 0 && (
              <small>{pendingCount} por enviar</small>
            )}
          </div>

          {invalidDraft && (
            <p role="alert">
              Un producto del borrador ya no está disponible. Retíralo
              antes de enviar.
            </p>
          )}

          {pendingCount > 0 && (
            <p className="sales-price-note">
              El servidor confirma los precios al enviar.
            </p>
          )}

          <div className="sales-footer-actions">
            {canAdd ? (
              (!order.id || pendingCount > 0) && (
                <Button
                  size="sm"
                  className="sales-primary"
                  loading={resource.sending}
                  loadingText="Enviando pedido..."
                  disabled={blocked || invalidDraft || !pendingCount}
                  onClick={() => void resource.send()}
                >
                  <Send size={16} />

                  {order.status === "CONFIRMED"
                    ? "Enviar adiciones"
                    : "Enviar pedido"}
                </Button>
              )
            ) : order.status === "DELIVERED" ? (
              <Button
                size="sm"
                disabled={blocked || unsentAdditions.length > 0}
                onClick={() =>
                  void resource.action(
                    `/orders/${order.id}/close`,
                    "POST"
                  )
                }
              >
                <Check size={16} />
                Cerrar cuenta
              </Button>
            ) : null}

            <button
              type="button"
              className="sales-icon sales-bag"
              aria-label={
                showAccount ? "Ver catálogo" : "Ver cuenta actual"
              }
              aria-controls={accountId}
              aria-expanded={showAccount}
              onClick={() => setShowAccount(!showAccount)}
            >
              <ShoppingBag size={19} />
            </button>
          </div>

          <OrderCancellationActions
            resource={resource}
            orderId={order.id}
            status={order.status}
            pendingCount={pendingCount}
            hasDelivered={hasDelivered}
          />

          {order.status === "DELIVERED" && (
            <p className="sales-price-note">
              {order.serviceType === "TABLE"
                ? "El cierre libera la mesa. No registra un pago."
                : "El cierre finaliza la cuenta. No registra un pago."}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  cancel,
  busy,
  onClose,
  onSave,
}: {
  item: OrderItem;
  cancel: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(item.quantity.toString());

  const [notes, setNotes] = useState(item.notes ?? "");

  const [reason, setReason] = useState("");

  return (
    <form
      className="sales-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (busy || (cancel && reason.trim().length < 3)) {
          return;
        }

        void onSave(
          cancel
            ? { reason: reason.trim() }
            : {
                quantity: Number(quantity),
                notes: notes.trim() || null,
              }
        );
      }}
    >
      {cancel ? (
        <label className="sales-label">
          Motivo de cancelación
          <textarea
            required
            minLength={3}
            maxLength={500}
            value={reason}
            disabled={busy}
            placeholder="Ej. El cliente cambió de opinión"
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      ) : (
        <>
          <label className="sales-label">
            Cantidad
            <input
              type="number"
              required
              min={1}
              step={1}
              value={quantity}
              disabled={busy}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label className="sales-label">
            Nota
            <textarea
              value={notes}
              disabled={busy}
              placeholder="Ej. Sin salsa"
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </>
      )}

      <div className="sales-form-actions">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Volver
        </Button>

        <Button
          size="sm"
          type="submit"
          variant={cancel ? "danger" : "primary"}
          disabled={busy || (cancel && reason.trim().length < 3)}
        >
          Confirmar
        </Button>
      </div>
    </form>
  );
}
