import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";

import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/forms/TextField";
import { SelectField } from "../../../components/forms/SelectField";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";

import { hasPermission } from "../../auth/utils/permissions";
import { useRemote } from "../../sales/hooks/usePublicOrders";

import { amount, dateTime } from "../utils/customers.format";
import { listCustomers } from "../services/customers.service";

import {
  channel,
  channelLabels,
  type CustomerFilter,
} from "../schemas/customers.schema";

import { CustomerDetail } from "../components/CustomerDetail";

import "../../reports/reports.css";
import "../customers.css";

export function CustomersPage() {
  const { session, settings } = useAppShell();

  if (!hasPermission(session, "customers.read")) {
    return <Alert>No tienes permiso para consultar clientes.</Alert>;
  }

  return (
    <CustomersList
      key={JSON.stringify([
        session.business.id,
        session.membership.id,
        session.accessToken,
        session.authorization,
      ])}
      currency={settings.data?.currencyCode ?? null}
      timezone={settings.data?.timezone ?? null}
    />
  );
}

function CustomersList({
  currency,
  timezone,
}: {
  currency: string | null;
  timezone: string | null;
}) {
  const { session } = useAppShell();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const [query, setQuery] = useState<CustomerFilter>({
    search: "",
    isActive: "",
    acquisitionSourceChannel: "",
    page: 1,
    pageSize: 20,
  });

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setQuery((previous) =>
          previous.search === search.trim()
            ? previous
            : {
                ...previous,
                search: search.trim(),
                page: 1,
              }
        ),
      300
    );

    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    (signal: AbortSignal) => listCustomers(session, query, signal),
    [session, query]
  );

  const resource = useRemote(load, {
    token: session.accessToken,
    keys: ["customers"],
  });

  const waiting = resource.loading || query.search !== search.trim();

  const data = waiting ? undefined : resource.data;

  const hasFilters = Boolean(
    query.search || query.isActive || query.acquisitionSourceChannel
  );

  return (
    <section className="cc-page">
      {(!currency || !timezone) && (
        <p role="status" className="cc-muted">
          La configuración de moneda y zona horaria no está
          disponible. Los importes sin moneda se muestran como los
          entrega la API y las fechas en UTC.
        </p>
      )}

      <div className="cc-filters">
        <TextField
          label="Buscar clientes"
          icon={Search}
          type="search"
          maxLength={100}
          placeholder="Buscar por nombre, teléfono o correo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SelectField
          label="Adquisición"
          value={query.acquisitionSourceChannel}
          options={[
            {
              value: "",
              label: "Todos los canales",
            },
            ...Object.entries(channelLabels).map(
              ([value, label]) => ({
                value,
                label,
              })
            ),
          ]}
          onValueChange={(value) =>
            setQuery((previous) => ({
              ...previous,
              acquisitionSourceChannel:
                value as CustomerFilter["acquisitionSourceChannel"],
              page: 1,
            }))
          }
        />

        <SelectField
          label="Estado"
          value={query.isActive}
          options={[
            { value: "", label: "Todos" },
            { value: "true", label: "Activos" },
            { value: "false", label: "Archivados" },
          ]}
          onValueChange={(value) =>
            setQuery((previous) => ({
              ...previous,
              isActive: value as CustomerFilter["isActive"],
              page: 1,
            }))
          }
        />
      </div>

      {waiting && <LoadingState message="Consultando clientes…" />}

      {resource.error && (
        <Alert>
          {resource.error}{" "}
          <Button onClick={resource.reload}>Reintentar</Button>
        </Alert>
      )}

      {data && (
        <>
          {!data.customers.length ? (
            <div className="cc-empty" role="status">
              <h2>
                {hasFilters
                  ? "No hay clientes con estos filtros"
                  : "Aún no hay clientes"}
              </h2>

              <p>
                {hasFilters
                  ? "Prueba con otra búsqueda, estado o canal de adquisición."
                  : "Los clientes se identifican automáticamente por teléfono desde solicitudes y pedidos."}
              </p>

              {hasFilters && (
                <Button
                  variant="soft"
                  onClick={() => {
                    setSearch("");
                    setQuery({
                      ...query,
                      search: "",
                      isActive: "",
                      acquisitionSourceChannel: "",
                      page: 1,
                    });
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <table className="cc-table" id="customer-list">
              <thead>
                <tr>
                  {[
                    "Cliente",
                    "Adquisición",
                    "Último canal",
                    "Pedidos",
                    "Ventas",
                    "Compra efectiva",
                    "Última compra",
                    "Estado",
                    "Comunicaciones",
                    "Detalle",
                  ].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.customers.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Cliente">
                      <strong>{row.legalName}</strong>
                      <small>
                        {row.billingPhone || "Sin teléfono"}
                      </small>

                      {row.billingEmail && (
                        <small>{row.billingEmail}</small>
                      )}
                    </td>

                    <td data-label="Adquisición">
                      {channel(row.acquisitionSourceChannel)}
                    </td>

                    <td data-label="Último canal">
                      {channel(row.lastSourceChannel)}
                    </td>

                    <td data-label="Pedidos">{row.orderCount}</td>

                    <td data-label="Ventas">{row.saleCount}</td>

                    <td data-label="Compra efectiva">
                      <strong>
                        {amount(row.effectiveSalesTotal, currency)}
                      </strong>
                    </td>

                    <td data-label="Última compra">
                      {row.lastPurchaseAt
                        ? dateTime(row.lastPurchaseAt, timezone)
                        : "—"}
                    </td>

                    <td data-label="Estado">
                      <span
                        className="cc-badge"
                        data-tone={row.isActive ? "good" : "warn"}
                      >
                        {row.isActive ? "Activo" : "Archivado"}
                      </span>
                    </td>

                    <td data-label="Comunicaciones">
                      <span
                        className="cc-badge"
                        data-tone={
                          row.marketingConsent ? "good" : "neutral"
                        }
                      >
                        {row.marketingConsent
                          ? "Autorizado"
                          : "No autorizado"}
                      </span>
                    </td>

                    <td>
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => setSelected(row.id)}
                      >
                        Ver cliente
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Pagination
            page={data.pagination.page}
            pageSize={data.pagination.pageSize}
            totalItems={data.pagination.total}
            itemLabel="clientes"
            controlsId="customer-list"
            onPageChange={(page) => setQuery({ ...query, page })}
            onPageSizeChange={(pageSize) =>
              setQuery({ ...query, pageSize, page: 1 })
            }
          />
        </>
      )}

      {selected && (
        <CustomerDetail
          key={selected}
          id={selected}
          currency={currency}
          timezone={timezone}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
