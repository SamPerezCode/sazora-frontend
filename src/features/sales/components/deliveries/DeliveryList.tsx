import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Bike, MapPin, RotateCcw } from "lucide-react";

import { SelectField } from "../../../../components/forms/SelectField";
import { TextField } from "../../../../components/forms/TextField";
import { Button } from "../../../../components/ui/Button";

import { hasPermission } from "../../../auth/utils/permissions";

import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { useRemote } from "../../hooks/usePublicOrders";

import { useRouteState } from "../../../../hooks/useRouteState";

import {
  deliveryStates,
  id,
} from "../../schemas/public-orders.schema";

import { listDeliveries } from "../../services/deliveries.service";

import { active, text } from "../../utils/public-orders.utils";

import {
  deliveryLabels,
  deliveryResponsible,
  orderLabels,
} from "../../utils/deliveries";

import { Feedback, Pager } from "../public-orders/PublicOrderShared";

import { DeliveryDialog } from "./DeliveryDialog";
import { DeliveryLinks } from "./DeliveryLinks";

export function DeliveryList() {
  const { session, date } = usePresentation();
  const token = session.accessToken;

  const loader = useCallback(
    (signal: AbortSignal) => listDeliveries(token, signal),
    [token]
  );

  const resource = useRemote(loader, {
    token,
    keys: ["deliveries"],
    pollMs: 15000,
  });
  const [params, setParams] = useSearchParams();

  const deliveryId = params.get("deliveryId");
  const orderId = params.get("orderId");
  const requestId = params.get("requestId");

  const invalidTarget = [deliveryId, orderId, requestId].some(
    (value) => value !== null && !id.safeParse(value).success
  );

  const [filter, setFilter] = useRouteState("deliveryFilters", {
    q: "",
    status: "ACTIVE",
  });

  const [page, setPage] = useRouteState("deliveryPage", 1);
  const [notice, setNotice] = useState("");

  const rows = resource.data ?? [];

  // Resolver con la lista completa recibida,
  // antes de los filtros visuales.
  useEffect(() => {
    if (
      deliveryId !== null ||
      invalidTarget ||
      (!orderId && !requestId) ||
      !resource.data
    ) {
      return;
    }

    const matches = resource.data.filter(
      (row) =>
        (!orderId || row.orderId === orderId) &&
        (!requestId || row.publicOrderRequestId === requestId)
    );

    if (matches.length !== 1) return;

    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        next.delete("orderId");
        next.delete("requestId");
        next.set("deliveryId", matches[0].id);

        return next;
      },
      { replace: true }
    );
  }, [
    deliveryId,
    orderId,
    requestId,
    invalidTarget,
    resource.data,
    setParams,
  ]);

  const linked = rows.filter(
    (row) =>
      (!orderId || row.orderId === orderId) &&
      (!requestId || row.publicOrderRequestId === requestId)
  );

  const unresolved =
    deliveryId === null &&
    !invalidTarget &&
    !!(orderId || requestId) &&
    !!resource.data &&
    linked.length !== 1;

  function select(value: string | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        for (const key of ["deliveryId", "orderId", "requestId"]) {
          next.delete(key);
        }

        if (value) next.set("deliveryId", value);

        return next;
      },
      { replace: value === null }
    );
  }

  function change(key: keyof typeof filter, value: string) {
    setFilter((previous) => ({
      ...previous,
      [key]: value,
    }));

    setPage(1);
  }

  const visible = rows.filter(
    (row) =>
      (filter.status === "ALL" ||
        (filter.status === "ACTIVE"
          ? active(row.status)
          : row.status === filter.status)) &&
      text(
        [
          row.orderId,
          row.publicCode,
          row.customerName,
          row.customerPhone,
          row.deliveryAddress,
          row.assignedDriverName,
          row.externalProviderName,
        ].join(" ")
      ).includes(text(filter.q.trim()))
  );

  const currentPage = Math.max(
    1,
    Math.min(page, Math.ceil(visible.length / 20))
  );

  return (
    <section className="por-page">
      <div className="por-toolbar">
        <p>
          Gestiona la asignación y el recorrido de los domicilios.
        </p>

        <div className="por-actions">
          <Button
            variant="secondary"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            <RotateCcw size={16} />
            Actualizar
          </Button>

          {hasPermission(session, "public_orders.read") && (
            <Link className="por-link" to="/pedidos-publicos">
              Solicitudes
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="por-notice">
          {notice}
        </p>
      )}

      {(invalidTarget || unresolved) && (
        <div role="status" className="por-error">
          <p>
            {invalidTarget
              ? "El enlace contiene un identificador inválido."
              : linked.length > 1
                ? "Hay varios domicilios vinculados. Selecciona el correspondiente."
                : "No se encontró un domicilio vinculado a ese pedido o solicitud."}
          </p>

          {unresolved &&
            linked.length > 1 &&
            linked.map((row) => (
              <Button
                key={row.id}
                variant="secondary"
                onClick={() => select(row.id)}
              >
                {row.publicCode} · {deliveryLabels[row.status]}
              </Button>
            ))}

          <Button variant="secondary" onClick={() => select(null)}>
            Continuar en el listado
          </Button>
        </div>
      )}

      <div className="por-stats">
        {[
          [
            "Activos",
            rows.filter((row) => active(row.status)).length,
          ],
          [
            "Por asignar",
            rows.filter((row) => row.status === "PENDING_ASSIGNMENT")
              .length,
          ],
          [
            "En camino",
            rows.filter((row) => row.status === "OUT_FOR_DELIVERY")
              .length,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{resource.loading ? "…" : value}</strong>
          </div>
        ))}
      </div>

      <div className="por-filters">
        <TextField
          label="Buscar domicilio"
          value={filter.q}
          placeholder="Código, cliente, teléfono, dirección o repartidor"
          onChange={(event) => change("q", event.target.value)}
        />

        <SelectField
          label="Estado del domicilio"
          value={filter.status}
          options={[
            {
              value: "ACTIVE",
              label: "Domicilios activos",
            },
            {
              value: "ALL",
              label: "Todos los estados",
            },
            ...deliveryStates.map((value) => ({
              value,
              label: deliveryLabels[value],
            })),
          ]}
          onValueChange={(value) => change("status", value)}
        />

        <Button
          variant="secondary"
          onClick={() => {
            setFilter({
              q: "",
              status: "ACTIVE",
            });
            setPage(1);
          }}
        >
          Limpiar filtros
        </Button>
      </div>

      <Feedback loading={resource.loading} error={resource.error} />

      <small>
        La preparación y el punto de venta se consultan al abrir el
        domicilio.
      </small>

      {resource.data && !visible.length && (
        <p className="por-empty">
          No hay domicilios con estos filtros.
        </p>
      )}

      <div className="por-cards">
        {visible
          .slice((currentPage - 1) * 20, currentPage * 20)
          .map((row) => (
            <article className="por-card" key={row.id}>
              <div className="por-toolbar">
                <strong className="por-inline">
                  <Bike size={18} />
                  {row.publicCode}
                </strong>

                <span className="por-badge" data-status={row.status}>
                  {deliveryLabels[row.status]}
                </span>
              </div>

              <div>
                <strong>{row.customerName}</strong>
                <small>{row.customerPhone}</small>
              </div>

              <p className="por-inline">
                <MapPin size={16} />
                {row.deliveryAddress}
              </p>

              <small>
                Pedido #{row.orderId} · Creado {date(row.createdAt)}
              </small>

              <hr />

              <p>Orden: {orderLabels[row.orderStatus]}</p>

              <p>
                Responsable: {deliveryResponsible(row)}
                {row.deliveryMode && (
                  <small>
                    {row.deliveryMode === "INTERNAL"
                      ? "Equipo propio"
                      : "Proveedor externo"}
                  </small>
                )}
              </p>

              {row.status === "DELIVERED" &&
                row.orderStatus !== "CLOSED" && (
                  <small>
                    Pedido entregado. El cierre financiero se
                    realizará desde el flujo de la orden.
                  </small>
                )}

              <DeliveryLinks row={row} />

              <Button
                variant="secondary"
                onClick={() => select(row.id)}
              >
                Ver domicilio
              </Button>
            </article>
          ))}
      </div>

      <Pager
        page={currentPage}
        total={visible.length}
        change={setPage}
      />

      {deliveryId !== null && !invalidTarget && (
        <DeliveryDialog
          key={deliveryId}
          deliveryId={deliveryId}
          close={() => select(null)}
          saved={(message) => {
            setNotice(message);
            resource.reload();
          }}
        />
      )}
    </section>
  );
}
