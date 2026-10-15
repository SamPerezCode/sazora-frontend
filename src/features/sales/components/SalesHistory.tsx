import { useEffect, useId, useState } from "react";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { SelectField } from "../../../components/forms/SelectField";
import { Alert } from "../../../components/feedback/Alert";
import { BottomSheet } from "../../../components/layout/BottomSheet";

import { ApiError } from "../../../lib/http/client";

import { ResponsiveFilter } from "../../../components/ui/ResponsiveFilter";

import {
  getOrder,
  getOrdersForStatuses,
  locationErrorCodes,
} from "../services/sales.service";

import type { SalesScope } from "../services/sales.service";

import { cents, money, STATUS_LABELS } from "../schemas/sales.schema";

import type { Order, OrderSummary } from "../schemas/sales.schema";

import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderSummaryView } from "./OrderSummaryView";

const states = [
  "CLOSED",
  "CANCELLED",
  "OPEN",
  "CONFIRMED",
  "DELIVERED",
] as const;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO");

function day(value: string): string {
  const date = new Date(value);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

interface Props {
  token: string;
  scope: SalesScope;
  onBack: () => void;
  onLocationLost: (message: string) => void;
}

export function SalesHistory({
  token,
  scope,
  onBack,
  onLocationLost,
}: Props) {
  const [revision, setRevision] = useState(0);

  const [snapshot, setSnapshot] = useState<{
    revision: number;
    rows: OrderSummary[];
    error: string;
  } | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [table, setTable] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<OrderSummary | null>(null);

  const searchId = useId();
  const fromId = useId();
  const untilId = useId();

  useEffect(() => {
    const controller = new AbortController();

    void getOrdersForStatuses(token, scope, states, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;

        setSnapshot({
          revision,
          rows: rows.filter(
            (row) =>
              row.serviceType === "TABLE" ||
              row.serviceType === "TAKEAWAY"
          ),
          error: "",
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;

        if (
          cause instanceof ApiError &&
          locationErrorCodes.has(cause.code)
        ) {
          onLocationLost(cause.message);
        }

        setSnapshot({
          revision,
          rows: [],
          error:
            cause instanceof Error
              ? cause.message
              : "No pudimos cargar el historial.",
        });
      });

    return () => controller.abort();
  }, [token, scope, revision, onLocationLost]);

  const loading = snapshot?.revision !== revision;
  const rows = loading ? [] : snapshot.rows;
  const dateError = !!from && !!until && from > until;

  const filtered = dateError
    ? []
    : rows
        .filter((row) => {
          const text = [
            row.id,
            row.restaurantTableName,
            row.restaurantTableCode,
            row.notes,
            row.subtotal,
            money(cents(row.subtotal)),
          ].join(" ");

          return (
            (!status || row.status === status) &&
            (!service || row.serviceType === service) &&
            (!table || row.restaurantTableId === table) &&
            (!from || day(row.createdAt) >= from) &&
            (!until || day(row.createdAt) <= until) &&
            normalize(text).includes(normalize(query.trim()))
          );
        })
        .sort((a, b) => {
          if (sort === "amount") {
            const delta = cents(b.subtotal) - cents(a.subtotal);

            return delta > 0n ? 1 : delta < 0n ? -1 : 0;
          }

          return (
            (Date.parse(b.createdAt) - Date.parse(a.createdAt)) *
            (sort === "oldest" ? -1 : 1)
          );
        });

  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));

  const currentPage = Math.min(page, totalPages);

  const closed = filtered.filter((row) => row.status === "CLOSED");

  const tables = [
    ...new Map(
      rows
        .filter((row) => row.restaurantTableId)
        .map((row) => [
          row.restaurantTableId!,
          {
            value: row.restaurantTableId!,
            label: `${
              row.restaurantTableName ?? "Mesa"
            } · ${row.restaurantTableCode ?? ""}`,
          },
        ])
    ).values(),
  ];

  const stats = [
    ["Resultados", filtered.length],
    ["Cerradas", closed.length],
    [
      "Canceladas",
      filtered.filter((row) => row.status === "CANCELLED").length,
    ],
    [
      "Importe cerrado",
      money(
        closed.reduce((sum, row) => sum + cents(row.subtotal), 0n)
      ),
    ],
  ];

  function change(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <section className="mp-history">
      <div className="mp-history-heading">
        <Button
          variant="soft"
          size="compact"
          className="mp-history-back"
          aria-label="Volver a mesas y pedidos"
          onClick={onBack}
        >
          <ArrowLeft size={16} aria-hidden="true" />

          <span className="mp-only-desktop">
            Volver a mesas y pedidos
          </span>

          <span className="mp-only-mobile">Volver</span>
        </Button>

        <div>
          <h2>Historial de órdenes</h2>
          <p>
            {scope.location.name} · {scope.location.code}
          </p>
        </div>
      </div>

      <div className="mp-history-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{loading ? "—" : value}</strong>
          </div>
        ))}
      </div>

      <div className="mp-history-filters">
        <label className="sales-search" htmlFor={searchId}>
          <Search size={18} />
          <span className="sr-only">Buscar órdenes</span>

          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Buscar por número de orden, mesa, código, nota o importe"
            onChange={(event) => change(setQuery, event.target.value)}
          />
        </label>

        <ResponsiveFilter
          label="Estado de la orden"
          value={status}
          options={[
            { value: "", label: "Todas" },
            ...states.map((value) => ({
              value,
              label: STATUS_LABELS[value],
            })),
          ]}
          onChange={(value) => change(setStatus, value)}
        />

        <div className="mp-history-filter-grid">
          <SelectField
            label="Modalidad"
            value={service}
            onValueChange={(value) => change(setService, value)}
            options={[
              { value: "", label: "Todas" },
              { value: "TABLE", label: "Mesa" },
              { value: "TAKEAWAY", label: "Para recoger" },
            ]}
          />

          <SelectField
            label="Mesa"
            value={table}
            onValueChange={(value) => change(setTable, value)}
            options={[
              { value: "", label: "Todas las mesas" },
              ...tables,
            ]}
          />

          <label className="sales-label" htmlFor={fromId}>
            Desde
            <input
              id={fromId}
              type="date"
              value={from}
              max={until || undefined}
              onChange={(event) =>
                change(setFrom, event.target.value)
              }
            />
          </label>

          <label className="sales-label" htmlFor={untilId}>
            Hasta
            <input
              id={untilId}
              type="date"
              value={until}
              min={from || undefined}
              onChange={(event) =>
                change(setUntil, event.target.value)
              }
            />
          </label>

          <SelectField
            label="Ordenar"
            value={sort}
            onValueChange={(value) => change(setSort, value)}
            options={[
              { value: "recent", label: "Más recientes" },
              { value: "oldest", label: "Más antiguas" },
              { value: "amount", label: "Mayor importe" },
            ]}
          />
        </div>

        {dateError && (
          <p role="alert">
            La fecha inicial no puede ser posterior a la final.
          </p>
        )}
      </div>

      {loading ? (
        <p role="status">Cargando historial de la sede…</p>
      ) : snapshot.error ? (
        <Alert>
          <p>{snapshot.error}</p>

          <Button
            variant="secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          <div className="mp-history-results">
            <table
              className="ui-data-table mp-history-table"
              role="table"
            >
              <caption className="sr-only">
                Órdenes del punto de venta
              </caption>

              <colgroup>
                <col className="mp-col-order" />
                <col className="mp-col-date" />
                <col className="mp-col-status" />
                <col className="mp-col-payment" />
                <col className="mp-col-amount" />
              </colgroup>

              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Orden
                  </th>

                  <th scope="col" role="columnheader">
                    Fecha
                  </th>

                  <th
                    scope="col"
                    role="columnheader"
                    className="mp-history-status"
                  >
                    Estado
                  </th>

                  <th
                    scope="col"
                    role="columnheader"
                    className="mp-history-payment"
                  >
                    Pago
                  </th>

                  <th
                    scope="col"
                    role="columnheader"
                    className="mp-history-amount"
                  >
                    Importe
                  </th>
                </tr>
              </thead>

              <tbody role="rowgroup">
                {filtered
                  .slice((currentPage - 1) * 20, currentPage * 20)
                  .map((row) => (
                    <tr key={row.id} role="row">
                      <td className="mp-history-order" role="cell">
                        <button
                          className="mp-history-link"
                          type="button"
                          onClick={() => setOpened(row)}
                        >
                          <span>
                            <strong>#{row.id}</strong>
                            {" · "}
                            {row.serviceType === "TABLE"
                              ? (row.restaurantTableName ?? "Mesa")
                              : "Pedido para recoger"}
                          </span>

                          <small>
                            {row.serviceType === "TABLE"
                              ? "Mesa"
                              : "Para recoger"}

                            {row.customerCount !== null
                              ? ` · ${row.customerCount} personas`
                              : ""}
                          </small>
                        </button>
                      </td>

                      <td className="mp-history-date" role="cell">
                        <time dateTime={row.createdAt}>
                          {new Date(row.createdAt).toLocaleString(
                            "es-CO",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }
                          )}
                        </time>
                      </td>

                      <td className="mp-history-status" role="cell">
                        <OrderStatusBadge status={row.status} />
                      </td>

                      <td className="mp-history-payment" role="cell">
                        Sin información
                      </td>

                      <td className="mp-history-amount" role="cell">
                        <strong>{money(cents(row.subtotal))}</strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!filtered.length && (
            <p className="mp-empty">
              No hay órdenes que coincidan con los filtros.
            </p>
          )}

          <div className="mp-history-pagination">
            <Button
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>

            <span>
              Página {currentPage} de {totalPages}
            </span>

            <Button
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>

          <p className="mp-updated">
            Importes calculados con el subtotal de las órdenes
            filtradas. No representan pagos registrados. Fechas en la
            zona horaria de este dispositivo.
          </p>
        </>
      )}

      <Button
        variant="secondary"
        disabled={loading}
        onClick={() => setRevision((value) => value + 1)}
      >
        <RefreshCw size={16} />
        Actualizar historial
      </Button>

      {opened && (
        <HistoryDetail
          key={opened.id}
          row={opened}
          token={token}
          scope={scope}
          onClose={() => setOpened(null)}
          onLocationLost={onLocationLost}
        />
      )}
    </section>
  );
}

function HistoryDetail({
  row,
  token,
  scope,
  onClose,
  onLocationLost,
}: {
  row: OrderSummary;
  token: string;
  scope: SalesScope;
  onClose: () => void;
  onLocationLost: (message: string) => void;
}) {
  const id = useId();
  const [attempt, setAttempt] = useState(0);

  const [snapshot, setSnapshot] = useState<{
    attempt: number;
    order: Order | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getOrder(token, row.id, scope, controller.signal)
      .then((order) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            attempt,
            order,
            error: "",
          });
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;

        if (
          cause instanceof ApiError &&
          locationErrorCodes.has(cause.code)
        ) {
          onLocationLost(cause.message);
        }

        setSnapshot({
          attempt,
          order: null,
          error:
            cause instanceof Error
              ? cause.message
              : "No pudimos consultar la orden.",
        });
      });

    return () => controller.abort();
  }, [token, row.id, scope, attempt, onLocationLost]);

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title={`Orden #${row.id}`}
      className="sales-workspace mp-workspace mp-workspace-summary"
      onClose={onClose}
    >
      {snapshot?.attempt !== attempt ? (
        <p className="mp-dialog-content" role="status">
          Cargando cuenta…
        </p>
      ) : snapshot.order ? (
        <OrderSummaryView
          order={snapshot.order}
          table={
            row.restaurantTableId
              ? {
                  id: row.restaurantTableId,
                  name: row.restaurantTableName ?? "Mesa",
                  code: row.restaurantTableCode ?? "",
                  capacity: null,
                  isActive: false,
                }
              : undefined
          }
        />
      ) : (
        <div className="mp-dialog-content">
          <Alert>{snapshot.error}</Alert>

          <Button
            variant="secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reintentar
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
