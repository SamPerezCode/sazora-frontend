import { useState } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { TextField } from "../../../components/forms/TextField";
import { TextAreaField } from "../../../components/forms/TextAreaField";
import { SelectField } from "../../../components/forms/SelectField";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";

import { hasPermission } from "../../auth/utils/permissions";
import { useCashMutation } from "../hooks/useCashMutation";

import {
  createRegisterInput,
  openSessionInput,
  manualMovementInput,
} from "../schemas/cash.schema";

import type { CashSession } from "../schemas/cash.schema";

import {
  createRegister,
  openSession,
  createMovement,
} from "../services/cash.service";

import type { CashBoard } from "../services/cash.service";

type Action =
  | { kind: "register"; board: CashBoard }
  | { kind: "open"; board: CashBoard }
  | { kind: "movement"; cashSession: CashSession };

export function CashActionDialog({
  action,
  close,
  saved,
}: {
  action: Action;
  close: () => void;
  saved: (notice: string, sessionId?: string) => void;
}) {
  const { session } = useAppShell();
  const mutation = useCashMutation();

  const [locationId, setLocationId] = useState("");
  const [cashRegisterId, setCashRegisterId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [movementType, setMovementType] = useState("MANUAL_INCOME");

  const title =
    action.kind === "register"
      ? "Nueva caja"
      : action.kind === "open"
        ? "Abrir turno"
        : "Registrar movimiento";

  const permission =
    action.kind === "register"
      ? "locations.manage"
      : action.kind === "open"
        ? "cash.sessions.open"
        : "cash.transactions.create";

  const available =
    action.kind === "movement"
      ? []
      : action.board.registers.filter(
          (register) =>
            register.isActive &&
            register.location.isActive &&
            register.location.isSalesLocation &&
            !action.board.sessions.some(
              (row) =>
                row.cashRegisterId === register.id &&
                row.status === "OPEN"
            )
        );

  const locations =
    action.kind === "movement"
      ? []
      : action.board.locations.filter(
          (location) => location.isActive && location.isSalesLocation
        );

  const register = createRegisterInput.safeParse({
    locationId,
    code,
    name,
  });

  const opening = openSessionInput.safeParse({
    cashRegisterId,
    openingCashAmount: amount,
    openingNotes: notes,
  });

  const movement = manualMovementInput.safeParse({
    cashSessionId:
      action.kind === "movement" ? action.cashSession.id : "",
    movementType,
    amount,
    reason: notes,
    reference,
  });

  const valid =
    action.kind === "register"
      ? register.success &&
        locations.some((location) => location.id === locationId)
      : action.kind === "open"
        ? opening.success &&
          available.some((row) => row.id === cashRegisterId)
        : movement.success && action.cashSession.status === "OPEN";

  const blocked =
    mutation.busy ||
    mutation.uncertain ||
    !hasPermission(session, permission);

  function submit() {
    if (blocked || !valid) return;

    if (action.kind === "register" && register.success) {
      void mutation.run(
        (signal) =>
          createRegister({ locationId, code, name }, session, signal),
        (row) => saved("Caja creada: " + row.name)
      );
    } else if (action.kind === "open" && opening.success) {
      void mutation.run(
        (signal) =>
          openSession(
            {
              cashRegisterId,
              openingCashAmount: amount,
              openingNotes: notes,
            },
            session,
            signal
          ),
        (row) => saved("Turno #" + row.id + " abierto.", row.id)
      );
    } else if (action.kind === "movement" && movement.success) {
      void mutation.run(
        (signal) =>
          createMovement(
            {
              cashSessionId: action.cashSession.id,
              movementType: movement.data.movementType,
              amount,
              reason: notes,
              reference,
            },
            session,
            signal
          ),
        (row) => saved("Movimiento #" + row.id + " registrado.")
      );
    }
  }

  return (
    <BottomSheet
      id="cash-action"
      open
      variant="modal"
      className="cash-dialog cash-action-dialog"
      title={title}
      busy={mutation.busy}
      onClose={close}
    >
      <p className="cash-dialog-subtitle">
        {action.kind === "register"
          ? "Asocia la caja a una ubicación habilitada para vender"
          : action.kind === "open"
            ? "Registra el efectivo inicial de la caja"
            : action.cashSession.cashRegister.name +
              " · " +
              action.cashSession.currencyCode}
      </p>

      <form
        className="cash-stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {mutation.error && (
          <p role="alert" className="cash-negative">
            {mutation.error}
          </p>
        )}

        <fieldset disabled={blocked} className="cash-stack">
          {action.kind === "register" ? (
            <>
              <SelectField
                label="Ubicación"
                placeholder="Seleccionar ubicación"
                value={locationId}
                onValueChange={setLocationId}
                disabled={blocked}
                required
                options={locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                }))}
              />

              {!locations.length && (
                <p>
                  No hay ubicaciones disponibles para crear una caja.
                </p>
              )}

              <TextField
                label="Código"
                placeholder=""
                value={code}
                maxLength={30}
                required
                onChange={(event) => setCode(event.target.value)}
              />

              <TextField
                label="Nombre"
                placeholder=""
                value={name}
                maxLength={120}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </>
          ) : (
            <>
              {action.kind === "open" ? (
                <>
                  <SelectField
                    label="Caja"
                    placeholder="Seleccionar caja"
                    value={cashRegisterId}
                    onValueChange={setCashRegisterId}
                    disabled={blocked}
                    required
                    options={available.map((row) => ({
                      value: row.id,
                      label: row.name + " · " + row.location.name,
                    }))}
                  />

                  {!available.length && (
                    <p>No hay cajas activas sin turno abierto.</p>
                  )}
                </>
              ) : (
                <SelectField
                  label="Tipo"
                  value={movementType}
                  onValueChange={setMovementType}
                  disabled={blocked}
                  options={[
                    {
                      value: "MANUAL_INCOME",
                      label: "Ingreso manual",
                    },
                    { value: "WITHDRAWAL", label: "Retiro" },
                    { value: "EXPENSE", label: "Gasto" },
                  ]}
                />
              )}

              <TextField
                label={
                  action.kind === "open"
                    ? "Efectivo inicial"
                    : "Valor"
                }
                placeholder=""
                value={amount}
                inputMode="decimal"
                title="Sin separadores de miles; usa punto para los decimales."
                required
                onChange={(event) => setAmount(event.target.value)}
              />

              {action.kind === "movement" && (
                <>
                  <small>
                    Sin separadores de miles; usa punto para los
                    decimales.
                  </small>

                  <TextField
                    label="Referencia (opcional)"
                    value={reference}
                    maxLength={120}
                    onChange={(event) =>
                      setReference(event.target.value)
                    }
                  />
                </>
              )}

              <div className="cash-notes-field">
                <TextAreaField
                  label={
                    action.kind === "movement"
                      ? "Motivo obligatorio"
                      : "Observaciones (opcional)"
                  }
                  placeholder=""
                  value={notes}
                  rows={3}
                  required={action.kind === "movement"}
                  maxLength={500}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </>
          )}
        </fieldset>

        <div className="cash-actions">
          {action.kind === "movement" && (
            <Button
              variant="secondary"
              disabled={mutation.busy}
              onClick={close}
            >
              Cancelar
            </Button>
          )}

          <Button
            type="submit"
            loading={mutation.busy}
            disabled={blocked || !valid}
          >
            {action.kind === "register" ? "Crear caja" : title}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
