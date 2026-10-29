import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  ChartNoAxesCombined,
  Boxes,
  ReceiptText,
  History,
  Factory,
  SlidersHorizontal,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  BookOpen,
} from "lucide-react";

import { useAppShell } from "../../../../app/layout/shell-context";
import { useInventoryRealtime } from "../../../../hooks/useInventoryRealtime";
import { useInventoryQuery } from "../../hooks/useInventoryQuery";
import { Choice, Notice } from "../InventoryLocationUI";

import { loadContext } from "./services/production.queries";
import {
  productionRoles,
  isAdmin,
  assignedPlant,
} from "./utils/production.access";

import { ProductionOrders } from "./components/orders/ProductionOrders";
import { QuickProductions } from "./components/quick/QuickProductions";
import { ProductionListState } from "./components/shared/ProductionListState";

const inventoryTabs = [
  { id: "summary", label: "Resumen", Icon: ChartNoAxesCombined },
  { id: "stock", label: "Existencias", Icon: Boxes },
  { id: "purchases", label: "Compras", Icon: ReceiptText },
  { id: "movements", label: "Movimientos", Icon: History },
  { id: "production", label: "Producción", Icon: Factory },
  { id: "kardex", label: "Kardex y costos", Icon: SlidersHorizontal },
  {
    id: "reconciliation",
    label: "Conciliación",
    Icon: ClipboardCheck,
  },
];

const productionTabs = [
  {
    id: "orders",
    label: "Órdenes",
    Icon: ClipboardList,
    ready: true,
  },
  {
    id: "quick",
    label: "Producción rápida",
    Icon: FlaskConical,
    ready: true,
  },
  {
    id: "recipes",
    label: "Recetas",
    Icon: BookOpen,
    ready: false,
  },
  {
    id: "reports",
    label: "Informes",
    Icon: ChartNoAxesCombined,
    ready: false,
  },
];

const navClass =
  "flex min-w-0 max-w-full gap-1 overflow-x-auto border-b border-outline pb-2";

// Mismas medidas que la navegación de Compras y Movimientos.
const inventoryTabClass =
  "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[12px] sm:text-[14px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ";

// Navegación secundaria del módulo.
const productionTabClass =
  "flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ";

export function InventoryProduction() {
  const { session, settings } = useAppShell();
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);

  const admin = isAdmin(session);
  const plant = assignedPlant(session);
  const allowed =
    admin || session.authorization.roles.includes("PRODUCTION");

  const context = useInventoryQuery(
    "production-context",
    loadContext,
    revision,
    productionRoles
  );

  const refresh = () => setRevision((value) => value + 1);

  useInventoryRealtime(session, () => {
    if (context.pending) return false;

    refresh();
    return true;
  });

  const section =
    params.get("productionTab") === "quick" ? "quick" : "orders";

  const ActivePanel =
    section === "quick" ? QuickProductions : ProductionOrders;

  const plants = context.data?.plants;
  const requested = params.get("locationId") ?? "";

  const locationId = admin
    ? plants?.some((item) => item.id === requested)
      ? requested
      : ""
    : (plant?.id ?? "");

  const currency = admin ? (settings.data?.currencyCode ?? "") : "";

  const zone = admin ? settings.data?.timezone : context.data?.zone;

  const setupError = context.error || (admin ? settings.error : null);

  const ready =
    !!context.data && !!zone && (!admin || !!settings.data);

  if (!allowed) {
    return (
      <ProductionListState
        state="error"
        message="No tienes acceso a Producción."
      />
    );
  }

  if (!admin && !plant) {
    return (
      <ProductionListState
        state="error"
        message="No tienes una planta de producción asignada. Solicita la asignación a un administrador."
      />
    );
  }

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 text-heading">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">INVENTARIO</p>

          <h2 className="text-[20px] leading-7 font-bold sm:text-[24px]">
            Producción
          </h2>

          <p className="mt-1 text-xs leading-5 text-muted">
            Planifica, ejecuta y analiza la transformación de
            inventario.
          </p>
        </div>

        <div className="w-full min-w-0 sm:w-[360px]">
          <Choice
            label="Planta"
            value={locationId}
            disabled={!admin || context.pending || !!context.error}
            onValueChange={(value) =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);

                next.set("tab", "production");

                if (value) {
                  next.set("locationId", value);
                } else {
                  next.delete("locationId");
                }

                return next;
              })
            }
            options={[
              ...(admin
                ? [{ value: "", label: "Todas las plantas" }]
                : []),
              ...(plants ?? (plant ? [plant] : [])).map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
        </div>
      </header>

      <nav aria-label="Secciones de inventario" className={navClass}>
        {inventoryTabs
          .filter((tab) => admin || tab.id === "production")
          .map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === "production" ? "page" : undefined}
              className={
                inventoryTabClass +
                (id === "production"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-secondary")
              }
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);

                  next.set("tab", id);
                  return next;
                })
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
      </nav>

      <p className="text-sm leading-5 text-muted">
        Órdenes y producción rápida, recetas estándar y seguimiento de
        costos y rendimientos por planta.
      </p>

      <nav aria-label="Secciones de producción" className={navClass}>
        {productionTabs.map(({ id, label, Icon, ready: enabled }) => (
          <button
            key={id}
            type="button"
            disabled={!enabled}
            title={enabled ? undefined : "Próximamente"}
            aria-current={section === id ? "page" : undefined}
            className={
              productionTabClass +
              (section === id
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-secondary")
            }
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);

                next.set("tab", "production");
                next.set("productionTab", id);

                return next;
              })
            }
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {setupError ? (
        <ProductionListState
          state="error"
          message={setupError}
          onRetry={() => {
            context.refresh();

            if (admin && settings.error) {
              settings.retry();
            }
          }}
        />
      ) : !ready ? (
        <ProductionListState state="loading" />
      ) : (
        <>
          {!admin && (
            <Notice>
              Los importes se muestran en la moneda del negocio, sin
              símbolo.
            </Notice>
          )}

          <ActivePanel
            key={section + ":" + locationId}
            locationId={locationId}
            currency={currency}
            zone={zone!}
            revision={revision}
            onChanged={refresh}
          />
        </>
      )}
    </section>
  );
}
