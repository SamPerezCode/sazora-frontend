import { Empty, Metrics, Notice, Panel } from "./ReportUI";

import { amount, number } from "../utils/reports.format";

import type { PublicMenuConversionReport } from "../schemas/reports.schema";

import "../public-menu-conversion.css";

export function PublicMenuConversion({
  data,
}: {
  data: PublicMenuConversionReport;
}) {
  const { counts, rates, amounts } = data;

  const steps = [
    [
      "Solicitudes recibidas",
      counts.receivedRequests,
      counts.receivedRequests ? "100" : "0",
    ],
    ["Contactadas", counts.contactedRequests, rates.contactRate],
    ["Aceptadas", counts.acceptedRequests, rates.acceptanceRate],
    ["Pago verificado", counts.paidOrders, rates.paymentRate],
    ["Confirmadas", counts.confirmedOrders, rates.confirmationRate],
    ["Entregadas", counts.deliveredOrders, rates.deliveryRate],
    ["Convertidas en venta", counts.completedSales, rates.saleRate],
  ] as const;

  return (
    <section className="pm-conversion">
      <div>
        <h2>Conversión del menú público</h2>

        <p className="rp-muted">
          Seguimiento de las solicitudes recibidas desde el menú
          público hasta su conversión en venta.
        </p>
      </div>

      <Notice>
        Las métricas parten de las solicitudes creadas en el período
        seleccionado, según la zona horaria {data.period.timezone}.
      </Notice>

      {!counts.receivedRequests ? (
        <Empty>
          No hay solicitudes del menú público en este período. Prueba
          con otro rango de fechas.
        </Empty>
      ) : (
        <>
          <Panel title="Embudo de conversión">
            <p className="rp-muted">
              Cantidad y porcentaje respecto de solicitudes recibidas.
            </p>

            <ol className="pm-funnel">
              {steps.map(([label, value, rate], index) => (
                <li key={label}>
                  <div>
                    <span>
                      {index + 1}. {label}
                    </span>

                    <strong>
                      {number(value)}
                      {" · "}
                      {rate.replace(".", ",")} %
                    </strong>
                  </div>

                  <div className="pm-track" aria-hidden="true">
                    <span style={{ width: rate + "%" }} />
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Metrics
            items={[
              {
                label: "Solicitudes rechazadas",
                value: number(counts.rejectedRequests),
              },
              {
                label: "Ventas anuladas",
                value: number(counts.voidedSales),
              },
              {
                label: "Clientes identificados",
                value: number(counts.identifiedCustomers),
              },
            ]}
          />

          <Metrics
            items={[
              {
                label: "Ventas brutas",
                value: amount(
                  amounts.grossSalesTotal,
                  data.business.currencyCode
                ),
              },
              {
                label: "Devoluciones",
                value: amount(
                  amounts.refundedTotal,
                  data.business.currencyCode
                ),
              },
              {
                label: "Ventas efectivas",
                value: amount(
                  amounts.effectiveSalesTotal,
                  data.business.currencyCode
                ),
              },
            ]}
          />

          <Notice>
            Ventas efectivas: ventas no anuladas menos devoluciones.
            Este importe no representa utilidad ni ganancia.
          </Notice>
        </>
      )}
    </section>
  );
}
