import { useId, useState } from "react";
import { CreditCard, Pencil, Plus, Power } from "lucide-react";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";
import { Pagination } from "../../../components/ui/Pagination";
import { useAdminResource } from "../../../hooks/useAdminResource";
import { useTimedMessage } from "../../../hooks/useTimedMessage";
import { hasPermission } from "../../auth/utils/permissions";
import { paymentTypes } from "../schemas/payment-method.schema";
import { getPaymentMethods } from "../services/payment-method.service";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import type { PaymentMethodAction } from "./PaymentMethodDialog";
import "../payment-methods.css";

export function PaymentMethodsPanel() {
  const { session } = useAppShell();
  const listId = useId();

  const canManage = hasPermission(
    session,
    "business.settings.manage"
  );

  const resource = useAdminResource(
    getPaymentMethods,
    "payment-methods",
    "business.settings.read",
    true
  );

  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [action, setAction] = useState<PaymentMethodAction | null>(
    null
  );
  const [notice, setNotice] = useTimedMessage();

  const items = resource.data;

  const filtered = (items ?? []).filter(
    (item) =>
      status === "ALL" || item.isActive === (status === "ACTIVE")
  );

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize))
  );

  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <section className="configuration-section payment-methods-panel">
      <header className="configuration-heading payment-methods-heading">
        <h2>Formas de pago</h2>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setAction({ kind: "create" })}
          >
            <Plus size={16} aria-hidden="true" />
            Nueva forma de pago
          </Button>
        )}
      </header>

      <div className="payment-methods-filter">
        <SelectField
          label="Estado"
          value={status}
          options={[
            { value: "ALL", label: "Todos" },
            { value: "ACTIVE", label: "Activas" },
            { value: "INACTIVE", label: "Inactivas" },
          ]}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      {resource.error && (
        <Alert>
          {items !== undefined && (
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

      {items === undefined ? (
        resource.pending && (
          <LoadingState message="Consultando formas de pago…" />
        )
      ) : filtered.length === 0 ? (
        <div className="configuration-card configuration-state">
          <CreditCard size={28} aria-hidden="true" />

          <h3>
            {items.length
              ? "No hay formas de pago con este estado"
              : "Aún no tienes formas de pago"}
          </h3>

          <p>
            {items.length
              ? "Selecciona otro estado para consultar las formas de pago."
              : "Crea una forma de pago para utilizarla en los cobros."}
          </p>
        </div>
      ) : (
        <>
          <ul
            id={listId}
            className="payment-methods-list"
            aria-label="Formas de pago"
          >
            {visible.map((item) => (
              <li className="payment-methods-row" key={item.id}>
                <CreditCard
                  className="payment-methods-icon"
                  size={19}
                  aria-hidden="true"
                />

                <div className="payment-methods-information">
                  <h3>{item.name}</h3>

                  <p>
                    {item.code}
                    {" · "}
                    {
                      paymentTypes.find(
                        (type) => type.value === item.paymentType
                      )?.label
                    }
                    {" · Orden "}
                    {item.displayOrder}
                  </p>

                  <div className="payment-methods-badges">
                    <span data-active={item.isActive}>
                      {item.isActive ? "Activa" : "Inactiva"}
                    </span>

                    {item.affectsCash && <span>Afecta efectivo</span>}

                    {item.allowsChange && <span>Permite cambio</span>}

                    {item.requiresReference && (
                      <span>Requiere referencia</span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="payment-methods-actions">
                    <button
                      type="button"
                      aria-label={"Editar " + item.name}
                      title="Editar forma de pago"
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
                      aria-label={
                        (item.isActive ? "Desactivar " : "Activar ") +
                        item.name
                      }
                      title={item.isActive ? "Desactivar" : "Activar"}
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
              </li>
            ))}
          </ul>

          {filtered.length > 10 && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              itemLabel="formas de pago"
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

      {action && (
        <PaymentMethodDialog
          key={
            action.kind +
            ":" +
            (action.kind === "create" ? "new" : action.id)
          }
          action={action}
          onClose={(refresh = false) => {
            setAction(null);

            if (refresh) {
              resource.refresh();
            }
          }}
          onSaved={(method) => {
            if (action.kind === "create") {
              setStatus("ALL");
              setPage(1);
            }

            setAction(null);
            setNotice(
              "Forma de pago " +
                method.name +
                " guardada correctamente."
            );
            resource.refresh();
          }}
        />
      )}
    </section>
  );
}
