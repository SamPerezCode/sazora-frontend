import { useCallback, useState, type FormEvent } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { cashDate, cashMoney } from "../../cash/utils/cash-format";

import {
  saleLabels,
  saleStatuses,
  type SalesFilters,
} from "../schemas/financial-sales.schema";

import { listFinancialSales } from "../services/financial-sales.service";

export function FinancialSalesList({
  locations,
  open,
}: {
  locations: { value: string; label: string }[];
  open: (id: string) => void;
}) {
  const { session, settings } = useAppShell();
  const access = session.authorization.locationAccess;

  const initial: SalesFilters = {
    locationId: access.hasGlobalAccess
      ? ""
      : (locations.find(
          (row) => row.value === access.defaultLocationId
        )?.value ??
        locations[0]?.value ??
        ""),
    cashSessionId: "",
    status: "",
    from: "",
    to: "",
  };

  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState({
    filters: initial,
    page: 1,
  });
  const [error, setError] = useState("");

  const zone = settings.data?.timezone ?? "America/Bogota";
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loader = useCallback(
    (signal: AbortSignal) =>
      listFinancialSales(session, query.filters, query.page, signal),
    [session, query]
  );

  const resource = useCashResource(loader);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      draft.cashSessionId &&
      !/^[1-9]\d*$/.test(draft.cashSessionId)
    ) {
      setError(
        "El número de turno debe ser un entero mayor que cero."
      );
      return;
    }

    const from = draft.from ? new Date(draft.from) : null;
    const to = draft.to ? new Date(draft.to) : null;

    if (
      (from && !Number.isFinite(from.getTime())) ||
      (to && !Number.isFinite(to.getTime()))
    ) {
      setError("Revisa las fechas del filtro.");
      return;
    }

    if (from && to && from > to) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    setError("");
    setQuery({
      filters: {
        ...draft,
        from: from?.toISOString() ?? "",
        to: to?.toISOString() ?? "",
      },
      page: 1,
    });
  }

  return (
    <section className="por-page fh-page">
      <form className="por-stack" onSubmit={apply}>
        <div className="fh-filters">
          <SelectField
            label="Ubicación"
            value={draft.locationId}
            options={[
              ...(access.hasGlobalAccess
                ? [{ value: "", label: "Todas" }]
                : []),
              ...locations,
            ]}
            onValueChange={(locationId) =>
              setDraft({
                ...draft,
                locationId,
                cashSessionId: "",
              })
            }
          />

          <TextField
            label="Turno de caja (número)"
            inputMode="numeric"
            placeholder="Todos"
            value={draft.cashSessionId}
            onChange={(event) =>
              setDraft({
                ...draft,
                cashSessionId: event.target.value,
              })
            }
          />

          <SelectField
            label="Estado"
            value={draft.status}
            options={[
              { value: "", label: "Todos" },
              ...saleStatuses.map((value) => ({
                value,
                label: saleLabels[value],
              })),
            ]}
            onValueChange={(status) =>
              setDraft({
                ...draft,
                status: status as SalesFilters["status"],
              })
            }
          />

          <TextField
            label="Fecha inicial"
            type="datetime-local"
            value={draft.from}
            onChange={(event) =>
              setDraft({
                ...draft,
                from: event.target.value,
              })
            }
          />

          <TextField
            label="Fecha final"
            type="datetime-local"
            value={draft.to}
            onChange={(event) =>
              setDraft({
                ...draft,
                to: event.target.value,
              })
            }
          />
        </div>

        <div className="por-toolbar">
          <small>
            Fechas del filtro: {localZone}. Fechas de las ventas:{" "}
            {zone}.
          </small>

          <div className="por-actions">
            <Button type="submit" variant="secondary">
              Aplicar filtros
            </Button>

            <Button
              variant="secondary"
              onClick={resource.reload}
              disabled={resource.loading}
            >
              Actualizar
            </Button>
          </div>
        </div>
      </form>

      {error && (
        <p className="por-error" role="alert">
          {error}
        </p>
      )}

      {resource.loading && <p role="status">Consultando ventas…</p>}

      {resource.error && (
        <p className="por-error" role="alert">
          {resource.error}
        </p>
      )}

      {resource.data && (
        <>
          <div
            className="fh-scroll"
            role="region"
            aria-label="Historial de ventas"
            tabIndex={0}
          >
            <table className="fh-table">
              <thead>
                <tr>
                  {[
                    "Venta",
                    "Orden",
                    "Fecha",
                    "Ubicación",
                    "Cajero",
                    "Cliente",
                    "Artículos",
                    "Unidades",
                    "Total original",
                    "Devuelto",
                    "Anulado",
                    "Total vigente",
                    "Estado",
                    "Detalle",
                  ].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {resource.data.sales.map((row) => (
                  <tr key={row.id}>
                    <td>#{row.id}</td>
                    <td>#{row.orderId}</td>
                    <td>{cashDate(row.soldAt, zone)}</td>
                    <td>{row.location.name}</td>
                    <td>{row.soldBy.fullName}</td>
                    <td>{row.customerName ?? "—"}</td>
                    <td>{row.itemCount}</td>
                    <td>{row.unitsSold}</td>

                    {[
                      row.total,
                      row.refundedTotalAmount,
                      row.voidedAmount,
                      row.effectiveTotalAmount,
                    ].map((value, index) => (
                      <td className="fh-money" key={index}>
                        {cashMoney(value, row.currencyCode)}
                      </td>
                    ))}

                    <td>
                      <span
                        className="por-badge"
                        data-status={row.status}
                      >
                        {saleLabels[row.status]}
                      </span>
                    </td>

                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => open(row.id)}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))}

                {!resource.data.sales.length && (
                  <tr>
                    <td colSpan={14}>
                      No hay ventas con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav
            className="por-actions"
            aria-label="Paginación de ventas"
          >
            <Button
              variant="secondary"
              disabled={query.page <= 1}
              onClick={() =>
                setQuery({
                  ...query,
                  page: query.page - 1,
                })
              }
            >
              Anterior
            </Button>

            <small>
              Página {resource.data.pagination.page} ·{" "}
              {resource.data.pagination.total} ventas
            </small>

            <Button
              variant="secondary"
              disabled={
                query.page >= resource.data.pagination.totalPages
              }
              onClick={() =>
                setQuery({
                  ...query,
                  page: query.page + 1,
                })
              }
            >
              Siguiente
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
