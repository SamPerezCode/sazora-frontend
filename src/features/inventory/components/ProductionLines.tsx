import type { Production } from "../services/production.service";
import {
  formatQuantity,
  unitLabels,
} from "../utils/inventory-format";

export function ProductionLines({
  lines,
}: {
  lines: Production["lines"];
}) {
  return (
    <div className="production-columns">
      {(["OUT", "IN"] as const).map((direction) => (
        <section
          className="production-group"
          data-direction={direction}
          key={direction}
        >
          <h3>
            {direction === "OUT"
              ? "↗ Insumos consumidos"
              : "↙ Productos obtenidos"}
          </h3>

          {lines
            .filter((line) => line.direction === direction)
            .map((line) => (
              <article className="production-result" key={line.id}>
                <strong>{line.inventoryItemName}</strong>

                <div>
                  <strong data-direction={direction}>
                    {direction === "OUT" ? "−" : "+"}
                    {formatQuantity(line.quantity)}{" "}
                    {unitLabels[line.baseUnit]}
                  </strong>

                  <p className="inv-muted">
                    {formatQuantity(line.balanceBefore)}
                    {" → "}
                    {formatQuantity(line.balanceAfter)}
                  </p>
                </div>

                {line.notes && (
                  <p className="inv-muted production-line-note">
                    {line.notes}
                  </p>
                )}
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
