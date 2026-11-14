import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { Banknote, Plus, Search } from "lucide-react";

import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";

import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../hooks/useCashResource";
import { readCashBoard } from "../services/cash.service";
import { cashDate, cashMoney } from "../utils/cash-format";

import { CashSessionDetail } from "./CashSessionDetail";
import { CashActionDialog } from "./CashActionDialog";

export function CashBoard() {
  const { session, settings } = useAppShell();

  const loader = useCallback(
    (signal: AbortSignal) => readCashBoard(session, signal),
    [session]
  );

  const resource = useCashResource(loader);
  const [params, setParams] = useSearchParams();

  const selected = params.get("turno");

  const [tab, setTab] = useState("registers");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("ALL");
  const [registerStatus, setRegisterStatus] = useState("ALL");
  const [sessionStatus, setSessionStatus] = useState("ALL");
  const [dialog, setDialog] = useState<"register" | "open" | null>(
    null
  );
  const [notice, setNotice] = useState("");

  const data = resource.data;
  const timeZone = settings.data?.timezone ?? "America/Bogota";

  function select(id: string | null) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);

      if (id) next.set("turno", id);
      else next.delete("turno");

      return next;
    });
  }

  function dismiss() {
    setDialog(null);
    resource.reload();
  }

  const locations = [
    ...new Map(
      [
        ...(data?.locations ?? []),
        ...(data?.registers.map((row) => row.location) ?? []),
        ...(data?.sessions.map((row) => row.cashRegister.location) ??
          []),
      ].map((row) => [row.id, row])
    ).values(),
  ];

  const matches = (id: string, value: string) =>
    (location === "ALL" || location === id) &&
    value
      .toLocaleLowerCase("es-CO")
      .includes(query.trim().toLocaleLowerCase("es-CO"));

  const registers =
    data?.registers.filter(
      (row) =>
        matches(row.locationId, row.name + " " + row.code) &&
        (registerStatus === "ALL" ||
          row.isActive === (registerStatus === "ACTIVE"))
    ) ?? [];

  const sessions =
    data?.sessions.filter(
      (row) =>
        matches(
          row.cashRegister.locationId,
          row.id +
            " " +
            row.cashRegister.name +
            " " +
            row.cashRegister.code
        ) &&
        (sessionStatus === "ALL" || row.status === sessionStatus)
    ) ?? [];

  return (
    <section className="cash-page">
      <div hidden={!!selected}>
        <div className="cash-stack cash-board">
          <div className="cash-line cash-board-toolbar">
            <div
              className="cash-tabs"
              role="group"
              aria-label="Cajas y turnos"
            >
              {[
                ["registers", "Cajas"],
                ["sessions", "Turnos"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  variant={tab === value ? "primary" : "secondary"}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="cash-actions">
              {hasPermission(session, "locations.manage") && (
                <Button
                  variant="secondary"
                  disabled={!data}
                  onClick={() => setDialog("register")}
                >
                  <Plus aria-hidden="true" size={14} />
                  Nueva caja
                </Button>
              )}

              {hasPermission(session, "cash.sessions.open") && (
                <Button
                  disabled={!data}
                  onClick={() => setDialog("open")}
                >
                  <Banknote aria-hidden="true" size={14} />
                  Abrir turno
                </Button>
              )}
            </div>
          </div>

          {notice && (
            <p role="status" className="cash-note">
              {notice}
            </p>
          )}

          <div className="cash-filters">
            <div className="cash-search">
              <Search aria-hidden="true" size={16} />

              <input
                type="search"
                aria-label="Buscar por nombre o código"
                placeholder="Buscar por nombre o código"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <SelectField
              label="Ubicación"
              value={location}
              onValueChange={setLocation}
              options={[
                {
                  value: "ALL",
                  label: session.authorization.locationAccess
                    .hasGlobalAccess
                    ? "Todas las ubicaciones"
                    : "Todas mis ubicaciones",
                },
                ...locations.map((row) => ({
                  value: row.id,
                  label: row.name,
                })),
              ]}
            />

            <SelectField
              label="Estado"
              value={
                tab === "registers" ? registerStatus : sessionStatus
              }
              onValueChange={
                tab === "registers"
                  ? setRegisterStatus
                  : setSessionStatus
              }
              options={
                tab === "registers"
                  ? [
                      { value: "ALL", label: "Todos" },
                      { value: "ACTIVE", label: "Activa" },
                      { value: "INACTIVE", label: "Inactiva" },
                    ]
                  : [
                      { value: "ALL", label: "Todos" },
                      { value: "OPEN", label: "Abierto" },
                      { value: "CLOSED", label: "Cerrado" },
                    ]
              }
            />
          </div>

          {resource.loading && (
            <p role="status">Consultando cajas y turnos…</p>
          )}

          {resource.error && (
            <p role="alert" className="cash-negative">
              {resource.error}
            </p>
          )}

          {data && (
            <div className="cash-table-wrap">
              <table className="cash-table">
                <thead>
                  <tr>
                    {(tab === "registers"
                      ? [
                          "Caja / código",
                          "Ubicación",
                          "Estado",
                          "Turno",
                          "Responsable",
                          "Apertura",
                          "Acción",
                        ]
                      : [
                          "Turno / caja",
                          "Ubicación",
                          "Estado",
                          "Efectivo inicial",
                          "Esperado al cierre",
                          "Diferencia",
                          "Acción",
                        ]
                    ).map((label) => (
                      <th key={label} scope="col">
                        <span
                          className={
                            label === "Acción" ? "sr-only" : undefined
                          }
                        >
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {tab === "registers"
                    ? registers.map((row) => {
                        const open = data.sessions.find(
                          (candidate) =>
                            candidate.cashRegisterId === row.id &&
                            candidate.status === "OPEN"
                        );

                        return (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.name}</strong>
                              <small>{row.code}</small>
                            </td>
                            <td>{row.location.name}</td>
                            <td>
                              <span
                                className="cash-badge"
                                data-status={
                                  row.isActive ? "ACTIVE" : "INACTIVE"
                                }
                              >
                                {row.isActive ? "Activa" : "Inactiva"}
                              </span>{" "}
                            </td>
                            <td>
                              {open
                                ? "#" + open.id + " · Abierto"
                                : "Sin turno abierto"}
                            </td>
                            <td>{open?.openedBy.fullName ?? "—"}</td>
                            <td>
                              {cashDate(
                                open?.openedAt ?? null,
                                timeZone
                              )}
                            </td>
                            <td>
                              {open && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => select(open.id)}
                                >
                                  Consultar turno
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    : sessions.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>#{row.id}</strong>
                            <small>{row.cashRegister.name}</small>
                          </td>
                          <td>{row.cashRegister.location.name}</td>
                          <td>
                            {row.status === "OPEN"
                              ? "Abierto"
                              : "Cerrado"}
                          </td>
                          <td>
                            {cashMoney(
                              row.openingCashAmount,
                              row.currencyCode
                            )}
                          </td>
                          <td>
                            {cashMoney(
                              row.expectedCashAmount,
                              row.currencyCode
                            )}
                          </td>
                          <td>
                            {cashMoney(
                              row.differenceAmount,
                              row.currencyCode
                            )}
                          </td>
                          <td>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => select(row.id)}
                            >
                              Consultar turno
                            </Button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>

              {!(tab === "registers" ? registers : sessions)
                .length && (
                <p>No hay resultados con estos filtros.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {selected &&
        (/^[1-9]\d*$/.test(selected) ? (
          <CashSessionDetail
            key={selected}
            id={selected}
            back={() => select(null)}
            changed={resource.reload}
          />
        ) : (
          <Button onClick={() => select(null)}>
            Volver: identificador de turno inválido
          </Button>
        ))}

      {dialog && data && (
        <CashActionDialog
          action={{ kind: dialog, board: data }}
          close={dismiss}
          saved={(message, id) => {
            setNotice(message);
            dismiss();
            if (id) select(id);
          }}
        />
      )}
    </section>
  );
}
