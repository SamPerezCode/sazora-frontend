import { useCallback, useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";

import { useCashResource } from "../hooks/useCashResource";
import { readCashSession } from "../services/cash.service";

import {
  canCloseCash,
  readCloseReconciliation,
} from "../services/cash-close.service";

import type { CashSession } from "../schemas/cash.schema";
import type { CashCountDraft } from "../utils/cash-count";
import { cashDate } from "../utils/cash-format";

import {
  CashSummary,
  CashMovements,
  CashReconciliation,
} from "./CashPanels";

import { CashCountPanel } from "./CashCountPanel";
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
    (signal: AbortSignal) =>
      readCloseReconciliation(id, session, signal),
    [id, session]
  );

  const resource = useCashResource(loader);

  const [tab, setTab] = useState("summary");
  const [dialog, setDialog] = useState<"movement" | "close" | null>(
    null
  );

  const [draft, setDraft] = useState<CashCountDraft | undefined>();

  const [closed, setClosed] = useState<CashSession | null>(null);
  const [notice, setNotice] = useState("");

  const row = closed ?? resource.data?.cashSession;

  const data =
    resource.data && row
      ? { ...resource.data, cashSession: row }
      : undefined;

  function refresh() {
    resource.reload();
    changed();
  }

  function dismiss() {
    setDialog(null);
    refresh();
  }

  return (
    <section className="cash-stack cash-session-detail">
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
        <div className="cash-stack">
          <p role="alert" className="cash-negative">
            {resource.error}
          </p>

          <Button variant="secondary" onClick={resource.reload}>
            Reintentar consulta
          </Button>
        </div>
      )}

      {row && (
        <>
          <p>
            {row.cashRegister.name} · {row.cashRegister.location.name}
          </p>

          <div className="cash-line">
            <p>
              <span className="cash-badge" data-status={row.status}>
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

                {canCloseCash(row, session) && (
                  <Button
                    onClick={() => {
                      setDraft(undefined);
                      setDialog("close");
                    }}
                  >
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

          {tab === "summary" && data && (
            <CashSummary data={data} timeZone={timeZone} />
          )}

          {tab === "movements" && (
            <SessionMovements key={row.status} id={id} />
          )}

          {tab === "reconciliation" && data && (
            <CashReconciliation data={data} />
          )}

          {tab === "count" && (
            <CashCountPanel
              row={row}
              data={resource.data}
              timeZone={timeZone}
              allowed={canCloseCash(row, session)}
              onReview={(value) => {
                setDraft(value);
                setDialog("close");
              }}
            />
          )}
        </>
      )}

      {dialog === "movement" && row && (
        <CashActionDialog
          action={{
            kind: "movement",
            cashSession: row,
          }}
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
          initial={draft}
          close={dismiss}
          saved={(result, submitted) => {
            setClosed(result);

            setNotice(
              submitted
                ? "Turno cerrado correctamente."
                : "El turno ya está cerrado. Se muestra el arqueo registrado."
            );

            setTab("count");
            dismiss();
          }}
        />
      )}
    </section>
  );
}

function SessionMovements({ id }: { id: string }) {
  const { session, settings } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) => readCashSession(id, session, signal),
    [id, session]
  );

  const resource = useCashResource(loader);

  return (
    <div className="cash-stack">
      {resource.loading && (
        <p role="status">Consultando movimientos…</p>
      )}

      {resource.error && (
        <>
          <p role="alert" className="cash-negative">
            {resource.error}
          </p>

          <Button variant="secondary" onClick={resource.reload}>
            Reintentar consulta
          </Button>
        </>
      )}

      {resource.data && (
        <CashMovements
          rows={resource.data.movements}
          currency={
            resource.data.reconciliation.cashSession.currencyCode
          }
          timeZone={settings.data?.timezone ?? "America/Bogota"}
        />
      )}
    </div>
  );
}
