import { useCallback, useId, useMemo, useState } from "react";

import { useSearchParams, useNavigate } from "react-router";

import { useRouteState } from "../../../hooks/useRouteState";
import { request } from "../../../lib/http/client";
import { orderResponseSchema } from "../schemas/sales.schema";
import { useRemote } from "../hooks/usePublicOrders";
import { QuickSaleContext } from "../components/QuickSaleContext";
import { isQuickSale } from "../services/quick-sale.service";

import "../quick-sale.css";
import {
  History,
  MapPin,
  Plus,
  RefreshCw,
  Store,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

import { MesasGrid } from "../components/MesasGrid";
import { useAppShell } from "../../../app/layout/shell-context";

import { Alert } from "../../../components/feedback/Alert";
import { SelectField } from "../../../components/forms/SelectField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import type { AuthSession } from "../../auth/types/auth.types";

import { useSales } from "../hooks/useSales";
import { useSalesLocations } from "../hooks/useSalesLocations";

import { PreorderList } from "../components/PreorderList";
import { PreorderDetail } from "../components/PreorderDetail";
import { canEditPreorder } from "../utils/preorders";

import "../preorders.css";

import { OrderWorkspace } from "../components/OrderWorkspace";
import { OrderSummaryView } from "../components/OrderSummaryView";
import { CheckoutDialog } from "../components/CheckoutDialog";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { SalesSummary } from "../components/SalesSummary";
import { SalesHistory } from "../components/SalesHistory";

import { WORKFLOW_LABELS } from "../../kitchen-flow/kitchen-flow.schema";

import {
  hasEveryPermission,
  hasGlobalLocationAccess,
  hasPermission,
} from "../../auth/utils/permissions";

import {
  getBoardTables,
  matchesOrder,
  SALES_FILTERS,
} from "../utils/sales-board";

import type { SalesFilter } from "../utils/sales-board";

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
  const { session } = useAppShell();
  const globalAccess = hasGlobalLocationAccess(session);

  return (
    <div className="mp-location-control">
      <span className="mp-location-icon">
        <Store size={22} />
      </span>

      {!globalAccess && locations.options.length === 1 && value ? (
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

  const allowed = hasEveryPermission(session, [
    "orders.read",
    "tables.read",
    "catalog.read",
  ]);

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
  const [params, setParams] = useSearchParams();
  const orderId = params.get("orderId");

  function closeLinkedOrder() {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        next.delete("orderId");
        next.delete("requestId");

        return next;
      },
      { replace: true }
    );
  }

  if (orderId !== null) {
    return (
      <LinkedSalesOrder
        key={orderId}
        orderId={orderId}
        session={session}
        locations={locations}
        onClose={closeLinkedOrder}
      />
    );
  }

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

function LinkedSalesOrder({
  orderId,
  session,
  locations,
  onClose,
}: {
  orderId: string;
  session: AuthSession;
  locations: Locations;
  onClose: () => void;
}) {
  const loader = useCallback(
    async (signal: AbortSignal) => {
      if (!/^[1-9]\d*$/.test(orderId)) {
        throw new Error("El identificador del pedido no es válido.");
      }

      const response = await request(
        "/orders/" + orderId,
        orderResponseSchema,
        {
          accessToken: session.accessToken,
          signal,
          cache: "no-store",
        }
      );

      const order = response.data.order;

      if (
        order.id !== orderId ||
        order.businessId !== session.business.id ||
        order.location.id !== order.locationId ||
        order.location.locationType !== "POINT_OF_SALE"
      ) {
        throw new Error(
          "El pedido no corresponde al negocio o punto de venta."
        );
      }

      return order;
    },
    [orderId, session.accessToken, session.business.id]
  );

  const resource = useRemote(loader);

  const location = locations.options.find(
    (option) => option.id === resource.data?.locationId
  );

  const issue =
    resource.error ||
    locations.error ||
    (!resource.loading && !locations.loading && !location
      ? "No tienes acceso al punto de venta de este pedido."
      : "");

  if (resource.loading || locations.loading || issue || !location) {
    return (
      <section className="mp-page">
        <BottomSheet
          id="linked-order-loading"
          open
          variant="modal"
          className="mp-dialog"
          title="Abrir pedido"
          onClose={onClose}
        >
          <div className="mp-dialog-content">
            {issue ? (
              <Alert>{issue}</Alert>
            ) : (
              <p role="status">Consultando pedido…</p>
            )}

            <div className="sales-form-actions">
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>

              {issue && (
                <Button
                  onClick={() => {
                    resource.reload();
                    locations.retry();
                  }}
                >
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        </BottomSheet>
      </section>
    );
  }

  return (
    <SalesContent
      key={orderId + ":" + location.id}
      session={session}
      location={location}
      locations={locations}
      initialOrderId={orderId}
      onLinkedOrderClose={() => {
        onClose();
      }}
    />
  );
}

function SalesContent({
  session,
  location,
  locations,
  initialOrderId = null,
  onLinkedOrderClose,
}: {
  session: AuthSession;
  location: SalesLocation;
  locations: Locations;
  initialOrderId?: string | null;
  onLinkedOrderClose?: () => void;
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
    locations.invalidate,
    initialOrderId
  );

  const modalId = useId();

  const [navigationParams] = useSearchParams();

  const navigate = useNavigate();

  const [filter, setFilter] = useRouteState<SalesFilter>(
    "salesFilter",
    "ALL"
  );
  const [editingPreorderId, setEditingPreorderId] = useState<
    string | null
  >(null);
  const [chooseTable, setChooseTable] = useState(false);
  const [history, setHistory] = useState(false);

  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const [quickAutoPay, setQuickAutoPay] = useState(false);

  const [quickCashSessionId, setQuickCashSessionId] = useState("");

  const canCheckout = hasEveryPermission(session, [
    "orders.close",
    "cash.sessions.read",
  ]);
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
          sourceChannel: draft.sourceChannel ?? "IN_PERSON",
          customerName: draft.customerName ?? null,
          customerPhone: draft.customerPhone ?? null,
          customerEmail: draft.customerEmail ?? null,
          paymentStatus: "PENDING" as const,
          status: "OPEN" as const,
          kitchenWorkflowMode: null,
          subtotal: "0",
          items: [],
        }
      : null);

  const canManageOrders = hasPermission(session, "orders.manage");

  const quickSale = !!workspaceOrder && isQuickSale(workspaceOrder);

  const preorderDetail =
    !!active &&
    active.serviceType !== "TABLE" &&
    (editingPreorderId !== active.id ||
      !canEditPreorder(active) ||
      !canManageOrders);

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
      : workspaceOrder.serviceType === "DELIVERY"
        ? "Pedido a domicilio"
        : "Pedido para recoger"
    : "Cargando cuenta…";

  function startCheckout() {
    if (
      !active ||
      active.status !== "DELIVERED" ||
      !canCheckout ||
      blocked ||
      Object.keys(resource.drafts[active.id] ?? {}).length > 0
    ) {
      return;
    }

    setCheckoutId(active.id);
  }

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

  function startTakeaway(quick = false) {
    if (!canManageOrders || blocked) return;

    setEditingPreorderId(null);
    setQuickAutoPay(false);

    resource.start({
      serviceType: "TAKEAWAY",
      sourceChannel: quick ? "IN_PERSON" : "WHATSAPP",
      restaurantTableId: null,
      customerCount: null,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
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
    if (resource.busy) return;

    if (
      active?.serviceType !== "TABLE" &&
      active &&
      editingPreorderId === active.id
    ) {
      setEditingPreorderId(null);
      resource.retry();
      return;
    }

    if (onLinkedOrderClose) {
      if (resource.uncertain || resource.hasPending) {
        setLeaving({ kind: "close" });
        return;
      }

      onLinkedOrderClose();
      return;
    }

    setEditingPreorderId(null);
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
    <Button
      size="compact"
      disabled={blocked || !canManageOrders}
      onClick={() => startTakeaway()}
    >
      <Plus size={16} />
      Nuevo pedido para recoger
    </Button>
  );

  return (
    <section className="mp-page sales-page sales-board">
      {resource.kitchenSettings.loading && (
        <p role="status">Consultando el modo de cocina…</p>
      )}

      {resource.kitchenSettings.error && (
        <Alert>
          <p>{resource.kitchenSettings.error}</p>
          <Button
            variant="soft"
            size="compact"
            onClick={resource.kitchenSettings.retry}
          >
            Reintentar configuración de cocina
          </Button>
        </Alert>
      )}

      {resource.kitchenSettings.data && (
        <p className="kf-location-mode">
          Nuevas órdenes:{" "}
          <strong>
            {
              WORKFLOW_LABELS[
                resource.kitchenSettings.data.workflowMode
              ]
            }
          </strong>
        </p>
      )}
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
                <RefreshCw size={17} aria-hidden="true" />
              </Button>

              <Button
                variant="soft"
                size="compact"
                disabled={blocked}
                onClick={() => setChooseTable(true)}
              >
                <UtensilsCrossed size={16} aria-hidden="true" />
                Abrir mesa
              </Button>

              {canManageOrders && (
                <Button
                  variant="soft"
                  size="compact"
                  className="mp-quick-sale-button"
                  disabled={blocked}
                  onClick={() => startTakeaway(true)}
                >
                  <Zap size={16} aria-hidden="true" />
                  Caja rápida
                </Button>
              )}

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

          {!data && resource.loading && (
            <MesasGrid
              entries={[]}
              loading
              disabled={() => true}
              onOpen={openTable}
            />
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

              <PreorderList
                orders={data.orders}
                scope={scope}
                disabled={blocked}
                onOpen={(id) => {
                  setEditingPreorderId(null);

                  const next = new URLSearchParams(navigationParams);

                  next.set("orderId", id);
                  next.delete("requestId");

                  navigate({
                    pathname: "/ventas",
                    search: next.toString(),
                  });
                }}
              />

              <section>
                <div className="mp-section-heading">
                  <h3>Mesas del salón</h3>

                  <span>
                    {visible.length}{" "}
                    {visible.length === 1 ? "mesa" : "mesas"}
                  </span>
                </div>

                <div
                  className="preorder-filters"
                  role="group"
                  aria-label="Estado de las mesas"
                >
                  {SALES_FILTERS.map((option) => (
                    <Button
                      key={option.id}
                      size="compact"
                      variant={
                        filter === option.id ? "primary" : "soft"
                      }
                      aria-pressed={filter === option.id}
                      onClick={() => setFilter(option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <MesasGrid
                  entries={visible}
                  loading={resource.loading}
                  disabled={({ order }) =>
                    resource.busy || (!order && blocked)
                  }
                  onOpen={openTable}
                  pendingCount={pendingCount}
                  emptyText={
                    board.length
                      ? "No hay mesas en este estado. Prueba otro filtro."
                      : "Este punto de venta no tiene mesas disponibles. Puedes crear un pedido para recoger."
                  }
                />
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

            <MesasGrid
              compact
              entries={board.filter(
                ({ table, order }) => table.isActive && !order
              )}
              disabled={() => blocked}
              onOpen={openTable}
              emptyText="Todas las mesas están ocupadas o no hay mesas activas en este punto de venta."
            />
          </div>
        </BottomSheet>
      )}

      {(resource.selectedId || draft) && (
        <BottomSheet
          id={`${modalId}-order`}
          open
          variant="modal"
          title={
            quickSale
              ? "Caja rápida"
              : preorderDetail && active
                ? `Orden #${active.id}`
                : title
          }
          busy={resource.busy}
          className={
            quickSale
              ? "sales-workspace mp-workspace quick-sale-dialog"
              : preorderDetail
                ? "preorder-dialog"
                : `sales-workspace mp-workspace ${
                    active?.status === "DELIVERED"
                      ? "mp-workspace-summary"
                      : ""
                  }`
          }
          onClose={closeWorkspace}
        >
          {quickSale && (
            <QuickSaleContext
              scope={scope}
              order={active}
              value={quickCashSessionId}
              onChange={setQuickCashSessionId}
              disabled={blocked}
            />
          )}

          {!quickSale &&
            !preorderDetail &&
            active?.status === "DELIVERED" && (
              <div className="mp-workspace-location">
                <MapPin size={14} />
                Punto de venta:
                <strong>
                  {location.name} · {location.code}
                </strong>
                <span>
                  Orden #{active.id}
                  <OrderStatusBadge status={active.status} />
                </span>
              </div>
            )}

          {quickSale && workspaceOrder && data ? (
            <OrderWorkspace
              key={workspaceOrder.id ?? "quick-draft"}
              resource={resource}
              order={workspaceOrder}
              data={data}
              quickSale
              onBeforeSave={() =>
                setQuickAutoPay(
                  hasPermission(session, "orders.payments.manage")
                )
              }
              onSaved={() => setEditingPreorderId(null)}
              summary={
                preorderDetail && active ? (
                  <PreorderDetail
                    key={active.id}
                    order={active}
                    resource={resource}
                    scope={scope}
                    onEdit={() => setEditingPreorderId(active.id)}
                    onClose={closeWorkspace}
                    quick={{
                      autoPay: quickAutoPay,
                      cashSessionId: quickCashSessionId,
                      onPaymentClose: () => setQuickAutoPay(false),
                      onNew: () => startTakeaway(true),
                    }}
                  />
                ) : undefined
              }
            />
          ) : preorderDetail && active ? (
            <PreorderDetail
              key={active.id}
              order={active}
              resource={resource}
              scope={scope}
              onEdit={() => setEditingPreorderId(active.id)}
              onClose={closeWorkspace}
            />
          ) : active?.status === "DELIVERED" ? (
            <OrderSummaryView
              order={active}
              table={table}
              resource={resource}
              onCheckout={canCheckout ? startCheckout : undefined}
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
              onCheckout={canCheckout ? startCheckout : undefined}
              onSaved={() => setEditingPreorderId(null)}
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

      {checkoutId && canCheckout && (
        <CheckoutDialog
          key={JSON.stringify([
            checkoutId,
            session.accessToken,
            session.authorization.permissions,
            session.authorization.locationAccess,
          ])}
          orderId={checkoutId}
          locationId={location.id}
          onRecorded={resource.retry}
          onClose={() => {
            setCheckoutId(null);
            resource.retry();
          }}
        />
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
          className="mp-dialog app-confirm-dialog"
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
                  } else if (onLinkedOrderClose) {
                    onLinkedOrderClose();
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
