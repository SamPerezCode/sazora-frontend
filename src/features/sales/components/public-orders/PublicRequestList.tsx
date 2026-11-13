import { DateField } from "../../../../components/forms/DateField";
import { SelectField } from "../../../../components/forms/SelectField";
import { TextField } from "../../../../components/forms/TextField";
import { Button } from "../../../../components/ui/Button";
import { hasPermission } from "../../../auth/utils/permissions";
import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import { useRemote } from "../../hooks/usePublicOrders";
import { requestStates } from "../../schemas/public-orders.schema";
import { listRequests } from "../../services/public-orders.service";
import { allLocations } from "../../utils/public-orders.utils";
import { options } from "../../utils/public-orders.utils";
import { pending } from "../../utils/public-orders.utils";
import { text } from "../../utils/public-orders.utils";
import { Badge } from "./PublicOrderShared";
import { Feedback } from "./PublicOrderShared";
import { Pager } from "./PublicOrderShared";
import { Service } from "./PublicOrderShared";
import { RequestDialog } from "./PublicRequestDialog";
import { Bike } from "lucide-react";
import { Inbox } from "lucide-react";
import { RotateCcw } from "lucide-react";
import { Search } from "lucide-react";
import { Store } from "lucide-react";
import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { useCallback } from "react";
import { useState } from "react";

export function RequestList() {
  const { session, date, day, zone, price } = usePresentation();
  const token = session.accessToken;

  const loader = useCallback(
    (signal: AbortSignal) => listRequests(token, signal),
    [token]
  );

  const resource = useRemote(loader);

  const [filter, setFilter] = useState({
    q: "",
    location: "ALL",
    status: "PENDING",
    day: "",
    type: "ALL",
  });

  const [page, setPage] = useState(1);
  const [params] = useSearchParams();

  const [selected, setSelected] = useState<string | null>(() => {
    const value = params.get("solicitud");
    return value && /^[1-9]\d*$/.test(value) ? value : null;
  });

  const [notice, setNotice] = useState("");
  const rows = resource.data ?? [];

  function change(key: keyof typeof filter, value: string) {
    setFilter((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }

  const locations = Array.from(
    new Map(rows.map((row) => [row.locationId, row.locationName]))
  );

  const base = rows.filter(
    (row) =>
      (filter.location === "ALL" ||
        row.locationId === filter.location) &&
      (filter.status === "ALL" ||
        (filter.status === "PENDING"
          ? pending(row.status)
          : row.status === filter.status)) &&
      (!filter.day || day(row.createdAt) === filter.day) &&
      text(
        [row.publicCode, row.customerName, row.customerPhone].join(
          " "
        )
      ).includes(text(filter.q.trim()))
  );

  const visible = base.filter(
    (row) => filter.type === "ALL" || row.serviceType === filter.type
  );

  const currentPage = Math.max(
    1,
    Math.min(page, Math.ceil(visible.length / 20))
  );

  return (
    <section className="por-page">
      <div className="por-toolbar">
        <p>
          Revisa disponibilidad y coordina el pago antes de aceptar.
        </p>

        <div className="por-actions">
          <Button
            variant="secondary"
            onClick={resource.reload}
            disabled={resource.loading}
          >
            <RotateCcw size={16} />
            Actualizar
          </Button>

          {hasPermission(session, "deliveries.read") && (
            <Link className="por-link" to="/domicilios">
              <Bike size={16} />
              Domicilios aceptados
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="por-notice">
          {notice}
        </p>
      )}

      <div
        className="por-tabs"
        role="group"
        aria-label="Tipo de servicio"
      >
        {[
          { value: "ALL", label: "Todas", icon: Inbox },
          { value: "TAKEAWAY", label: "Para recoger", icon: Store },
          { value: "DELIVERY", label: "A domicilio", icon: Bike },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter.type === value}
            onClick={() => change("type", value)}
          >
            <Icon size={16} />
            <span>{label}</span>
            <small>
              {
                base.filter(
                  (row) =>
                    value === "ALL" || row.serviceType === value
                ).length
              }
            </small>
          </button>
        ))}
      </div>

      <div className="por-search">
        <TextField
          label="Buscar solicitudes"
          icon={Search}
          value={filter.q}
          placeholder="Código, cliente o teléfono"
          onChange={(event) => change("q", event.target.value)}
        />

        <Button
          variant="secondary"
          onClick={() => {
            setFilter({
              q: "",
              location: "ALL",
              status: "PENDING",
              day: "",
              type: "ALL",
            });
            setPage(1);
          }}
        >
          <RotateCcw size={16} />
          <span>Limpiar filtros</span>
        </Button>
      </div>

      <div className="por-filters">
        <SelectField
          label="Punto de venta"
          value={filter.location}
          onValueChange={(value) => change("location", value)}
          options={[
            allLocations,
            ...locations.map(([value, label]) => ({ value, label })),
          ]}
        />

        <SelectField
          label="Estado"
          value={filter.status}
          onValueChange={(value) => change("status", value)}
          options={[
            { value: "PENDING", label: "Pendientes de revisión" },
            { value: "ALL", label: "Todos los estados" },
            ...options(requestStates),
          ]}
        />

        <DateField
          label="Fecha"
          value={filter.day}
          onValueChange={(value) => change("day", value)}
          timeZone={zone}
        />
      </div>

      <Feedback loading={resource.loading} error={resource.error} />

      {resource.data && (
        <>
          <p className="por-muted">
            {visible.length} solicitudes · subtotal de productos, sin
            domicilio
          </p>

          {!visible.length ? (
            <p className="por-empty">
              No hay solicitudes con estos filtros.
            </p>
          ) : (
            <div className="por-table-wrap">
              <table className="por-table">
                <thead>
                  <tr>
                    {[
                      "Solicitud / fecha",
                      "Punto de venta",
                      "Cliente",
                      "Tipo / entrega",
                      "Artículos",
                      "Subtotal",
                      "Estado",
                      "Acción",
                    ].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {visible
                    .slice((currentPage - 1) * 20, currentPage * 20)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong
                            className="por-code"
                            title={row.publicCode}
                          >
                            {row.publicCode}
                          </strong>
                          <small>{date(row.createdAt)}</small>
                        </td>

                        <td>
                          <small>{row.locationName}</small>
                        </td>

                        <td>
                          <strong>{row.customerName}</strong>
                          <small>{row.customerPhone}</small>
                        </td>

                        <td>
                          <Service
                            delivery={row.serviceType === "DELIVERY"}
                          />
                          {row.deliveryAddress && (
                            <small>{row.deliveryAddress}</small>
                          )}
                        </td>

                        <td>
                          <span className="por-mobile-label">
                            Artículos:{" "}
                          </span>
                          {row.itemCount}
                        </td>

                        <td>
                          <span className="por-mobile-label">
                            Subtotal:{" "}
                          </span>
                          {price(row.subtotal)}
                        </td>

                        <td>
                          <Badge value={row.status} />
                        </td>

                        <td>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelected(row.id)}
                          >
                            Ver solicitud
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager
            page={currentPage}
            total={visible.length}
            change={setPage}
          />
        </>
      )}

      {selected && (
        <RequestDialog
          key={selected}
          id={selected}
          close={() => setSelected(null)}
          saved={(message) => {
            setNotice(message);
            resource.reload();
          }}
        />
      )}
    </section>
  );
}
