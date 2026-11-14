import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../hooks/useCashResource";
import { readCashSession } from "../services/cash.service";
import { cashDate, cashMoney } from "../utils/cash-format";

import {
  CashSummary,
  CashMovements,
  CashReconciliation,
  CashCount,
} from "./CashPanels";

import { CashActionDialog } from "./CashActionDialog";
import { CashCloseDialog } from "./CashCloseDialog";

const tabs = [
  { value: "summary", label: "Resumen" },
  { value: "movements", label: "Movimientos" },
  { value: "reconciliation", label: "Conciliación" },
  { value: "count", label: "Arqueo" },
];

export function CashSessionDetail({
  id,
  back,
  changed,
}: {
  id: string;
  back: () => void;
  changed: () => void;
}) {
  const { session, settings } = useAppShell();
  const timeZone = settings.data?.timezone ?? "America/Bogota";

  const loader = useCallback(
    (signal: AbortSignal) => readCashSession(id, session, signal),
    [id, session]
  );

  const resource = useCashResource(loader);

  const [tab, setTab] = useState("summary");
  const [dialog, setDialog] = useState<"movement" | "close" | null>(
    null
  );
  const [notice, setNotice] = useState("");

  const data = resource.data;
  const row = data?.reconciliation.cashSession;

  function refresh() {
    resource.reload();
    changed();
  }

  function dismiss() {
    setDialog(null);
    refresh();
  }

  return (
    <section className="cash-stack">
      <div className="cash-line">
        <Button variant="secondary" onClick={back}>
          Regresar a cajas y turnos
        </Button>
      </div>

      <h2>Turno #{id}</h2>

      {notice && (
        <p role="status" className="cash-note">
          {notice}
        </p>
      )}

      {resource.loading && <p role="status">Consultando turno…</p>}

      {resource.error && (
        <p role="alert" className="cash-negative">
          {resource.error}
        </p>
      )}

      {row && data && (
        <>
          <p>
            {row.cashRegister.name} · {row.cashRegister.location.name}
          </p>

          <div className="cash-line">
            <p>
              <span className="cash-badge">
                {row.status === "OPEN" ? "Abierto" : "Cerrado"}
              </span>{" "}
              Abierto por {row.openedBy.fullName} ·{" "}
              {cashDate(row.openedAt, timeZone)}
            </p>

            {row.status === "OPEN" && (
              <div className="cash-actions">
                {hasPermission(
                  session,
                  "cash.transactions.create"
                ) && (
                  <Button
                    variant="secondary"
                    onClick={() => setDialog("movement")}
                  >
                    Registrar movimiento
                  </Button>
                )}

                {hasPermission(session, "cash.sessions.close") && (
                  <Button onClick={() => setDialog("close")}>
                    Cerrar turno
                  </Button>
                )}
              </div>
            )}
          </div>

          <div
            className="cash-tabs"
            role="group"
            aria-label="Detalle del turno"
          >
            {tabs.map((option) => (
              <Button
                key={option.value}
                variant={
                  tab === option.value ? "primary" : "secondary"
                }
                aria-pressed={tab === option.value}
                onClick={() => setTab(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {tab === "summary" && (
            <CashSummary
              data={data.reconciliation}
              timeZone={timeZone}
            />
          )}

          {tab === "movements" && (
            <CashMovements
              rows={data.movements}
              currency={row.currencyCode}
              timeZone={timeZone}
            />
          )}

          {tab === "reconciliation" && (
            <CashReconciliation data={data.reconciliation} />
          )}

          {tab === "count" && (
            <CashCount session={row} timeZone={timeZone} />
          )}
        </>
      )}

      {dialog === "movement" && row && (
        <CashActionDialog
          action={{ kind: "movement", cashSession: row }}
          close={dismiss}
          saved={(message) => {
            setNotice(message);
            dismiss();
          }}
        />
      )}

      {dialog === "close" && (
        <CashCloseDialog
          id={id}
          close={dismiss}
          saved={(result) => {
            setNotice(
              "Turno cerrado. Diferencia definitiva: " +
                cashMoney(
                  result.differenceAmount,
                  result.currencyCode
                )
            );
            setTab("count");
            dismiss();
          }}
        />
      )}
    </section>
  );
}
