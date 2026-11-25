import type { SalesReportResponse } from "../schemas/reports.schema";

import { amount, number } from "../utils/reports.format";

import { Metrics, Notice } from "./ReportUI";

interface Props {
  data: SalesReportResponse["profitability"];
  currency: string;
}

export function SalesProfitability({ data, currency }: Props) {
  const money = (value: string | null) =>
    value === null ? "No disponible" : amount(value, currency);

  return (
    <section
      className="rp-profitability"
      aria-label="Resumen de rentabilidad"
    >
      <h2>Resumen de rentabilidad</h2>

      <p className="rp-muted">
        Basado en la fecha de venta y en ventas no anuladas. Los
        importes de ventas y devoluciones se muestran sin impuestos.
      </p>

      {data.unknownCostLineCount > 0 && (
        <Notice>
          {number(data.unknownCostLineCount)}{" "}
          {data.unknownCostLineCount === 1
            ? "línea tiene costo pendiente"
            : "líneas tienen costo pendiente"}
          . Esta falta de datos impide calcular la rentabilidad
          completa.
        </Notice>
      )}

      <Metrics
        items={[
          {
            label: "Ventas sin impuestos antes de devoluciones",
            value: money(data.netSalesBeforeRefunds),
          },
          {
            label: "Devoluciones sin impuestos",
            value: money(data.refundedNetAmount),
          },
          {
            label: "Ventas efectivas sin impuestos",
            value: money(data.effectiveNetSales),
          },
          {
            label: "Costo de productos vendidos",
            value: money(data.costOfGoodsSold),
          },
          {
            label: "Utilidad bruta",
            value: money(data.grossProfit),
          },
          {
            label: "Margen bruto",
            value:
              data.grossMarginPercentage === null
                ? "No disponible"
                : data.grossMarginPercentage.replace(".", ",") + " %",
          },
        ]}
      />
    </section>
  );
}
