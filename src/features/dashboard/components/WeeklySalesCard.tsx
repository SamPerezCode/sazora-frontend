import { useId, useState } from "react";
import { Card } from "../../../components/ui/Card";
import type { WeeklySale } from "../types/dashboard.types";
import {
  businessDate,
  money,
  sumAmounts,
  WEEKDAYS,
} from "../utils/dashboard-format";

interface WeeklySalesCardProps {
  sales: readonly WeeklySale[];
  currency: string;
}

export function WeeklySalesCard({
  sales,
  currency,
}: WeeklySalesCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();

  const days = [...sales].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const maximum = Math.max(
    0,
    ...days.map((day) => Number(day.total))
  );

  return (
    <Card aria-label="Ventas de la semana">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-heading">
            Ventas de la semana
          </h2>

          <p className="mt-1 text-xs text-muted">
            Total{" "}
            {money(
              sumAmounts(days.map((day) => day.total)),
              currency
            )}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={showDetails}
          aria-controls={detailsId}
          onClick={() => setShowDetails((value) => !value)}
          className="min-h-11 shrink-0 cursor-pointer text-xs font-medium text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          {showDetails ? "Ocultar detalle" : "Ver detalle"}
        </button>
      </div>

      <figure className="mt-5">
        <figcaption className="sr-only">
          Ventas por día de la semana
        </figcaption>

        <ol className="dashboard-chart">
          {days.map((day) => (
            <li key={day.date} className="dashboard-chart-column">
              <span className="sr-only">
                {businessDate(day.date)}: {money(day.total, currency)}
              </span>

              <div
                className="dashboard-chart-track"
                aria-hidden="true"
              >
                <div
                  className="dashboard-chart-bar"
                  title={money(day.total, currency)}
                  style={{
                    height: `${
                      maximum > 0
                        ? (Math.max(0, Number(day.total)) / maximum) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <span
                aria-hidden="true"
                className="text-[0.6875rem] text-muted"
              >
                {WEEKDAYS[day.weekday]}
              </span>
            </li>
          ))}
        </ol>

        {maximum === 0 && (
          <p className="mt-3 text-center text-xs text-muted">
            No hay ventas registradas esta semana.
          </p>
        )}
      </figure>

      <div
        id={detailsId}
        hidden={!showDetails}
        className="mt-5 overflow-x-auto"
      >
        <table className="w-full text-left text-xs">
          <caption className="sr-only">
            Detalle de ventas diarias
          </caption>

          <thead>
            <tr className="border-b border-outline">
              <th scope="col" className="py-2">
                Día
              </th>
              <th scope="col" className="py-2 text-right">
                Ventas
              </th>
            </tr>
          </thead>

          <tbody>
            {days.map((day) => (
              <tr
                key={day.date}
                className="border-b border-outline/50"
              >
                <th scope="row" className="py-2 font-normal">
                  {businessDate(day.date)}
                </th>
                <td className="py-2 text-right tabular-nums">
                  {money(day.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
