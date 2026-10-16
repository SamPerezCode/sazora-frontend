import { useId } from "react";

import { BottomSheet } from "../../components/layout/BottomSheet";
import { Button } from "../../components/ui/Button";

import { printDate } from "./kitchen-flow.schema";
import type { KitchenPrint } from "./kitchen-flow.schema";

import "./kitchen-flow.css";

interface Props {
  print: {
    ticketVersion: number;
    contentSnapshot: KitchenPrint["contentSnapshot"] | null;
  };
  onClose: () => void;
}

export function KitchenPrintPreview({ print, onClose }: Props) {
  const id = useId();
  const snapshot = print.contentSnapshot;

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title={
        snapshot
          ? `${snapshot.preparationAreaName} · Versión ${snapshot.ticketVersion}`
          : `Comanda · Versión ${print.ticketVersion}`
      }
      className="kf-dialog kf-preview-dialog"
      onClose={onClose}
    >
      <div className="kf-dialog-content">
        {snapshot ? (
          <>
            <p>Vista previa de la comanda impresa.</p>

            <div className="kf-receipt">
              <strong>{snapshot.businessName}</strong>

              <p>COMANDA DE COCINA</p>
              <p>{snapshot.preparationAreaName}</p>

              <p>
                Orden #{snapshot.orderId} · Versión{" "}
                {snapshot.ticketVersion}
              </p>

              <p>
                {snapshot.serviceType === "TABLE"
                  ? (snapshot.restaurantTableName ?? "Mesa")
                  : snapshot.serviceType === "TAKEAWAY"
                    ? "Para recoger"
                    : "Domicilio"}

                {snapshot.serviceType === "TABLE" &&
                snapshot.restaurantTableCode
                  ? ` · ${snapshot.restaurantTableCode}`
                  : ""}
              </p>

              {snapshot.orderNotes && (
                <p>Notas: {snapshot.orderNotes}</p>
              )}

              <ul>
                {snapshot.items.map((item) => (
                  <li key={item.kitchenTicketItemId}>
                    {item.quantity} × {item.productName}
                    {item.preparationStatus === "CANCELLED"
                      ? " · CANCELADO"
                      : ""}
                    {item.notes && <p>Nota: {item.notes}</p>}
                  </li>
                ))}
              </ul>

              <p>{printDate(snapshot.generatedAt)}</p>

              {snapshot.kitchenTicketFooter && (
                <p>{snapshot.kitchenTicketFooter}</p>
              )}

              <small>SAZORA</small>
            </div>
          </>
        ) : (
          <div role="status">
            <strong>Contenido histórico no disponible.</strong>
            <p>
              Este registro no incluye una copia del contenido
              impreso. No se puede verificar el contenido exacto de
              esta impresión.
            </p>
          </div>
        )}

        <div className="kf-actions">
          <Button variant="soft" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
