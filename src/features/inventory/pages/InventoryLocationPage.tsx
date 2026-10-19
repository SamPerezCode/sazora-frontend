import { useState } from "react";
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
import { useInventoryQuery } from "../hooks/useInventoryQuery";

import { InventoryConsumptionLocation } from "../components/InventoryConsumptionLocation";
import { ProductInventorySetupDialog } from "../components/ProductInventorySetupDialog";

import { InventoryLocationStock } from "../components/InventoryLocationStock";
import { InventoryItemLocationDialog } from "../components/InventoryItemLocationDialog";
import type { ItemAction } from "../components/InventoryItemLocationDialog";
import { InventoryLocationPurchases } from "../components/InventoryLocationPurchases";
import { InventoryPurchaseForm } from "../components/InventoryPurchaseForm";
import { InventoryLocalMovement } from "../components/InventoryLocalMovement";
import { Choice, Notice } from "../components/InventoryLocationUI";
import { InventorySkeleton } from "../components/InventoryStates";

import { InventoryActivity } from "../components/InventoryActivity";
import { InventoryProductionLocationForm } from "../components/InventoryProductionLocationForm";
import { InventoryKardex } from "../components/InventoryKardex";
import { InventoryReconciliation } from "../components/InventoryReconciliation";

import { loadInventoryWorkspace } from "../services/inventory-location.service";

import { InventorySummary } from "../components/InventorySummary";

export function InventoryLocationPage() {
  const { session, settings } = useAppShell();
  const [params, setParams] = useSearchParams();

  const productId =
    params.get("setupProductId") ?? params.get("productId") ?? "";

  const selectedTab =
    params.get("tab") ?? (productId ? "consumption" : "stock");

  const consumption = selectedTab === "consumption";

  const configureProductId =
    productId &&
    (params.get("intent") === "configure" ||
      params.has("setupProductId"))
      ? productId
      : "";

  const tab = consumption
    ? "stock"
    : [
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

      [
        "productId",
        "setupProductId",
        "intent",
        "itemId",
        "stockReview",
      ].forEach((key) => result.delete(key));

      result.set("tab", next);
      return result;
    });
  }

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

    refresh();
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
          <h2 className="text-[20px] leading-7 font-bold sm:text-[24px]">
            {tabs.find((entry) => entry.id === tab)?.label}
          </h2>
        </div>

        <div className="w-full min-w-0 sm:w-[360px]">
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
              "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[12px] sm:text-[14px] " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (tab === id
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-secondary")
            }
          >
            <Icon size={16} aria-hidden />
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

      {query.pending &&
        data &&
        (consumption ? (
          <p role="status" className="sr-only">
            Actualizando inventario…
          </p>
        ) : (
          <Notice>Actualizando inventario…</Notice>
        ))}

      {data && validLocation && (
        <>
          {tab === "summary" && (
            <InventorySummary
              data={data}
              locationId={locationId}
              currency={currency}
              timezone={timezone}
              revision={revision}
              workspaceReady={!query.pending && !query.error}
              onMovements={() => openTab("movements")}
              onReview={(filter) => {
                setParams((previous) => {
                  const next = new URLSearchParams(previous);

                  next.set("tab", "stock");
                  next.set("stockReview", filter);

                  return next;
                });
              }}
            />
          )}

          {tab === "stock" && (
            <>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <Button
                    variant={consumption ? "ghost" : "soft"}
                    size="compact"
                    aria-current={!consumption ? "page" : undefined}
                    onClick={() => openTab("stock")}
                  >
                    Existencias
                  </Button>

                  <Button
                    variant={consumption ? "soft" : "ghost"}
                    size="compact"
                    aria-current={consumption ? "page" : undefined}
                    onClick={() => openTab("consumption")}
                  >
                    Consumo por producto
                  </Button>
                </div>

                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="order-2 sm:order-1"
                    disabled={query.pending}
                    onClick={refresh}
                    title="Actualizar inventario"
                    aria-label={
                      query.pending
                        ? "Actualizando inventario"
                        : "Actualizar inventario"
                    }
                    aria-busy={query.pending}
                  >
                    <RefreshCw
                      size={18}
                      aria-hidden
                      className={
                        query.pending
                          ? "motion-safe:animate-spin"
                          : ""
                      }
                    />
                  </Button>

                  <Button
                    className="order-1 sm:order-2"
                    disabled={
                      query.pending ||
                      !data.locations.length ||
                      !!query.error
                    }
                    onClick={() =>
                      setAction({
                        kind: "create",
                        locationId,
                      })
                    }
                  >
                    <PackagePlus size={16} aria-hidden />
                    Nuevo artículo
                  </Button>
                </div>
              </div>

              {consumption ? (
                <InventoryConsumptionLocation
                  key={productId + ":" + (params.get("itemId") ?? "")}
                  data={data}
                  ready={!query.pending && !query.error}
                  revision={revision}
                  initialProductId={productId}
                  initialItemId={params.get("itemId") ?? ""}
                  onChanged={refresh}
                />
              ) : (
                <InventoryLocationStock
                  key={
                    locationId +
                    ":" +
                    (params.get("stockReview") ?? "")
                  }
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
                      setMovement({
                        itemId,
                        locationId,
                      });
                    }
                  }}
                />
              )}
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

          {configureProductId && (
            <ProductInventorySetupDialog
              key={configureProductId}
              productId={configureProductId}
              onClose={finishConfiguration}
              onResolved={finishConfiguration}
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
