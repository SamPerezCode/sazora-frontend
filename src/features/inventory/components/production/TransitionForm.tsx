import { useState } from "react";
import { Button } from "../InventoryButton";
import { Field, Notice } from "../InventoryLocationUI";
import { Frame, Warning } from "./ProductionUI";
import type { FormContext } from "./production.types";

export function TransitionForm({
  context: c,
  action,
}: {
  context: FormContext;
  action: "plan" | "start" | "cancel";
}) {
  const [reason, setReason] = useState("");
  const order = c.data.order;
  const title =
    action === "plan"
      ? "Planificar"
      : action === "start"
        ? "Iniciar"
        : "Cancelar";
  const invalid =
    action === "plan"
      ? !order.plannedFor
      : action === "cancel"
        ? reason.trim().length < 3
        : false;

  return (
    <Frame
      context={c}
      title={title + " OP-" + order.id}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={c.busy}
            onClick={c.onClose}
          >
            Cerrar
          </Button>
          <Button
            variant={action === "cancel" ? "danger" : "primary"}
            loading={c.busy}
            disabled={c.locked || invalid}
            onClick={() =>
              void c.commit(
                action === "cancel"
                  ? {
                      action,
                      payload: {
                        version: order.version,
                        cancellationReason: reason.trim(),
                      },
                    }
                  : { action, payload: { version: order.version } }
              )
            }
          >
            {title} OP-{order.id}
          </Button>
        </>
      }
    >
      {action === "cancel" ? (
        <>
          <Warning>
            Se cancelará esta orden. No se modificarán las
            existencias.
          </Warning>
          <Field
            label="Motivo obligatorio"
            value={reason}
            onChange={setReason}
            multiline
            maxLength={500}
            placeholder="Explica por qué se cancela la orden"
          />
        </>
      ) : (
        <Notice>
          {action === "plan"
            ? order.plannedFor
              ? "La orden quedará planificada; el inventario no se reserva ni se descuenta todavía."
              : "Edita el borrador y asigna una fecha prevista antes de planificar."
            : "La orden pasará a En proceso. Las existencias se aplicarán al completar."}
        </Notice>
      )}
    </Frame>
  );
}
