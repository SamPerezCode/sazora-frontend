import { SelectField } from "../../../../components/forms/SelectField";
import { TextField } from "../../../../components/forms/TextField";
import { Button } from "../../../../components/ui/Button";
import { hasPermission } from "../../../auth/utils/permissions";
import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { useRemote } from "../../hooks/usePublicOrders";
import type { Delivery } from "../../schemas/public-orders.schema";
import { deliveryStates } from "../../schemas/public-orders.schema";
import { listDeliveries } from "../../services/deliveries.service";
import { active } from "../../utils/public-orders.utils";
import { allLocations } from "../../utils/public-orders.utils";
import { labels } from "../../utils/public-orders.utils";
import { options } from "../../utils/public-orders.utils";
import { text } from "../../utils/public-orders.utils";
import { Badge } from "../public-orders/PublicOrderShared";
import { Feedback } from "../public-orders/PublicOrderShared";
import { Pager } from "../public-orders/PublicOrderShared";
import { DeliveryDialog } from "./DeliveryDialog";
import { Bike } from "lucide-react";
import { MapPin } from "lucide-react";
import { RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { useCallback } from "react";
import { useState } from "react";

export function DeliveryList() {
  const { session, business, date, price } = usePresentation();
  const token = session.accessToken;
  const slug = business.slug;

  const loader = useCallback(
    (signal: AbortSignal) => listDeliveries(token, slug, signal),
    [token, slug]
  );

  const resource = useRemote(loader);

  const [filter, setFilter] = useState({
    q: "",
    location: "ALL",
    status: "ACTIVE",
  });

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [notice, setNotice] = useState("");
  const rows = resource.data ?? [];

  const locations = Array.from(
    new Map(
      rows.flatMap((row) =>
        row.tracking
          ? [
              [
                row.tracking.locationId,
                row.tracking.locationName,
              ] as const,
            ]
          : []
      )
    )
  );

  const visible = rows.filter(
    (row) =>
      (filter.location === "ALL" ||
        row.tracking?.locationId === filter.location) &&
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
        ].join(" ")
      ).includes(text(filter.q.trim()))
  );

  const currentPage = Math.max(
    1,
    Math.min(page, Math.ceil(visible.length / 20))
  );

  function change(key: keyof typeof filter, value: string) {
    setFilter((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }

  return (
    <section className="por-page">
      <div className="por-toolbar">
        <p>Pedidos a domicilio aceptados.</p>

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
          label="Buscar pedido o cliente"
          value={filter.q}
          placeholder="Pedido, cliente, teléfono o dirección"
          onChange={(event) => change("q", event.target.value)}
        />

        <SelectField
          label="Punto de venta"
          value={filter.location}
          options={[
            allLocations,
            ...locations.map(([value, label]) => ({ value, label })),
          ]}
          onValueChange={(value) => change("location", value)}
        />

        <SelectField
          label="Estado del domicilio"
          value={filter.status}
          options={[
            { value: "ACTIVE", label: "Domicilios activos" },
            { value: "ALL", label: "Todos los estados" },
            ...options(deliveryStates),
          ]}
          onValueChange={(value) => change("status", value)}
        />
      </div>

      <Feedback loading={resource.loading} error={resource.error} />

      {rows.some((row) => !row.tracking) && (
        <p role="status">
          Algunos seguimientos no están disponibles. Actualiza para
          consultar su punto de venta, productos y preparación.
        </p>
      )}

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
                  Pedido #{row.orderId}
                </strong>
                <Badge value={row.status} />
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
                {row.tracking?.locationName ??
                  "Punto de venta no disponible"}{" "}
                · {date(row.createdAt)}
              </small>

              <hr />

              <p>
                {row.tracking
                  ? labels[
                      row.tracking.preparationStatus ??
                        row.orderStatus
                    ]
                  : "Preparación sin consultar"}
              </p>

              <p>
                Repartidor:{" "}
                {row.assignedDriverName ??
                  row.externalProviderName ??
                  "Sin asignar"}
                {row.deliveryMode && (
                  <small>
                    {row.deliveryMode === "INTERNAL"
                      ? "Equipo propio"
                      : "Proveedor externo"}
                  </small>
                )}
              </p>

              <div className="por-toolbar">
                <strong>Subtotal de productos</strong>
                <strong>
                  {row.tracking ? price(row.tracking.subtotal) : "—"}
                </strong>
              </div>

              <hr />

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelected(row)}
              >
                Ver pedido y gestionar
              </Button>
            </article>
          ))}
      </div>

      <Pager
        page={currentPage}
        total={visible.length}
        change={setPage}
      />

      {selected && (
        <DeliveryDialog
          key={selected.id}
          row={selected}
          close={() => setSelected(null)}
          saved={(message) => {
            setSelected(null);
            setNotice(message);
            resource.reload();
          }}
        />
      )}
    </section>
  );
}
