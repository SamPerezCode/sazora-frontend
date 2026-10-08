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
import {
  dayKey,
  formatQuantity,
  itemTypeLabels,
  searchKey,
  unitLabels,
  validTimeZone,
} from "../utils/inventory-format";

const actionLabels: Record<InventoryAction, string> = {
  detail: "Ver detalle",
  edit: "Editar información",
  movement: "Registrar movimiento",
  history: "Ver movimientos",
  links: "Gestionar consumo por producto",
  status: "Cambiar estado",
};

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
  const [params] = useSearchParams();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [activity, setActivity] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [notice, setNotice] = useState("");
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

  function pendingScreen(label: string) {
    setNotice(
      label + ": esta pantalla se habilitará en la siguiente etapa."
    );
  }

  function onAction(action: InventoryAction, item: InventoryItem) {
    const label =
      action === "status"
        ? item.isActive
          ? "Desactivar"
          : "Activar"
        : actionLabels[action];

    pendingScreen(label + " · " + item.name);
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
        <button type="button" aria-current="page">
          <Boxes size={16} />
          Existencias
        </button>

        <button
          type="button"
          disabled
          title="Disponible en la siguiente etapa"
        >
          <History size={16} />
          Movimientos
        </button>

        <button
          type="button"
          disabled
          title="Disponible en la siguiente etapa"
        >
          <Link2 size={16} />
          Consumo por producto
        </button>

        <button
          type="button"
          disabled
          title="Disponible en la siguiente etapa"
        >
          <Factory size={16} />
          Producción
        </button>
      </nav>

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

          <Button
            size="sm"
            onClick={() => pendingScreen("Nuevo artículo")}
          >
            <PackagePlus size={16} />
            Nuevo artículo
          </Button>
        </div>
      </header>

      {productId && (
        <p className="inventory-message">
          Llegaste desde el producto #{productId}. Su configuración de
          inventario estará disponible en la siguiente etapa.
        </p>
      )}

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
              onClick={() => pendingScreen("Registrar entrada")}
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

      <div aria-busy={resource.items.pending}>
        {resource.items.loading ? (
          <div className="inventory-loading" role="status">
            <span className="sr-only">Cargando existencias…</span>

            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} />
            ))}
          </div>
        ) : items && visible.length > 0 ? (
          <InventoryList items={visible} onAction={onAction} />
        ) : (
          <div className="inventory-empty">
            <Boxes size={32} aria-hidden="true" />

            <h3>
              {resource.items.error && !items
                ? "No se pudieron cargar las existencias"
                : items?.length
                  ? "Sin resultados"
                  : "Todavía no hay artículos"}
            </h3>

            <p>
              {items?.length
                ? "Prueba con otros filtros o modifica la búsqueda."
                : resource.items.error
                  ? "Reintenta la consulta para continuar."
                  : "Aquí aparecerán los artículos registrados en inventario."}
            </p>

            {filteredByUser && (
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
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
    </section>
  );
}
