import { useAppShell } from "../../../../app/layout/shell-context";
import { SelectField } from "../../../../components/forms/SelectField";
import { TextField } from "../../../../components/forms/TextField";
import { Button } from "../../../../components/ui/Button";
import { hasPermission } from "../../../auth/utils/permissions";
import { getEmployees } from "../../../employees/services/employee.service";
import { useRemote } from "../../hooks/usePublicOrders";
import type { Assignment } from "../../schemas/public-orders.schema";
import { Feedback } from "../public-orders/PublicOrderShared";
import { useCallback } from "react";
import { useState } from "react";

export function AssignmentForm({
  busy,
  submit,
}: {
  busy: boolean;
  submit: (body: Assignment) => void;
}) {
  const { session } = useAppShell();
  const token = session.accessToken;
  const readEmployees = hasPermission(session, "employees.read");

  const loader = useCallback(
    async (signal: AbortSignal) =>
      readEmployees ? getEmployees(token, signal) : [],
    [token, readEmployees]
  );

  const employees = useRemote(loader);

  const [mode, setMode] = useState(
    readEmployees ? "INTERNAL" : "EXTERNAL"
  );

  const [driver, setDriver] = useState("");
  const [provider, setProvider] = useState("");

  const eligible = (employees.data ?? []).filter(
    (employee) =>
      employee.isActive &&
      employee.membershipIsActive &&
      employee.roles.includes("DELIVERY_DRIVER")
  );

  const valid =
    hasPermission(session, "deliveries.manage") &&
    (mode === "INTERNAL"
      ? eligible.some((employee) => employee.membershipId === driver)
      : !!provider.trim());

  return (
    <div className="por-stack">
      <SelectField
        label="Tipo de reparto"
        value={mode}
        disabled={busy}
        onValueChange={setMode}
        options={[
          {
            value: "INTERNAL",
            label: "Domiciliario del negocio",
            disabled: !readEmployees,
          },
          {
            value: "EXTERNAL",
            label: "Proveedor externo",
          },
        ]}
      />

      {mode === "INTERNAL" ? (
        <>
          <Feedback
            loading={employees.loading}
            error={employees.error}
          />

          <SelectField
            label="Domiciliario"
            value={driver}
            onValueChange={setDriver}
            disabled={busy || employees.loading}
            options={eligible.map((employee) => ({
              value: employee.membershipId,
              label: employee.fullName,
            }))}
          />

          {!employees.loading && !eligible.length && (
            <p>No hay empleados activos con rol de domiciliario.</p>
          )}

          {employees.error && (
            <Button variant="secondary" onClick={employees.reload}>
              Reintentar empleados
            </Button>
          )}
        </>
      ) : (
        <TextField
          label="Nombre del proveedor"
          value={provider}
          maxLength={150}
          disabled={busy}
          onChange={(event) => setProvider(event.target.value)}
        />
      )}

      {!readEmployees && (
        <small>
          La asignación interna requiere permiso para consultar
          empleados.
        </small>
      )}

      <Button
        loading={busy}
        disabled={!valid}
        onClick={() => {
          if (!valid) return;

          submit(
            mode === "INTERNAL"
              ? {
                  deliveryMode: "INTERNAL",
                  driverMembershipId: driver,
                }
              : {
                  deliveryMode: "EXTERNAL",
                  externalProviderName: provider.trim(),
                }
          );
        }}
      >
        Confirmar asignación
      </Button>
    </div>
  );
}
