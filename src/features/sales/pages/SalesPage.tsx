import { useId, useState } from "react";
import { Navigate } from "react-router";

import {
  ChevronDown,
  Plus,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { SelectField } from "../../../components/forms/SelectField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { useSales } from "../hooks/useSales";

import { OrderWorkspace } from "../components/OrderWorkspace";
import { SalesOrderCard } from "../components/SalesOrderCard";
import { SalesTableCard } from "../components/SalesTableCard";
import { SalesSummary } from "../components/SalesSummary";

import {
  getBoardTables,
  matchesOrder,
  SALES_FILTERS,
} from "../utils/sales-board";

import type { SalesFilter } from "../utils/sales-board";

import { STATUS_LABELS } from "../schemas/sales.schema";

export function SalesPage() {
  const { session } = useAppShell();

  if (
    !session.authorization.roles.some(
      (role) => role === "ADMIN" || role === "WAITER"
    )
  ) {
    return <Navigate to="/panel" replace />;
  }

  return (
    <SalesContent
      key={session.accessToken}
      token={session.accessToken}
    />
  );
}

function SalesContent({ token }: { token: string }) {
  const resource = useSales(token);
  const modalId = useId();
  const resultsId = useId();
  const takeawayHeadingId = useId();
  const takeawayToggleId = useId();
  const takeawayPanelId = useId();

  const [takeawayOpen, setTakeawayOpen] = useState(false);

  const [filter, setFilter] = useState<SalesFilter>("ALL");

  const { data } = resource;

  const board = getBoardTables(
    data?.tables ?? [],
    data?.orders ?? []
  );

  const visibleTables = board.filter(
    ({ order }) =>
      filter === "ALL" ||
      (filter === "FREE"
        ? !order
        : !!order && matchesOrder(order, filter))
  );

  const takeaway = (data?.orders ?? []).filter(
    (order) =>
      order.serviceType === "TAKEAWAY" && matchesOrder(order, filter)
  );

  const activeOrder =
    data?.order?.id === resource.selectedId ? data.order : null;

  const localDraft = resource.localDraft;

  // Adaptador para reutilizar la vista.
  // id: null indica que todavía no existe una orden en el backend.
  const workspaceOrder =
    activeOrder ??
    (localDraft
      ? {
          serviceType: localDraft.serviceType,
          restaurantTableId: localDraft.restaurantTableId,
          customerCount: localDraft.customerCount,
          notes: localDraft.notes,
          id: null,
          status: "OPEN" as const,
          subtotal: "0",
          items: [],
        }
      : null);

  const workspaceOpen = !!resource.selectedId || !!localDraft;

  const needsConfirmation =
    !!resource.selectedId &&
    !!resource.confirmationIds[resource.selectedId];

  const blocked =
    resource.busy || resource.uncertain || !!resource.error;

  const detailTitle = workspaceOrder
    ? workspaceOrder.serviceType === "TABLE"
      ? (data?.tables.find(
          (table) => table.id === workspaceOrder.restaurantTableId
        )?.name ?? "Mesa")
      : "Para recoger"
    : "Cargando cuenta…";

  function pendingFor(id: string) {
    return Object.values(resource.drafts[id] ?? {}).reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  function openTable(id: string) {
    const entry = board.find(({ table }) => table.id === id);

    if (!entry || resource.busy) return;

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

  return (
    <section className="sales-page sales-board">
      {resource.loading && (
        <p role="status">Cargando mesas y pedidos…</p>
      )}

      {resource.error && (
        <Alert>
          <p>{resource.error}</p>

          <Button
            size="sm"
            variant="secondary"
            disabled={resource.busy}
            onClick={resource.retry}
          >
            Reintentar
          </Button>
        </Alert>
      )}

      {data && (
        <>
          <div className="sales-board-header">
            <div>
              <h2>Mesas y pedidos</h2>

              <p className="sales-board-muted">
                Abre una mesa o continúa atendiendo una cuenta.
              </p>
            </div>

            <button
              type="button"
              className="sales-icon"
              aria-label="Actualizar mesas y pedidos"
              disabled={resource.busy}
              onClick={resource.retry}
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <SalesSummary
            free={
              board.filter(
                ({ table, order }) => table.isActive && !order
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

          <div
            className="sales-board-filters"
            role="group"
            aria-label="Filtrar operación actual"
          >
            {SALES_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                aria-controls={resultsId}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div id={resultsId} className="sales-board-results">
            {filter !== "FREE" && (
              <section
                className="sales-service-group sales-pickup-accordion"
                aria-labelledby={takeawayHeadingId}
              >
                <div className="sales-pickup-header">
                  <h2 id={takeawayHeadingId}>
                    <button
                      id={takeawayToggleId}
                      type="button"
                      className="sales-pickup-toggle"
                      aria-expanded={takeawayOpen}
                      aria-controls={takeawayPanelId}
                      onClick={() => setTakeawayOpen((open) => !open)}
                    >
                      <ShoppingBag size={20} aria-hidden="true" />

                      <span className="sales-pickup-title">
                        Pedidos para recoger
                      </span>

                      <span className="sales-pickup-count">
                        {takeaway.length}

                        <span className="sr-only"> pedidos</span>
                      </span>

                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className="sales-pickup-chevron"
                      />
                    </button>
                  </h2>

                  <Button
                    size="sm"
                    className="sales-pickup-create"
                    disabled={blocked}
                    aria-label="Nuevo pedido para recoger"
                    onClick={() =>
                      resource.start({
                        serviceType: "TAKEAWAY",
                        restaurantTableId: null,
                        customerCount: null,
                        notes: null,
                      })
                    }
                  >
                    <Plus size={16} aria-hidden="true" />

                    <span className="hidden sm:inline">
                      Nuevo pedido para recoger
                    </span>

                    <span className="sm:hidden">Nuevo</span>
                  </Button>
                </div>

                <div
                  id={takeawayPanelId}
                  className="sales-pickup-body"
                  role="region"
                  aria-labelledby={takeawayToggleId}
                  hidden={!takeawayOpen}
                >
                  <div className="sales-board-grid">
                    {takeaway.map((order) => (
                      <SalesOrderCard
                        key={order.id}
                        order={order}
                        pendingCount={pendingFor(order.id)}
                        disabled={resource.busy}
                        onOpen={resource.select}
                      />
                    ))}
                  </div>

                  {!takeaway.length && (
                    <p className="sales-board-empty">
                      No hay pedidos para recoger en este estado.
                    </p>
                  )}
                </div>
              </section>
            )}
            <section
              className="sales-physical-tables"
              aria-label="Mesas del salón"
            >
              <div className="sales-section-heading">
                <h2>Mesas del salón</h2>

                <span className="sales-board-muted">
                  {visibleTables.length} mesas
                </span>
              </div>

              <div className="sales-mobile-table-picker">
                <SelectField
                  label="Elegir mesa"
                  value=""
                  placeholder="Selecciona una mesa"
                  disabled={resource.busy || !visibleTables.length}
                  options={visibleTables.map(({ table, order }) => ({
                    value: table.id,
                    label:
                      table.name +
                      (table.capacity
                        ? ` · ${table.capacity} pax`
                        : "") +
                      " · " +
                      (order ? STATUS_LABELS[order.status] : "Libre"),
                    disabled: !order && blocked,
                  }))}
                  onValueChange={openTable}
                />
              </div>

              <div className="sales-board-grid sales-desktop-tables">
                {visibleTables.map(({ table, order }) => (
                  <SalesTableCard
                    key={table.id}
                    table={table}
                    order={order}
                    pendingCount={order ? pendingFor(order.id) : 0}
                    disabled={order ? resource.busy : blocked}
                    onOpen={() => openTable(table.id)}
                  />
                ))}
              </div>

              {!visibleTables.length && (
                <p className="sales-board-empty">
                  No hay mesas en este estado.
                </p>
              )}
            </section>
          </div>

          <p className="sales-sync">
            Actualización automática cada 15 segundos.
          </p>
        </>
      )}

      {resource.notice && !workspaceOpen && (
        <p className="sales-notice" role="status">
          {resource.notice}
        </p>
      )}

      {resource.uncertain && !workspaceOpen && (
        <Button
          variant="secondary"
          disabled={resource.busy}
          onClick={() => void resource.reconcile()}
        >
          {resource.needsWriteVerification
            ? "Verificar operación"
            : "Ya revisé las cuentas: habilitar acciones"}
        </Button>
      )}

      {workspaceOpen && (
        <BottomSheet
          id={modalId + "-order"}
          open
          variant="modal"
          title={detailTitle}
          busy={resource.busy}
          className={
            workspaceOrder?.status === "DELIVERED"
              ? "sales-workspace sales-workspace-summary"
              : "sales-workspace"
          }
          onClose={() => {
            if (resource.localDraft) {
              resource.discardLocal();
              return;
            }

            resource.select(null);
          }}
        >
          {workspaceOrder && data ? (
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
            <div className="sales-loading">
              <p role="status">
                {resource.sending
                  ? "Enviando pedido..."
                  : resource.notice ||
                    resource.error ||
                    "Cargando cuenta…"}
              </p>

              {needsConfirmation &&
                !resource.cancellationIds[
                  resource.selectedId ?? ""
                ] && (
                  <Button
                    loading={resource.busy}
                    disabled={resource.uncertain}
                    onClick={() => void resource.retryConfirmation()}
                  >
                    Reintentar confirmación
                  </Button>
                )}

              {resource.selectedId &&
                resource.cancellationIds[resource.selectedId] && (
                  <Button
                    disabled={resource.busy}
                    onClick={() => void resource.verifyCancellation()}
                  >
                    Verificar cancelación
                  </Button>
                )}

              {resource.error && (
                <Button
                  disabled={resource.busy}
                  onClick={resource.retry}
                >
                  Actualizar cuenta
                </Button>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </section>
  );
}
