import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Boxes,
  ChevronDown,
  CircleX,
  Factory,
  FilterX,
  History,
  Link2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { InventoryList } from "../components/InventoryList";
import type { InventoryAction } from "../components/InventoryActions";
import { useInventory } from "../hooks/useInventory";
import type { InventoryItem } from "../schemas/inventory.schema";
import { InventoryDialog } from "../components/InventoryDialog";
import type { InventoryDialogAction } from "../components/InventoryDialog";
import { InventoryCreateDialog } from "../components/InventoryCreateDialog";
import { InventoryMovements } from "../components/InventoryMovements";
import { InventoryConsumption } from "../components/InventoryConsumption";
import { InventoryProduction } from "../components/InventoryProduction";
import { ProductInventorySetupDialog } from "../components/ProductInventorySetupDialog";
import {
  dayKey,
  formatQuantity,
  itemTypeLabels,
  searchKey,
  unitLabels,
  validTimeZone,
} from "../utils/inventory-format";

import {
  InventorySkeleton,
  InventoryLoadError,
  InventoryEmptyState,
} from "../components/InventoryStates";

export function InventoryPage() {
  const { session } = useAppShell();

  return (
    <InventoryScreen
      key={session.business.id + ":" + session.membership.id}
    />
  );
}

function InventoryScreen() {
  const { session, settings } = useAppShell();
  const resource = useInventory(session);
  const [params, setParams] = useSearchParams();

  const [creating, setCreating] = useState(false);
  const [revision, setRevision] = useState(0);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [activity, setActivity] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<InventoryDialogAction | null>(
    null
  );
  const [clock, setClock] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock(Date.now()),
      60_000
    );

    return () => window.clearInterval(timer);
  }, []);

  const items = resource.items.data;

  const active = items?.filter((item) => item.isActive) ?? [];

  const critical = active.filter(
    (item) => item.stockStatus !== "AVAILABLE"
  );

  const exhausted = active.filter(
    (item) => item.stockStatus === "OUT_OF_STOCK"
  );

  const low = active.filter(
    (item) => item.stockStatus === "LOW_STOCK"
  );

  const query = searchKey(search);

  const filtered = (items ?? []).filter((item) => {
    const matchesStock =
      stock === "ALL" ||
      (stock === "ATTENTION"
        ? item.isActive && item.stockStatus !== "AVAILABLE"
        : item.stockStatus === stock);

    return (
      searchKey(item.name + " " + (item.sku ?? "")).includes(query) &&
      (type === "ALL" || item.itemType === type) &&
      matchesStock &&
      (activity === "ALL" ||
        item.isActive === (activity === "ACTIVE"))
    );
  });

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize))
  );

  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredByUser =
    !!search ||
    type !== "ALL" ||
    stock !== "ALL" ||
    activity !== "ALL";

  const zone = validTimeZone(settings.data?.timezone);
  const today = zone ? dayKey(clock, zone) : null;

  const todayCount =
    zone && today && resource.movements.data
      ? resource.movements.data.filter(
          (movement) => dayKey(movement.createdAt, zone) === today
        ).length
      : null;

  const updated = resource.items.updatedAt;

  const updatedLabel =
    updated && zone
      ? new Intl.DateTimeFormat("es-CO", {
          timeZone: zone,
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(updated)
      : null;

  // Compatible con la navegación actual desde Productos
  // y con el parámetro propuesto por el backend.
  const productId =
    params.get("setupProductId") ?? params.get("productId");

  const configureProductId =
    productId &&
    (params.get("intent") === "configure" ||
      params.has("setupProductId"))
      ? productId
      : "";

  function finishConfiguration() {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        next.delete("intent");
        next.delete("setupProductId");
        next.set("tab", "consumption");

        if (productId) {
          next.set("productId", productId);
        }

        return next;
      },
      { replace: true }
    );
  }

  function clearFilters() {
    setSearch("");
    setType("ALL");
    setStock("ALL");
    setActivity("ALL");
    setPage(1);
  }

  function showCritical() {
    setSearch("");
    setType("ALL");
    setStock("ATTENTION");
    setActivity("ACTIVE");
    setPage(1);
  }

  const tab =
    params.get("tab") === "production"
      ? "production"
      : params.get("tab") === "movements"
        ? "movements"
        : params.get("tab") === "consumption" || productId
          ? "consumption"
          : "stock";

  function openTab(
    next: "stock" | "movements" | "consumption" | "production",
    itemId?: string
  ) {
    const nextParams = new URLSearchParams(params);

    [
      "tab",
      "itemId",
      "productId",
      "setupProductId",
      "intent",
    ].forEach((key) => nextParams.delete(key));

    if (next !== "stock") {
      nextParams.set("tab", next);
    }

    if (itemId) {
      nextParams.set("itemId", itemId);
    }

    setParams(nextParams);
  }

  function refreshInventory() {
    resource.refresh();
    setRevision((value) => value + 1);
  }

  function onAction(action: InventoryAction, item: InventoryItem) {
    if (
      action === "detail" ||
      action === "edit" ||
      action === "movement" ||
      action === "status"
    ) {
      setDialog({
        kind: action,
        id: item.id,
      });

      return;
    }

    openTab(
      action === "history" ? "movements" : "consumption",
      item.id
    );
  }

  return (
    <section
      className="inventory-page"
      aria-label="Gestión de inventario"
    >
      <nav
        className="inventory-tabs"
        aria-label="Secciones de inventario"
      >
        <button
          type="button"
          aria-current={tab === "stock" ? "page" : undefined}
          onClick={() => openTab("stock")}
        >
          <Boxes size={16} />
          Existencias
        </button>

        <button
          type="button"
          aria-current={tab === "movements" ? "page" : undefined}
          onClick={() => openTab("movements")}
        >
          <History size={16} />
          Movimientos
        </button>

        <button
          type="button"
          aria-current={tab === "consumption" ? "page" : undefined}
          onClick={() => openTab("consumption")}
        >
          <Link2 size={16} />
          Consumo por producto
        </button>

        <button
          type="button"
          aria-current={tab === "production" ? "page" : undefined}
          onClick={() => openTab("production")}
        >
          <Factory size={16} />
          Producción
        </button>
      </nav>

      {notice && tab === "consumption" && (
        <p className="inventory-message" role="status">
          {notice}
        </p>
      )}

      {tab === "production" ? (
        <InventoryProduction
          revision={revision}
          onChanged={refreshInventory}
        />
      ) : tab === "movements" ? (
        <InventoryMovements
          key={"movements:" + (params.get("itemId") ?? "")}
          items={items ?? []}
          initialItemId={params.get("itemId") ?? ""}
          revision={revision}
          onRegister={() =>
            setDialog({
              kind: "movement",
            })
          }
        />
      ) : tab === "consumption" ? (
        <InventoryConsumption
          key={
            "consumption:" +
            (params.get("itemId") ?? "") +
            ":" +
            (productId ?? "") +
            ":" +
            (configureProductId ? "configure" : "list")
          }
          items={items ?? []}
          itemsReady={
            items !== null &&
            !resource.items.pending &&
            !resource.items.error
          }
          itemsError={resource.items.error}
          initialItemId={params.get("itemId") ?? ""}
          initialProductId={productId ?? ""}
          revision={revision}
          onItem={(id) =>
            setDialog({
              kind: "detail",
              id,
            })
          }
          onChanged={refreshInventory}
        />
      ) : resource.items.loading ? (
        <InventorySkeleton />
      ) : items === null ? (
        <InventoryLoadError
          message={resource.items.error}
          status={resource.items.errorStatus}
          busy={resource.items.pending}
          onRetry={resource.refresh}
        />
      ) : (
        <>
          <header className="inventory-heading">
            <div>
              <h2>Inventario</h2>

              <p>
                {items
                  ? active.length + " artículos activos"
                  : "Consulta de existencias"}

                {updatedLabel && " · Actualizado " + updatedLabel}

                {resource.items.refreshing && " · Actualizando…"}
              </p>
            </div>

            <div className="inventory-buttons">
              <Button
                variant="secondary"
                size="sm"
                onClick={resource.refresh}
                loading={resource.pending}
                loadingText="Actualizando…"
              >
                <RefreshCw size={16} />
                Actualizar
              </Button>

              <Button size="sm" onClick={() => setCreating(true)}>
                <PackagePlus size={16} />
                Nuevo artículo
              </Button>
            </div>
          </header>

          {notice && (
            <div className="inventory-message" role="status">
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {resource.items.error && (
            <div
              className="inventory-message inventory-error"
              role="alert"
            >
              <span>
                {resource.items.error}

                {items &&
                  " Se conserva la última consulta; los datos pueden estar desactualizados."}
              </span>

              <Button
                variant="secondary"
                size="sm"
                onClick={resource.refresh}
                disabled={resource.pending}
              >
                Reintentar
              </Button>
            </div>
          )}

          <div className="inventory-metrics">
            {[
              {
                label: "Artículos activos",
                value: items ? active.length : null,
                Icon: Boxes,
                tone: "normal",
              },
              {
                label: "Agotados",
                value: items ? exhausted.length : null,
                Icon: CircleX,
                tone: "danger",
              },
              {
                label: "Bajo el mínimo",
                value: items ? low.length : null,
                Icon: TriangleAlert,
                tone: "warning",
              },
              {
                label: "Movimientos hoy",
                value: todayCount,
                Icon: History,
                tone: "normal",
              },
            ].map(({ label, value, Icon, tone }) => (
              <div
                key={label}
                className="inventory-metric"
                data-tone={tone}
              >
                <span className="inventory-metric-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>

                <div>
                  <p>{label}</p>
                  <strong>{value ?? "—"}</strong>
                </div>
              </div>
            ))}
          </div>

          {(resource.movements.error || !zone) && (
            <p className="inventory-muted" role="status">
              {resource.movements.error
                ? "No se actualizó el contador de movimientos: " +
                  resource.movements.error
                : "El contador de hoy requiere la zona horaria del negocio."}
            </p>
          )}

          {critical.length > 0 && (
            <div className="inventory-attention">
              <details>
                <summary>
                  <TriangleAlert size={18} />

                  <span>
                    Hay {critical.length} artículos que requieren
                    atención.
                  </span>

                  <ChevronDown size={16} />
                </summary>

                <ul>
                  {critical.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong>

                      <span>
                        {formatQuantity(item.currentStock)}{" "}
                        {unitLabels[item.baseUnit]}
                        {" · Mínimo "}
                        {formatQuantity(item.minimumStock)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="inventory-buttons">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={showCritical}
                >
                  Ver artículos críticos
                </Button>

                <Button
                  size="sm"
                  onClick={() =>
                    setDialog({
                      kind: "movement",
                      initialType: "PURCHASE",
                    })
                  }
                >
                  <Plus size={16} />
                  Registrar entrada
                </Button>
              </div>
            </div>
          )}

          <div className="inventory-filters">
            <div className="inventory-search">
              <label htmlFor="inventory-search" className="sr-only">
                Buscar por nombre o SKU
              </label>

              <Search size={16} aria-hidden="true" />

              <input
                id="inventory-search"
                type="search"
                value={search}
                placeholder="Buscar por nombre o SKU"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <SelectField
              label="Tipo de artículo"
              hideLabel
              value={type}
              options={[
                {
                  value: "ALL",
                  label: "Todos los tipos",
                },
                ...Object.entries(itemTypeLabels).map(
                  ([value, label]) => ({ value, label })
                ),
              ]}
              onValueChange={(value) => {
                setType(value);
                setPage(1);
              }}
            />

            <SelectField
              label="Existencias"
              hideLabel
              value={stock}
              options={[
                { value: "ALL", label: "Todo el stock" },
                {
                  value: "ATTENTION",
                  label: "Requieren atención",
                },
                {
                  value: "OUT_OF_STOCK",
                  label: "Agotado",
                },
                {
                  value: "LOW_STOCK",
                  label: "Bajo mínimo",
                },
                {
                  value: "AVAILABLE",
                  label: "Disponible",
                },
              ]}
              onValueChange={(value) => {
                setStock(value);
                setPage(1);
              }}
            />

            <SelectField
              label="Estado del artículo"
              hideLabel
              value={activity}
              options={[
                {
                  value: "ALL",
                  label: "Activos e inactivos",
                },
                {
                  value: "ACTIVE",
                  label: "Solo activos",
                },
                {
                  value: "INACTIVE",
                  label: "Solo inactivos",
                },
              ]}
              onValueChange={(value) => {
                setActivity(value);
                setPage(1);
              }}
            />

            {filteredByUser && (
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                <FilterX size={16} />
                Limpiar filtros
              </Button>
            )}
          </div>

          <div aria-busy={resource.items.refreshing}>
            {visible.length > 0 ? (
              <InventoryList items={visible} onAction={onAction} />
            ) : (
              <InventoryEmptyState
                filtered={items.length > 0}
                onClear={clearFilters}
                onCreate={() => setCreating(true)}
              />
            )}
          </div>

          {filtered.length > 10 && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              itemLabel="artículos"
              totalLabel={
                filteredByUser
                  ? (items?.length ?? 0) + " artículos en total"
                  : undefined
              }
              controlsId="inventory-results"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}

          {items && filtered.length <= 10 && (
            <p className="inventory-muted" role="status">
              {filtered.length}{" "}
              {filtered.length === 1 ? "artículo" : "artículos"}
              {filteredByUser && " · " + items.length + " en total"}
            </p>
          )}
        </>
      )}

      {configureProductId && (
        <ProductInventorySetupDialog
          key={session.accessToken + ":" + configureProductId}
          productId={configureProductId}
          onClose={() => {
            finishConfiguration();
            refreshInventory();
          }}
          onResolved={(alreadyConfigured) => {
            finishConfiguration();

            setNotice(
              alreadyConfigured
                ? "El producto ya tenía inventario. Se muestran sus relaciones existentes."
                : "Inventario configurado. El descuento automático por venta está activo."
            );

            refreshInventory();
          }}
        />
      )}

      {creating && (
        <InventoryCreateDialog
          key={session.accessToken}
          onClose={() => {
            setCreating(false);
            refreshInventory();
          }}
          onSaved={() => {
            setCreating(false);
            setNotice("Artículo creado.");
            refreshInventory();
          }}
        />
      )}

      {dialog && (
        <InventoryDialog
          key={
            session.accessToken +
            ":" +
            dialog.kind +
            ":" +
            (dialog.id ?? "general")
          }
          action={dialog}
          onClose={() => setDialog(null)}
          onChanged={(message) => {
            setNotice(message);
            refreshInventory();
          }}
        />
      )}
    </section>
  );
}
