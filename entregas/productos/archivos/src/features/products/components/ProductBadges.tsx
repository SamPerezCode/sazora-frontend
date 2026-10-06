import type { Product } from "../schemas/product.schema";

const fulfillment = {
  PREPARE_TO_ORDER: "Preparado al momento",
  READY_TO_SERVE: "Listo para entregar",
};
const tracking = {
  NONE: "Sin control de inventario",
  RESALE: "Inventario · Reventa",
  PRODUCTION: "Inventario · Producción",
  COMBO: "Inventario · Combo",
  CUSTOM: "Inventario · Configuración avanzada",
};
const style = "inline-flex rounded-lg bg-secondary/60 px-2 py-1 text-[0.6875rem] text-muted";
export function ProductTypeBadge({ isCombo }: { isCombo: boolean }) {
  return <span className={style}>{isCombo ? "Combo" : "Normal"}</span>;
}
export function FulfillmentModeBadge({ value }: { value: Product["fulfillmentMode"] }) {
  return <span className={style}>{fulfillment[value]}</span>;
}
export function InventoryTrackingBadge({ product }: { product: Product }) {
  return <span className={style}>{product.hasInventory
    ? tracking[product.inventoryTrackingType] : "Sin inventario configurado"}</span>;
}
export function ProductBadges({ product }: { product: Product }) {
  return <div className="mt-2 flex flex-wrap gap-1">
    <ProductTypeBadge isCombo={product.isCombo} />
    <FulfillmentModeBadge value={product.fulfillmentMode} />
    <InventoryTrackingBadge product={product} />
  </div>;
}
