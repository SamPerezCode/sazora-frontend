import { useState } from "react";

import type { ConsumptionLink } from "../services/inventory-workspace";
import { quantity } from "../utils/inventory-value";

import { Button } from "./InventoryButton";
import { Modal, Notice } from "./InventoryLocationUI";

export type ConsumptionProduct = {
  id: string;
  name: string;
  isActive: boolean;
  links: ConsumptionLink[];
};

export function InventoryConsumptionList({
  rows,
  disabled,
  busy,
  onEdit,
}: {
  rows: ConsumptionProduct[];
  disabled: boolean;
  busy: boolean;
  onEdit: (productId: string) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const detail = rows.find((row) => row.id === detailId);

  return (
    <div aria-busy={busy}>
      <div className="inv-composition-list">
        <div
          className="inv-composition-list-heading"
          aria-hidden="true"
        >
          <span>Producto</span>
          <span>Composición</span>
          <span>Insumos</span>
          <span>Descuento automático</span>
          <span>Acciones</span>
        </div>

        {rows.map((row) => {
          const active = row.links.filter((link) => link.isActive);

          const automatic = active.filter(
            (link) => link.autoDeduct
          ).length;

          const status = !active.length
            ? "Sin consumo configurado"
            : automatic === active.length
              ? "Todos"
              : automatic
                ? "Parcial"
                : "Ninguno";

          return (
            <article
              key={row.id}
              className="inv-composition-list-row"
              aria-label={row.name}
            >
              <strong>
                {row.name}
                {!row.isActive && " (inactivo)"}
              </strong>

              <p>
                {active.length
                  ? active
                      .map(
                        (link) =>
                          link.inventoryItemName +
                          " × " +
                          quantity(
                            link.quantityPerProduct,
                            link.baseUnit
                          )
                      )
                      .join("; ")
                  : "Sin consumo configurado"}
              </p>

              <span>
                <span className="inv-composition-mobile-label">
                  Insumos:{" "}
                </span>
                {active.length}
              </span>

              <span>
                <span className="inv-composition-mobile-label">
                  Descuento automático:{" "}
                </span>
                {status}
              </span>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => setDetailId(row.id)}
                >
                  Ver detalle
                </Button>

                <Button
                  variant="secondary"
                  size="compact"
                  disabled={disabled || !row.isActive}
                  onClick={() => onEdit(row.id)}
                >
                  Editar consumo
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {detail && (
        <Modal
          title={"Consumo de " + detail.name}
          onClose={() => setDetailId(null)}
        >
          <div className="grid gap-4">
            {[true, false].map((active) => {
              const links = detail.links.filter(
                (link) => link.isActive === active
              );

              if (!active && !links.length) return null;

              return (
                <section key={String(active)} className="grid gap-3">
                  <h3 className="font-bold">
                    {active
                      ? "Insumos activos"
                      : "Relaciones inactivas"}
                  </h3>

                  {!links.length && <p>Sin consumo configurado</p>}

                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="rounded-xl border border-outline p-3"
                    >
                      <strong>{link.inventoryItemName}</strong>

                      <p>
                        {quantity(
                          link.quantityPerProduct,
                          link.baseUnit
                        )}{" "}
                        por unidad del producto.
                      </p>

                      <p>
                        Descuento automático:{" "}
                        {link.autoDeduct ? "Activado" : "Desactivado"}
                        .
                      </p>

                      {!active && (
                        <p>
                          Relación inactiva: no descuenta existencias.
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}

            <Notice>
              La composición se configura para todo el negocio. El
              inventario se descuenta de la ubicación de la orden
              cuando esta se confirma.
            </Notice>
          </div>
        </Modal>
      )}
    </div>
  );
}
