import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { useAppShell } from "../../../app/layout/shell-context";
import { Button } from "../../../components/ui/Button";
import { hasPermission } from "../../auth/utils/permissions";
import { useCashResource } from "../../cash/hooks/useCashResource";
import { FinancialSalesList } from "../components/FinancialSalesList";
import { FinancialSaleDetail } from "../components/FinancialSaleDetail";
import { financialLocations } from "../services/financial-sales.service";

import "../public-orders.css";
import "../financial-sales.css";

function FinancialSalesWorkspace() {
  const { session } = useAppShell();
  const [params, setParams] = useSearchParams();
  const id = params.get("venta");

  const loader = useCallback(
    (signal: AbortSignal) => financialLocations(session, signal),
    [session]
  );

  const resource = useCashResource(loader);

  function select(value: string | null) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);

      if (value) {
        next.set("venta", value);
      } else {
        next.delete("venta");
      }

      return next;
    });
  }

  if (id) {
    if (!/^[1-9]\d*$/.test(id)) {
      return (
        <div className="por-page">
          <p role="alert">El identificador de venta no es válido.</p>
          <Button onClick={() => select(null)}>
            Regresar al historial
          </Button>
        </div>
      );
    }

    return (
      <FinancialSaleDetail
        key={id}
        id={id}
        back={() => select(null)}
      />
    );
  }

  if (resource.loading) {
    return <p role="status">Cargando ubicaciones…</p>;
  }

  if (resource.error) {
    return (
      <div className="por-page">
        <p role="alert">{resource.error}</p>
        <Button onClick={resource.reload}>Reintentar</Button>
      </div>
    );
  }

  if (
    !session.authorization.locationAccess.hasGlobalAccess &&
    !resource.data?.length
  ) {
    return (
      <p role="alert">
        No tienes ubicaciones habilitadas para consultar ventas.
      </p>
    );
  }

  return (
    <FinancialSalesList
      locations={resource.data ?? []}
      open={select}
    />
  );
}

export function FinancialSalesPage() {
  const { session } = useAppShell();

  if (!hasPermission(session, "orders.read")) {
    return (
      <p role="alert">No tienes permiso para consultar ventas.</p>
    );
  }

  const scope = JSON.stringify([
    session.business.id,
    session.membership.id,
    session.accessToken,
    session.authorization.permissions,
    session.authorization.locationAccess,
  ]);

  return <FinancialSalesWorkspace key={scope} />;
}
