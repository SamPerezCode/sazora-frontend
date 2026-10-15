import { useId, useMemo, useState } from "react";

import {
  ArrowRight,
  ChevronDown,
  Clock,
  History,
  MapPin,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  Users,
  Utensils,
} from "lucide-react";

import { ResponsiveFilter } from "../../../components/ui/ResponsiveFilter";

import { useAppShell } from "../../../app/layout/shell-context";

import { Alert } from "../../../components/feedback/Alert";
import { SelectField } from "../../../components/forms/SelectField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import type { AuthSession } from "../../auth/types/auth.types";

import { useSales } from "../hooks/useSales";
import { useSalesLocations } from "../hooks/useSalesLocations";

import { OrderWorkspace } from "../components/OrderWorkspace";
import { OrderSummaryView } from "../components/OrderSummaryView";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { SalesSummary } from "../components/SalesSummary";
import { SalesHistory } from "../components/SalesHistory";

import {
  getBoardTables,
  matchesOrder,
  SALES_FILTERS,
} from "../utils/sales-board";

import type { SalesFilter } from "../utils/sales-board";

import { cents, money, STATUS_LABELS } from "../schemas/sales.schema";

import type { OrderSummary } from "../schemas/sales.schema";

import type { SalesLocation } from "../services/sales.service";

import "../mesas-pedidos.css";

type Locations = ReturnType<typeof useSalesLocations>;

function LocationControl({
  locations,
  value,
  onChange,
  disabled = false,
}: {
  locations: Locations;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mp-location-control">
      <span className="mp-location-icon">
        <Store size={22} />
      </span>

      {locations.options.length === 1 && value ? (
        <div>
          <small>Punto de venta</small>
          <strong>
            {locations.options[0].name} · {locations.options[0].code}
          </strong>
        </div>
      ) : (
        <SelectField
          label="Punto de venta"
          value={value}
          disabled={disabled || locations.loading}
          placeholder="Selecciona un punto de venta"
          options={locations.options.map((location) => ({
            value: location.id,
            label: `${location.name} · ${location.code}`,
          }))}
          onValueChange={onChange}
        />
      )}
    </div>
  );
}

export function SalesPage() {
  const { session } = useAppShell();

  const allowed = session.authorization.roles.some(
    (role) => role === "ADMIN" || role === "WAITER"
  );

  if (!allowed) {
    return <Alert>No tienes acceso a Mesas y pedidos.</Alert>;
  }

  return (
    <SalesLocations
      key={`${session.business.id}:${session.membership.id}`}
      session={session}
    />
  );
}

function SalesLocations({ session }: { session: AuthSession }) {
  const locations = useSalesLocations(session);

  if (!locations.location) {
    return (
      <section className="mp-page">
        <div className="mp-toolbar">
          <LocationControl
            locations={locations}
            value=""
            onChange={locations.select}
          />
        </div>

        {locations.issue && <Alert>{locations.issue}</Alert>}

        {locations.loading ? (
          <p role="status">Consultando puntos de venta…</p>
        ) : locations.error ? (
          <Alert>
            <p>{locations.error}</p>
            <Button variant="secondary" onClick={locations.retry}>
              Reintentar
            </Button>
          </Alert>
        ) : (
          <div className="mp-empty">
            <Store size={28} />

            <h2>
              {locations.options.length
                ? "Selecciona un punto de venta para comenzar."
                : "No tienes un punto de venta disponible para operar."}
            </h2>

            {!locations.options.length && (
              <Button variant="secondary" onClick={locations.retry}>
                Actualizar acceso
              </Button>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <SalesContent
      key={locations.location.id}
      session={session}
      location={locations.location}
      locations={locations}
    />
  );
}

function SalesContent({
  session,
  location,
  locations,
}: {
  session: AuthSession;
  location: SalesLocation;
  locations: Locations;
}) {
  const scope = useMemo(
    () => ({
      businessId: session.business.id,
      location,
    }),
    [session.business.id, location]
  );

  const resource = useSales(
    session.accessToken,
    scope,
    locations.invalidate
  );

  const modalId = useId();
  const pickupId = useId();

  const [filter, setFilter] = useState<SalesFilter>("ALL");
  const [takeawayOpen, setTakeawayOpen] = useState(false);
  const [chooseTable, setChooseTable] = useState(false);
  const [history, setHistory] = useState(false);

  const [leaving, setLeaving] = useState<
    { kind: "location"; id: string } | { kind: "close" } | null
  >(null);

  const data = resource.data;

  const board = getBoardTables(
    data?.tables ?? [],
    data?.orders ?? []
  );

  const visible = board.filter(({ order }) =>
    filter === "ALL"
      ? true
      : filter === "FREE"
        ? !order
        : !!order && matchesOrder(order, filter)
  );

  const takeaway = (data?.orders ?? []).filter(
    (order) =>
      order.serviceType === "TAKEAWAY" && matchesOrder(order, filter)
  );

  const active =
    data?.order?.id === resource.selectedId ? data.order : null;

  const draft = resource.localDraft;

  const workspaceOrder =
    active ??
    (draft
      ? {
          id: null,
          serviceType: draft.serviceType,
          restaurantTableId: draft.restaurantTableId,
          customerCount: draft.customerCount,
          notes: draft.notes,
          status: "OPEN" as const,
          subtotal: "0",
          items: [],
        }
      : null);

  const table = data?.tables.find(
    (entry) => entry.id === workspaceOrder?.restaurantTableId
  );

  const blocked =
    resource.busy ||
    resource.uncertain ||
    !!resource.error ||
    resource.accessLost ||
    resource.loading;

  const title = workspaceOrder
    ? workspaceOrder.serviceType === "TABLE"
      ? (table?.name ?? "Mesa")
      : "Pedido para recoger"
    : "Cargando cuenta…";

  function openTable(id: string) {
    const entry = board.find(
      ({ table: candidate }) => candidate.id === id
    );

    if (!entry || resource.busy) return;

    setChooseTable(false);

    if (entry.order) {
      resource.select(entry.order.id);
    } else if (!blocked) {
      resource.start({
        serviceType: "TABLE",
        restaurantTableId: id,
        customerCount: null,
        notes: null,
      });
    }
  }

  function startTakeaway() {
    resource.start({
      serviceType: "TAKEAWAY",
      restaurantTableId: null,
      customerCount: null,
      notes: null,
    });
  }

  function pendingCount(id: string) {
    return Object.values(resource.drafts[id] ?? {}).reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  function closeWorkspace() {
    if (draft && Object.keys(draft.items).length) {
      setLeaving({ kind: "close" });
    } else if (draft) {
      resource.discardLocal();
    } else {
      resource.select(null);
    }
  }

  function changeLocation(id: string) {
    if (id === location.id || resource.busy || resource.uncertain) {
      return;
    }

    if (resource.hasPending) {
      setLeaving({ kind: "location", id });
    } else {
      locations.select(id);
    }
  }

  const newPickup = (
    <Button size="compact" disabled={blocked} onClick={startTakeaway}>
      <Plus size={16} />
      Nuevo pedido para recoger
    </Button>
  );

  function orderInfo(order: OrderSummary) {
    return (
      <>
        <div className="mp-card-line">
          <strong>Orden #{order.id}</strong>

          {order.customerCount !== null && (
            <span>
              <Users size={14} />
              {order.customerCount}
            </span>
          )}
        </div>

        <p>
          {order.activeItemCount}{" "}
          {order.activeItemCount === 1
            ? "producto guardado"
            : "productos guardados"}{" "}
          ·{" "}
          {order.status === "OPEN"
            ? "Sin enviar a cocina"
            : order.status === "DELIVERED"
              ? "Por cerrar"
              : "Consultar preparación"}
        </p>

        {pendingCount(order.id) > 0 && (
          <p className="mp-accent">
            {pendingCount(order.id)} unidades locales por enviar
          </p>
        )}

        <strong>{money(cents(order.subtotal))}</strong>
      </>
    );
  }

  return (
    <section className="mp-page sales-page sales-board">
      {history ? (
        <SalesHistory
          token={session.accessToken}
          scope={scope}
          onBack={() => setHistory(false)}
          onLocationLost={locations.invalidate}
        />
      ) : (
        <>
          <div className="mp-toolbar">
            <LocationControl
              locations={locations}
              value={location.id}
              onChange={changeLocation}
              disabled={resource.busy || resource.uncertain}
            />

            <div className="mp-toolbar-actions">
              <Button
                variant="soft"
                size="icon"
                disabled={resource.busy}
                onClick={resource.retry}
                aria-label="Actualizar mesas y pedidos"
              >
                <RefreshCw size={17} />
              </Button>

              <Button
                variant="soft"
                size="compact"
                disabled={
                  blocked ||
                  !board.some(
                    ({ table: entry, order }) =>
                      entry.isActive && !order
                  )
                }
                onClick={() => setChooseTable(true)}
              >
                <Utensils size={16} />
                Abrir mesa
              </Button>

              {newPickup}
            </div>
          </div>

          <div className="mp-section-heading">
            <div>
              <h2>Salón de {location.name}</h2>
              <p>Abre una mesa o continúa atendiendo una cuenta.</p>
            </div>

            <Button
              variant="soft"
              size="compact"
              disabled={resource.busy || resource.uncertain}
              onClick={() => setHistory(true)}
            >
              <History size={16} />
              Ver historial
            </Button>
          </div>

          {resource.loading && (
            <div
              className="mp-skeletons"
              role="status"
              aria-label="Cargando tablero"
            >
              {[1, 2, 3].map((number) => (
                <div key={number} />
              ))}
            </div>
          )}

          {resource.error && (
            <Alert>
              <p>{resource.error}</p>

              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={resource.retry}
              >
                Reintentar
              </Button>
            </Alert>
          )}

          {resource.notice && !resource.selectedId && !draft && (
            <p className="mp-notice" role="status">
              {resource.notice}
            </p>
          )}

          {resource.uncertain && !resource.selectedId && !draft && (
            <div className="mp-warning" role="alert">
              <p>
                Hay una operación pendiente de verificar. Revisa las
                cuentas antes de volver a enviar.
              </p>

              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={() => void resource.reconcile()}
              >
                {resource.needsWriteVerification
                  ? "Verificar operación"
                  : "Ya revisé las cuentas: habilitar acciones"}
              </Button>
            </div>
          )}

          {data && (
            <>
              <SalesSummary
                free={
                  board.filter(
                    ({ table: entry, order }) =>
                      entry.isActive && !order
                  ).length
                }
                attending={
                  board.filter(
                    ({ order }) =>
                      order?.status === "OPEN" ||
                      order?.status === "CONFIRMED"
                  ).length
                }
                closing={
                  board.filter(
                    ({ order }) => order?.status === "DELIVERED"
                  ).length
                }
              />

              <ResponsiveFilter
                label="Estado de mesas y pedidos"
                value={filter}
                options={SALES_FILTERS.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                onChange={setFilter}
              />

              {filter !== "FREE" && (
                <section className="mp-pickup">
                  <div className="mp-section-heading">
                    <button
                      className="mp-pickup-toggle"
                      type="button"
                      aria-controls={pickupId}
                      aria-expanded={takeawayOpen}
                      onClick={() => setTakeawayOpen((open) => !open)}
                    >
                      <ShoppingBag size={18} />
                      <strong>Pedidos para recoger</strong>
                      <span className="mp-neutral">
                        {takeaway.length}
                      </span>
                      <ChevronDown size={16} />
                    </button>

                    <Button
                      variant="soft"
                      size="compact"
                      disabled={blocked}
                      onClick={startTakeaway}
                    >
                      <Plus size={16} />
                      Nuevo pedido para recoger
                    </Button>
                  </div>

                  <div id={pickupId} hidden={!takeawayOpen}>
                    <div className="mp-cards">
                      {takeaway.map((order) => (
                        <button
                          type="button"
                          className="mp-card"
                          key={order.id}
                          disabled={resource.busy}
                          onClick={() => resource.select(order.id)}
                        >
                          <div className="mp-card-line">
                            <strong>Pedido #{order.id}</strong>
                            <OrderStatusBadge status={order.status} />
                          </div>

                          {orderInfo(order)}

                          <small>
                            <Clock size={13} />
                            {new Date(
                              order.createdAt
                            ).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>

                          <span className="mp-card-action">
                            {order.status === "DELIVERED"
                              ? "Cerrar cuenta"
                              : "Ver cuenta"}
                            <ArrowRight size={16} />
                          </span>
                        </button>
                      ))}
                    </div>

                    {!takeaway.length && (
                      <p className="mp-empty">
                        No hay pedidos para recoger en este estado.
                      </p>
                    )}
                  </div>
                </section>
              )}

              <section>
                <div className="mp-section-heading">
                  <h3>Mesas del salón</h3>
                  <span>
                    {visible.length}{" "}
                    {visible.length === 1 ? "mesa" : "mesas"}
                  </span>
                </div>

                <div className="mp-mobile-table-picker">
                  <SelectField
                    label="Elegir mesa"
                    value=""
                    placeholder="Selecciona una mesa"
                    disabled={resource.busy}
                    onValueChange={openTable}
                    options={visible.map(
                      ({ table: entry, order }) => ({
                        value: entry.id,
                        label: `${entry.name} · ${
                          order
                            ? STATUS_LABELS[order.status]
                            : "Libre"
                        }`,
                        disabled: !order && blocked,
                      })
                    )}
                  />
                </div>

                <div className="mp-cards">
                  {visible.map(({ table: entry, order }) => (
                    <button
                      type="button"
                      className="mp-card"
                      key={entry.id}
                      disabled={resource.busy || (!order && blocked)}
                      onClick={() => openTable(entry.id)}
                    >
                      <div className="mp-card-line">
                        <strong>
                          <Utensils size={21} />
                          {entry.name}
                        </strong>

                        <OrderStatusBadge
                          status={order?.status ?? "FREE"}
                        />
                      </div>

                      <p>
                        {entry.code}
                        {entry.capacity
                          ? ` · Capacidad: ${entry.capacity}`
                          : ""}
                      </p>

                      {entry.continuityOnly && (
                        <p className="mp-warning">
                          Mesa fuera del listado activo · continúa la
                          cuenta existente
                        </p>
                      )}

                      {order ? (
                        orderInfo(order)
                      ) : (
                        <p className="mp-free-text">
                          Disponible para una nueva cuenta
                        </p>
                      )}

                      <span className="mp-card-action">
                        {!order
                          ? "Abrir mesa"
                          : order.status === "DELIVERED"
                            ? "Cerrar cuenta"
                            : order.status === "OPEN"
                              ? "Continuar cuenta"
                              : "Ver cuenta"}

                        <ArrowRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>

                {!visible.length && (
                  <p className="mp-empty">
                    {board.length
                      ? "No hay mesas en este estado."
                      : "Este punto de venta no tiene mesas disponibles. Puedes crear un pedido para recoger."}
                  </p>
                )}
              </section>

              <p className="mp-updated">
                Última actualización{" "}
                {new Date(data.updatedAt).toLocaleTimeString(
                  "es-CO",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}{" "}
                · Actualización automática cada 15 segundos.
              </p>
            </>
          )}
        </>
      )}

      {chooseTable && (
        <BottomSheet
          id={`${modalId}-tables`}
          open
          variant="modal"
          title="Elegir una mesa libre"
          className="mp-dialog"
          onClose={() => setChooseTable(false)}
        >
          <div className="mp-dialog-content">
            <p>
              {location.name} · {location.code}
            </p>

            <div className="mp-table-choices">
              {board
                .filter(
                  ({ table: entry, order }) =>
                    entry.isActive && !order
                )
                .map(({ table: entry }) => (
                  <Button
                    variant="secondary"
                    key={entry.id}
                    disabled={blocked}
                    onClick={() => openTable(entry.id)}
                  >
                    <Utensils size={18} />
                    {entry.name}
                  </Button>
                ))}
            </div>
          </div>
        </BottomSheet>
      )}

      {(resource.selectedId || draft) && (
        <BottomSheet
          id={`${modalId}-order`}
          open
          variant="modal"
          title={title}
          busy={resource.busy}
          className={`sales-workspace mp-workspace ${
            active?.status === "DELIVERED"
              ? "mp-workspace-summary"
              : ""
          }`}
          onClose={closeWorkspace}
        >
          <div className="mp-workspace-location">
            <MapPin size={14} />
            Punto de venta:
            <strong>
              {location.name} · {location.code}
            </strong>
            {workspaceOrder && (
              <span>
                {active ? `Orden #${active.id}` : "Borrador"}
                <OrderStatusBadge status={workspaceOrder.status} />
              </span>
            )}
          </div>

          {active?.status === "DELIVERED" ? (
            <OrderSummaryView
              order={active}
              table={table}
              resource={resource}
            />
          ) : workspaceOrder && data ? (
            <OrderWorkspace
              key={
                workspaceOrder.id ??
                `draft:${workspaceOrder.serviceType}:${
                  workspaceOrder.restaurantTableId ?? "takeaway"
                }`
              }
              resource={resource}
              order={workspaceOrder}
              data={data}
            />
          ) : (
            <div className="mp-dialog-content">
              <p role="status">
                {resource.error ||
                  resource.notice ||
                  "Cargando cuenta…"}
              </p>

              <Button
                variant="secondary"
                disabled={resource.busy}
                onClick={resource.retry}
              >
                Actualizar cuenta
              </Button>
            </div>
          )}
        </BottomSheet>
      )}

      {leaving && (
        <BottomSheet
          id={`${modalId}-leave`}
          open
          variant="modal"
          title={
            leaving.kind === "location"
              ? "¿Cambiar de punto de venta?"
              : "¿Descartar este borrador?"
          }
          className="mp-dialog"
          busy={resource.busy}
          onClose={() => setLeaving(null)}
        >
          <div className="mp-dialog-content">
            <p>
              Los cambios locales sin enviar se perderán. Las órdenes
              guardadas se conservarán.
            </p>

            <div className="sales-form-actions">
              <Button
                variant="secondary"
                onClick={() => setLeaving(null)}
              >
                Continuar editando
              </Button>

              <Button
                variant="danger"
                disabled={resource.busy || resource.uncertain}
                onClick={() => {
                  if (leaving.kind === "location") {
                    locations.select(leaving.id);
                  } else {
                    resource.discardLocal();
                  }

                  setLeaving(null);
                }}
              >
                {leaving.kind === "location"
                  ? "Descartar y cambiar"
                  : "Descartar borrador"}
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </section>
  );
}
