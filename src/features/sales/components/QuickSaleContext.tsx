import { useCallback } from "react";

import { useAppShell } from "../../../app/layout/shell-context";
import { SelectField } from "../../../components/forms/SelectField";
import { Button } from "../../../components/ui/Button";

import { hasPermission } from "../../auth/utils/permissions";

import { useRemote } from "../hooks/usePublicOrders";

import {
  readPreorderPayment,
  readPreorderPaymentOptions,
} from "../services/preorder-payments.service";

import type { SalesScope } from "../services/sales.service";
import type { Order } from "../schemas/sales.schema";

export function QuickSaleContext({
  scope,
  order,
  value,
  onChange,
  disabled,
}: {
  scope: SalesScope;
  order: Order | null;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { session } = useAppShell();

  const paid = !!order && order.paymentStatus !== "PENDING";

  const orderId = order?.id;

  const load = useCallback(
    async (signal: AbortSignal) => {
      const options = await readPreorderPaymentOptions(
        session,
        scope,
        signal,
        false
      );

      const batch =
        paid &&
        orderId &&
        hasPermission(session, "orders.payments.read")
          ? await readPreorderPayment(session, orderId, signal)
          : null;

      return {
        ...options,
        batch,
      };
    },
    [session, scope, paid, orderId]
  );

  const resource = useRemote(load);

  const savedSession = resource.data?.batch?.cashSessionId;

  const original = resource.data?.sessions.find(
    (row) => row.id === savedSession
  );

  return (
    <div className="quick-sale-context">
      <p>
        {scope.location.name} · Responsable: {session.user.fullName}
      </p>

      {paid ? (
        <p>
          {original?.cashRegister.name ?? "Caja del pago registrado"}
          {" · "}
          Turno #{savedSession ?? "por consultar"}
        </p>
      ) : hasPermission(session, "cash.sessions.read") ? (
        <SelectField
          label="Caja y turno"
          value={value}
          disabled={disabled || resource.loading}
          placeholder="Selecciona un turno"
          options={(resource.data?.sessions ?? []).map((row) => ({
            value: row.id,
            label: row.cashRegister.name + " · Turno #" + row.id,
          }))}
          onValueChange={onChange}
        />
      ) : (
        <p>No tienes permiso para consultar turnos de caja.</p>
      )}

      {resource.error && (
        <div role="alert">
          {resource.error}{" "}
          <Button
            variant="soft"
            disabled={disabled}
            onClick={resource.reload}
          >
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
