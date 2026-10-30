import { quantity } from "../../../../utils/inventory-value";
import { percentage } from "../../utils/production.utils";
import type { Recipe } from "../../schemas/recipe.schemas";
import { ProductionReviewRecords } from "../shared/ProductionReviewRecords";

export function RecipeContents({
  recipe,
}: {
  recipe: Pick<Recipe, "notes" | "inputs" | "outputs">;
}) {
  return (
    <div className="grid min-w-0 gap-5">
      <p className="whitespace-pre-wrap text-sm text-muted [overflow-wrap:anywhere]">
        {recipe.notes || "Sin notas"}
      </p>

      {(["inputs", "outputs"] as const).map((group) => (
        <section key={group} className="grid min-w-0 gap-4">
          <h3 className="text-sm font-semibold">
            {group === "inputs"
              ? "Insumos por lote"
              : "Resultados por lote"}
          </h3>

          <ProductionReviewRecords
            label={
              group === "inputs"
                ? "Insumos por lote"
                : "Resultados por lote"
            }
            rows={recipe[group].map((line) => ({
              id: line.id,
              fields: [
                {
                  label: "Artículo",
                  value: line.inventoryItemName,
                },
                {
                  label: "SKU",
                  value: line.inventoryItemSku || "—",
                },
                {
                  label:
                    group === "inputs"
                      ? "Cantidad estándar"
                      : "Cantidad esperada",
                  value: quantity(line.quantity, line.baseUnit),
                },
                ...("costAllocationPercentage" in line
                  ? [
                      {
                        label: "Asignación",
                        value: percentage(
                          line.costAllocationPercentage
                        ),
                      },
                    ]
                  : []),
                {
                  label: "Notas",
                  value: line.notes || "—",
                },
              ],
            }))}
          />
        </section>
      ))}
    </div>
  );
}
