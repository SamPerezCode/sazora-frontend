import type { Movement } from "../schemas/inventory-audit.schema";
import { add, divide, fixed, multiply } from "./inventory-value";
import { formatQuantity } from "./inventory-format";

export function valuedTotal(lines: Movement["lines"]): string | null {
  if (
    !lines.length ||
    lines.some(
      (line) =>
        line.costStatus !== "VALUED" || line.totalCost === null
    )
  ) {
    return null;
  }

  return add(...lines.map((line) => line.totalCost!));
}

export function allocationLabel(
  line: Movement["lines"][number],
  inputTotal: string | null
): string {
  if (
    inputTotal === null ||
    fixed(inputTotal) <= 0n ||
    line.costStatus !== "VALUED" ||
    line.totalCost === null
  ) {
    return "—";
  }

  return (
    formatQuantity(
      divide(multiply(line.totalCost, "100"), inputTotal)
    ) + " %"
  );
}
