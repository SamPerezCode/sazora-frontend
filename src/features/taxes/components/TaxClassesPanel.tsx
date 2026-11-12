import { useId, useState } from "react";
import { Pencil, Percent, Plus, Power } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { calendarToday } from "../../../components/forms/calendar-date";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { useAdminResource } from "../../../hooks/useAdminResource";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { hasPermission } from "../../auth/utils/permissions";
import {
  currentTaxRate,
  taxDate,
  taxPercentage,
  taxTypes,
} from "../schemas/tax-class.schema";
import { getTaxWorkspace } from "../services/tax-class.service";
import { TaxClassDialog } from "./TaxClassDialog";
import type { TaxAction } from "./TaxClassDialog";
import "../tax-classes.css";

export function TaxClassesPanel() {
  const { session } = useAppShell();
  const listId = useId();

  const canManage = hasPermission(session, "taxes.manage");

  const resource = useAdminResource(
    getTaxWorkspace,
    "tax-classes",
    "taxes.read",
    true
  );

  const [action, setAction] = useState<TaxAction | null>(null);
  const [notice, setNotice] = useTimedMessage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const data = resource.data;
  const items = data?.taxClasses ?? [];
  const today = data ? calendarToday(data.timezone) : "";

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(items.length / pageSize))
  );

  const visible = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <section className="configuration-section tax-panel">
      <header className="configuration-heading tax-heading">
        <h2>Impuestos</h2>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setAction({ kind: "create" })}
            disabled={!data}
          >
            <Plus size={16} aria-hidden="true" />
            Nueva clase de impuesto
          </Button>
        )}
      </header>

      {notice && <Alert variant="success">{notice}</Alert>}

      {resource.error && (
        <Alert>
          {data && (
            <p>
              No pudimos actualizar. Se conservan los últimos datos
              consultados.
            </p>
          )}

          <p>{resource.error}</p>

          <Button variant="secondary" onClick={resource.refresh}>
            Reintentar
          </Button>
        </Alert>
      )}

      {!data ? (
        resource.pending && (
          <LoadingState message="Consultando impuestos…" />
        )
      ) : items.length === 0 ? (
        <div className="configuration-card configuration-state">
          <Percent size={28} aria-hidden="true" />
          <h3>Aún no tienes clases de impuesto</h3>
          <p>Registra una clase y su tarifa inicial para comenzar.</p>
        </div>
      ) : (
        <>
          <ul
            id={listId}
            className="tax-list"
            aria-label="Clases de impuesto"
          >
            {visible.map((item) => {
              const current = currentTaxRate(item, today);

              return (
                <li className="tax-row" key={item.id}>
                  <Percent
                    className="tax-icon"
                    size={20}
                    aria-hidden="true"
                  />

                  <div className="tax-information">
                    <h3>{item.name}</h3>

                    <p>
                      {item.code}
                      {" · "}
                      {
                        taxTypes.find(
                          (type) => type.value === item.taxType
                        )?.label
                      }
                    </p>

                    <div className="tax-badges">
                      <span data-active={item.isActive}>
                        {item.isActive ? "Activo" : "Inactivo"}
                      </span>

                      <span>
                        {current
                          ? taxPercentage(current.rate)
                          : "Sin tarifa vigente"}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="tax-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!item.isActive}
                        onClick={() =>
                          setAction({
                            kind: "rate",
                            id: item.id,
                          })
                        }
                      >
                        Nueva tarifa
                      </Button>

                      <button
                        type="button"
                        className="tax-icon-button"
                        aria-label={"Editar " + item.name}
                        title="Editar clase"
                        onClick={() =>
                          setAction({
                            kind: "edit",
                            id: item.id,
                          })
                        }
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="tax-icon-button"
                        aria-label={
                          (item.isActive
                            ? "Desactivar "
                            : "Activar ") + item.name
                        }
                        title={
                          item.isActive
                            ? "Desactivar clase"
                            : "Activar clase"
                        }
                        onClick={() =>
                          setAction({
                            kind: "status",
                            id: item.id,
                          })
                        }
                      >
                        <Power size={17} aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  <details className="tax-history">
                    <summary>Historial de tarifas</summary>

                    {item.rates.length === 0 ? (
                      <p>No hay tarifas registradas.</p>
                    ) : (
                      <ul aria-label={"Tarifas de " + item.name}>
                        {item.rates.map((rate) => (
                          <li key={rate.id}>
                            <strong>
                              {taxPercentage(rate.rate)}
                            </strong>

                            <span>
                              {taxDate(rate.validFrom)}
                              {" — "}
                              {rate.validTo
                                ? taxDate(rate.validTo)
                                : "Sin fecha final"}
                            </span>

                            <span>
                              {!rate.isActive
                                ? "Inactiva"
                                : rate.validFrom > today
                                  ? "Programada"
                                  : rate.validTo &&
                                      rate.validTo < today
                                    ? "Finalizada"
                                    : "Vigente"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>

          {items.length > 10 && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={items.length}
              itemLabel="clases de impuesto"
              controlsId={listId}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </>
      )}

      {action && data && (
        <TaxClassDialog
          key={
            action.kind +
            ":" +
            (action.kind === "create" ? "new" : action.id)
          }
          action={action}
          timezone={data.timezone}
          onClose={(refresh = false) => {
            setAction(null);

            if (refresh) {
              resource.refresh();
            }
          }}
          onSaved={(item) => {
            setNotice(
              action.kind === "rate"
                ? "Tarifa de " +
                    item.name +
                    " guardada correctamente."
                : "Clase " + item.name + " guardada correctamente."
            );

            setAction(null);
            resource.refresh();
          }}
        />
      )}
    </section>
  );
}
