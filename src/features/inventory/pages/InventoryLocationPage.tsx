import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Boxes,
  ChartNoAxesCombined,
  ReceiptText,
  History,
  Factory,
  SlidersHorizontal,
  ClipboardCheck,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { useInventoryRealtime } from "../../../hooks/useInventoryRealtime";
import { Button } from "../components/InventoryButton";
import type { AuthSession } from "../../auth/types/auth.types";
import { useInventoryQuery } from "../hooks/useInventoryQuery";
import {
  loadInventoryWorkspace,
  loadSummary,
  loadUnvalued,
} from "../services/inventory-location.service";
import type { InventoryWorkspace } from "../services/inventory-location.service";
import { InventoryLocationStock } from "../components/InventoryLocationStock";
import { InventoryItemLocationDialog } from "../components/InventoryItemLocationDialog";
import type { ItemAction } from "../components/InventoryItemLocationDialog";
import { InventoryLocationPurchases } from "../components/InventoryLocationPurchases";
import { InventoryPurchaseForm } from "../components/InventoryPurchaseForm";
import { InventoryLocalMovement } from "../components/InventoryLocalMovement";
import {
  Choice,
  DataTable,
  Notice,
} from "../components/InventoryLocationUI";
import { InventorySkeleton } from "../components/InventoryStates";
import { fixed, money } from "../utils/inventory-value";

import { InventoryActivity } from "../components/InventoryActivity";
import { InventoryProductionLocationForm } from "../components/InventoryProductionLocationForm";
import { InventoryKardex } from "../components/InventoryKardex";
import { InventoryReconciliation } from "../components/InventoryReconciliation";

export function InventoryLocationPage() {
  const { session, settings } = useAppShell();
  const [params, setParams] = useSearchParams();

  const selectedTab = params.get("tab") ?? "stock";

  const tab = [
    "summary",
    "stock",
    "purchases",
    "movements",
    "production",
    "kardex",
    "reconciliation",
  ].includes(selectedTab)
    ? selectedTab
    : "stock";

  const locationId = params.get("locationId") ?? "";

  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<ItemAction | null>(null);
  const [purchase, setPurchase] = useState(false);
  const [producing, setProducing] = useState(false);

  const [movement, setMovement] = useState<{
    itemId: string;
    locationId: string;
  } | null>(null);

  const query = useInventoryQuery(
    "location-workspace",
    loadInventoryWorkspace,
    revision
  );

  const refresh = () => setRevision((previous) => previous + 1);

  useInventoryRealtime(session, () => {
    if (query.pending) return false;
    refresh();
    return true;
  });

  function openTab(next: string) {
    setParams((previous) => {
      const result = new URLSearchParams(previous);

      ["productId", "setupProductId", "intent", "itemId"].forEach(
        (key) => result.delete(key)
      );

      result.set("tab", next);
      return result;
    });
  }

  function saved() {
    setAction(null);
    setPurchase(false);
    setProducing(false);
    setMovement(null);

    setNotice("Operación registrada. Actualizando saldos y costos…");

    refresh();
  }
  if (!session.authorization.roles.includes("ADMIN")) {
    return <Notice>No tienes acceso al inventario.</Notice>;
  }

  if (settings.loading || (!query.data && query.pending)) {
    return <InventorySkeleton />;
  }

  if (!settings.data || settings.error) {
    return (
      <Notice>
        {settings.error ?? "No pudimos cargar la configuración."}
        <Button variant="soft" onClick={settings.retry}>
          Reintentar
        </Button>
      </Notice>
    );
  }

  const data = query.data;

  const validLocation =
    !locationId ||
    !!data?.locations.some((location) => location.id === locationId);

  const tabs = [
    {
      id: "summary",
      label: "Resumen",
      Icon: ChartNoAxesCombined,
    },
    { id: "stock", label: "Existencias", Icon: Boxes },
    { id: "purchases", label: "Compras", Icon: ReceiptText },
    { id: "movements", label: "Movimientos", Icon: History },
    { id: "production", label: "Producción", Icon: Factory },
    {
      id: "kardex",
      label: "Kardex y costos",
      Icon: SlidersHorizontal,
      disabled: true,
    },
    {
      id: "reconciliation",
      label: "Conciliación",
      Icon: ClipboardCheck,
      disabled: true,
    },
  ];

  const currency = settings.data.currencyCode;
  const timezone = settings.data.timezone;

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 text-heading">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">INVENTARIO</p>
          <h2 className="text-2xl font-bold">
            {tabs.find((entry) => entry.id === tab)?.label}
          </h2>
        </div>

        <div className="w-full min-w-0 sm:w-80">
          <Choice
            label="Ubicación"
            value={locationId}
            disabled={query.pending}
            onValueChange={(value) =>
              setParams((previous) => {
                const result = new URLSearchParams(previous);

                if (value) {
                  result.set("locationId", value);
                } else {
                  result.delete("locationId");
                }

                return result;
              })
            }
            options={[
              { value: "", label: "Todas las ubicaciones" },
              ...(data?.locations ?? []).map((location) => ({
                value: location.id,
                label: location.name + " · " + location.code,
              })),
            ]}
          />
        </div>
      </div>

      <nav
        aria-label="Secciones de inventario"
        className="flex min-w-0 max-w-full gap-1 overflow-x-auto border-b border-outline pb-2"
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => openTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={
              "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm max-sm:h-11 " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (tab === id
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-secondary")
            }
          >
            <Icon size={18} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {notice && <Notice>{notice}</Notice>}

      {query.error && (
        <Notice>
          {query.error}{" "}
          <Button variant="soft" onClick={query.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {!validLocation && (
        <Notice>
          La ubicación seleccionada ya no está disponible. Selecciona
          otra ubicación.
        </Notice>
      )}

      {query.pending && data && (
        <Notice>Actualizando inventario…</Notice>
      )}

      {data && validLocation && (
        <>
          {tab === "summary" && (
            <InventorySummary
              data={data}
              locationId={locationId}
              currency={currency}
              revision={revision}
            />
          )}

          {tab === "stock" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="soft"
                    size="compact"
                    aria-current="page"
                  >
                    Existencias
                  </Button>

                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => openTab("consumption")}
                  >
                    Consumo por producto
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="soft"
                    disabled={query.pending}
                    onClick={refresh}
                    aria-label="Actualizar inventario"
                  >
                    <RefreshCw size="icon" />
                  </Button>
                  <Button
                    disabled={
                      query.pending ||
                      !data.locations.length ||
                      !!query.error
                    }
                    onClick={() =>
                      setAction({ kind: "create", locationId })
                    }
                  >
                    <PackagePlus size={16} />
                    Nuevo artículo
                  </Button>
                </div>
              </div>

              <InventoryLocationStock
                key={locationId}
                data={data}
                locationId={locationId}
                currency={currency}
                onAction={(action) => {
                  if (!query.pending && !query.error) {
                    setAction(action);
                  }
                }}
                onMovement={(itemId, locationId) => {
                  if (!query.pending && !query.error) {
                    setMovement({ itemId, locationId });
                  }
                }}
              />
            </>
          )}

          {tab === "purchases" && (
            <InventoryLocationPurchases
              key={locationId}
              data={data}
              locationId={locationId}
              currency={currency}
              timezone={timezone}
              revision={revision}
              onCreate={() => {
                if (
                  !query.pending &&
                  !query.error &&
                  data.locations.length
                ) {
                  setPurchase(true);
                }
              }}
            />
          )}

          {(tab === "movements" || tab === "production") && (
            <InventoryActivity
              key={tab + ":" + locationId}
              production={tab === "production"}
              locationId={locationId}
              currency={currency}
              timezone={timezone}
              revision={revision}
              canCreate={
                !query.pending &&
                !query.error &&
                data.locations.length > 0
              }
              onCreate={() => {
                if (
                  query.pending ||
                  query.error ||
                  !data.locations.length
                ) {
                  return;
                }

                if (tab === "production") {
                  setProducing(true);
                } else {
                  setMovement({
                    itemId: "",
                    locationId,
                  });
                }
              }}
            />
          )}

          {tab === "kardex" && (
            <InventoryKardex
              key={
                locationId +
                ":" +
                (params.get("inventoryItemId") ?? "")
              }
              data={data}
              locationId={locationId}
              initialItemId={params.get("inventoryItemId") ?? ""}
              currency={currency}
              timezone={timezone}
              revision={revision}
            />
          )}

          {tab === "reconciliation" && (
            <InventoryReconciliation
              data={data}
              revision={revision}
            />
          )}

          {producing && (
            <InventoryProductionLocationForm
              data={data}
              initialLocationId={locationId}
              currency={currency}
              onClose={() => {
                setProducing(false);
                refresh();
              }}
              onSaved={saved}
            />
          )}

          {action && (
            <InventoryItemLocationDialog
              key={action.kind + ":" + action.itemId}
              action={action}
              workspace={data}
              currency={currency}
              onClose={() => {
                setAction(null);
                refresh();
              }}
              onSaved={saved}
            />
          )}

          {purchase && (
            <InventoryPurchaseForm
              data={data}
              initialLocationId={locationId}
              currency={currency}
              timezone={timezone}
              onClose={() => {
                setPurchase(false);
                refresh();
              }}
              onSaved={saved}
            />
          )}

          {movement && (
            <InventoryLocalMovement
              data={data}
              initialItemId={movement.itemId}
              initialLocationId={movement.locationId}
              currency={currency}
              onClose={() => {
                setMovement(null);
                refresh();
              }}
              onSaved={saved}
            />
          )}
        </>
      )}
    </section>
  );
}

function InventorySummary({
  data,
  locationId,
  currency,
  revision,
}: {
  data: InventoryWorkspace;
  locationId: string;
  currency: string;
  revision: number;
}) {
  const loader = useCallback(
    async (session: AuthSession, signal: AbortSignal) => {
      const [summary, unvalued] = await Promise.all([
        loadSummary(session, signal, locationId),
        loadUnvalued(session, signal, locationId),
      ]);

      return { ...summary, unvalued };
    },
    [locationId]
  );

  const query = useInventoryQuery(
    "inventory-summary:" + locationId,
    loader,
    revision
  );

  const balances = data.balances.filter(
    (balance) => !locationId || balance.location.id === locationId
  );

  const report = query.data;

  if (query.pending) return <InventorySkeleton />;

  if (query.error || !report) {
    return (
      <Notice>
        {query.error ?? "No pudimos consultar el resumen."}
        <Button variant="soft" onClick={query.refresh}>
          Reintentar
        </Button>
      </Notice>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries({
          "Valor del inventario": money(
            report.summary.totalInventoryValue,
            currency
          ),
          "Saldos disponibles": report.summary.inStockCount,
          "Bajo mínimo": report.summary.lowStockCount,
          Agotados: report.summary.outOfStockCount,
          "Saldos sin valorar": report.summary.unvaluedStockCount,
          "Saldos negativos": balances.filter(
            (balance) => fixed(balance.currentStock) < 0n
          ).length,
          "Artículos activos": locationId
            ? new Set(
                balances
                  .filter((balance) => balance.isItemActive)
                  .map((balance) => balance.inventoryItemId)
              ).size
            : data.items.filter((item) => item.isActive).length,
          "Artículos críticos": new Set(
            balances
              .filter(
                (balance) =>
                  balance.isItemActive &&
                  balance.stockStatus !== "AVAILABLE"
              )
              .map((balance) => balance.inventoryItemId)
          ).size,
        }).map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-outline bg-surface p-5 shadow-sm"
          >
            <p className="text-sm text-muted">{label}</p>
            <strong className="mt-2 block text-2xl">{value}</strong>
          </div>
        ))}
      </div>

      {report.unvalued.itemCount > 0 && (
        <Notice>
          Hay {report.unvalued.itemCount} saldos sin valorar. Revisa
          sus acciones en Existencias.
        </Notice>
      )}

      {report.summary.hasUnvaluedStock && (
        <Notice>
          El valor conocido del inventario no incluye los saldos
          pendientes de valoración.
        </Notice>
      )}

      {!locationId && (
        <DataTable
          headers={[
            "Ubicación",
            "Saldos",
            "Sin valorar",
            "Valor conocido",
          ]}
        >
          {report.byLocation.map((row) => (
            <tr key={row.location.id}>
              <td>
                {row.location.name} · {row.location.code}
              </td>
              <td>{row.balanceCount}</td>
              <td>{row.unvaluedStockCount}</td>
              <td>{money(row.totalInventoryValue, currency)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
