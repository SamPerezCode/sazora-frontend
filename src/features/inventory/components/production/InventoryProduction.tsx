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
  RefreshCw,
} from "lucide-react";
import { useAppShell } from "../../../../app/layout/shell-context";
import { useInventoryRealtime } from "../../../../hooks/useInventoryRealtime";
import { useInventoryQuery } from "../../hooks/useInventoryQuery";
import { Notice, Choice } from "../InventoryLocationUI";
import { Button } from "../InventoryButton";
import { loadContext } from "./production.queries";
import {
  productionRoles,
  isAdmin,
  assignedPlant,
} from "./production.access";
import { ProductionOrders } from "./ProductionOrders";

export function InventoryProduction() {
  const { session, settings } = useAppShell();
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);

  const context = useInventoryQuery(
    "production-context",
    loadContext,
    revision,
    productionRoles
  );

  const plants = {
    ...context,
    data: context.data?.plants ?? null,
  };

  const refresh = () => setRevision((value) => value + 1);

  useInventoryRealtime(session, () => {
    if (plants.pending) return false;
    refresh();
    return true;
  });

  const admin = isAdmin(session);
  const allowed =
    admin || session.authorization.roles.includes("PRODUCTION");
  const currency = admin ? (settings.data?.currencyCode ?? "") : "";
  const zone = admin ? settings.data?.timezone : context.data?.zone;
  const requested = params.get("locationId") ?? "";

  const locationId = admin
    ? plants.data?.some((plant) => plant.id === requested)
      ? requested
      : ""
    : (assignedPlant(session)?.id ?? "");

  const inventoryTabs = [
    { id: "summary", label: "Resumen", Icon: ChartNoAxesCombined },
    { id: "stock", label: "Existencias", Icon: Boxes },
    { id: "purchases", label: "Compras", Icon: ReceiptText },
    { id: "movements", label: "Movimientos", Icon: History },
    { id: "production", label: "Producción", Icon: Factory },
    {
      id: "kardex",
      label: "Kardex y costos",
      Icon: SlidersHorizontal,
    },
    {
      id: "reconciliation",
      label: "Conciliación",
      Icon: ClipboardCheck,
    },
  ];

  if (!allowed)
    return <Notice>No tienes acceso a Producción.</Notice>;

  if (!admin && !assignedPlant(session)) {
    return (
      <Notice>
        No tienes una planta de producción asignada. Solicita la
        asignación a un administrador.
      </Notice>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 text-heading">
      <nav
        aria-label="Secciones de inventario"
        className="flex min-w-0 gap-1 overflow-x-auto border-b border-outline pb-2"
      >
        {inventoryTabs
          .filter((tab) => admin || tab.id === "production")
          .map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === "production" ? "page" : undefined}
              className={
                "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent " +
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
              <Icon size={17} aria-hidden />
              {label}
            </button>
          ))}
      </nav>

      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="text-xl font-bold">Producción</h2>
          <p className="mt-1 text-sm text-muted">
            Planifica, ejecuta y analiza la transformación de
            inventario.
          </p>
        </div>

        <Choice
          label="Planta"
          value={locationId}
          disabled={!admin || plants.pending}
          onValueChange={(value) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set("tab", "production");
              if (value) next.set("locationId", value);
              else next.delete("locationId");
              return next;
            })
          }
          options={[
            ...(admin
              ? [{ value: "", label: "Todas las plantas" }]
              : []),
            ...(plants.data ?? []).map((plant) => ({
              value: plant.id,
              label: plant.name + " · " + plant.code,
            })),
          ]}
        />
      </div>

      <nav
        aria-label="Secciones de producción"
        className="flex gap-1 overflow-x-auto border-b border-outline pb-2"
      >
        {[
          { label: "Órdenes", Icon: ClipboardList, ready: true },
          {
            label: "Producción rápida",
            Icon: FlaskConical,
            ready: false,
          },
          { label: "Recetas", Icon: BookOpen, ready: false },
          {
            label: "Informes",
            Icon: ChartNoAxesCombined,
            ready: false,
          },
        ].map(({ label, Icon, ready }) => (
          <button
            type="button"
            key={label}
            disabled={!ready}
            aria-current={ready ? "page" : undefined}
            title={ready ? undefined : "Próximamente"}
            className={
              "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm disabled:opacity-50 " +
              (ready ? "bg-accent/10 text-accent" : "text-muted")
            }
          >
            <Icon size={17} aria-hidden />
            {label}
          </button>
        ))}

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          disabled={plants.pending}
          aria-label="Actualizar producción"
          onClick={refresh}
        >
          <RefreshCw size={17} />
        </Button>
      </nav>

      {plants.pending && <Notice>Actualizando plantas…</Notice>}

      {plants.error && (
        <Notice>
          {plants.error}{" "}
          <Button variant="secondary" onClick={plants.refresh}>
            Reintentar
          </Button>
        </Notice>
      )}

      {admin && settings.error && (
        <Notice>
          {settings.error}{" "}
          <Button variant="secondary" onClick={settings.retry}>
            Reintentar configuración
          </Button>
        </Notice>
      )}

      {admin && !settings.data && !settings.error && (
        <Notice>Cargando configuración del negocio…</Notice>
      )}

      {!admin && (
        <Notice>
          Los importes se muestran en la moneda del negocio, sin
          símbolo.
        </Notice>
      )}

      {plants.data &&
        !plants.error &&
        zone &&
        (!admin || !settings.error) && (
          <ProductionOrders
            key={locationId}
            locationId={locationId}
            currency={currency}
            zone={zone}
            revision={revision}
            onChanged={refresh}
          />
        )}
    </div>
  );
}
