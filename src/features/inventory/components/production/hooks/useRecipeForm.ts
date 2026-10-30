import { useCallback, useState } from "react";
import { useAppShell } from "../../../../../app/layout/shell-context";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../hooks/useInventoryQuery";
import {
  add,
  divide,
  fixed,
  multiply,
  quantity3,
  subtract,
} from "../../../utils/inventory-value";
import { productionBalances } from "../services/production.catalog";
import {
  loadRecipeItems,
  saveRecipe,
} from "../services/recipe.service";
import {
  recipePayloadSchema,
  type Recipe,
  type RecipeItem,
  type RecipePayload,
} from "../schemas/recipe.schemas";
import {
  positiveQuantity,
  allocationSchema,
} from "../schemas/production.schemas";
import { emptyQuickLine, errorText } from "../utils/production.utils";
import type { QuickLine } from "../types/production.types";
import { useRecipeMutation } from "./useRecipeMutation";

type Group = "inputs" | "outputs";

interface Props {
  recipe?: Recipe;
  locationId: string;
  onSaved: (recipe: Recipe) => void;
  onClose: () => void;
}

export function useRecipeForm({
  recipe,
  locationId,
  onSaved,
  onClose,
}: Props) {
  const { session } = useAppShell();
  const mutation = useRecipeMutation(onSaved);

  const [form, setForm] = useState(() => ({
    code: recipe?.code ?? "",
    name: recipe?.name ?? "",
    notes: recipe?.notes ?? "",

    inputs: recipe?.inputs.map((line) => ({
      ...emptyQuickLine(),
      inventoryItemId: line.inventoryItemId,
      quantity: quantity3(line.quantity),
      notes: line.notes ?? "",
    })) ?? [emptyQuickLine()],

    outputs: recipe?.outputs.map((line) => ({
      ...emptyQuickLine(line.costAllocationPercentage),
      inventoryItemId: line.inventoryItemId,
      quantity: quantity3(line.quantity),
      notes: line.notes ?? "",
    })) ?? [emptyQuickLine("100")],
  }));

  const [initial] = useState(() => JSON.stringify(form));
  const [discard, setDiscard] = useState(false);

  const [review, setReview] = useState<{
    body: RecipePayload;
    recipe: Pick<Recipe, "notes" | "inputs" | "outputs">;
  } | null>(null);

  const catalog = useInventoryQuery("recipe-items", loadRecipeItems);

  const balanceLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      locationId
        ? productionBalances(current, signal, locationId)
        : Promise.resolve(null),
    [locationId]
  );

  const balances = useInventoryQuery(
    "recipe-balances:" + locationId,
    balanceLoader
  );

  const allLines = [...form.inputs, ...form.outputs];
  const items = [...(catalog.data ?? [])];

  for (const line of [
    ...(recipe?.inputs ?? []),
    ...(recipe?.outputs ?? []),
  ]) {
    if (!items.some((item) => item.id === line.inventoryItemId)) {
      items.push({
        id: line.inventoryItemId,
        businessId: recipe!.businessId,
        name: line.inventoryItemName,
        sku: line.inventoryItemSku,
        baseUnit: line.baseUnit,
        isActive: false,
      });
    }
  }

  const itemFor = (line: QuickLine): RecipeItem | undefined =>
    items.find((item) => item.id === line.inventoryItemId);

  const balanceFor = (line: QuickLine) =>
    balances.data?.find(
      (row) => row.inventoryItemId === line.inventoryItemId
    );

  const percentagesValid = form.outputs.every(
    (line) =>
      allocationSchema.safeParse(line.costAllocationPercentage)
        .success
  );

  const distribution = percentagesValid
    ? add(
        ...form.outputs.map((line) => line.costAllocationPercentage)
      )
    : null;

  const inputCosts = form.inputs.map((line) => {
    const balance = balanceFor(line);

    return locationId &&
      !balances.pending &&
      !balances.error &&
      positiveQuantity.safeParse(line.quantity).success &&
      balance?.valuationStatus === "VALUED" &&
      balance.averageUnitCost !== null
      ? multiply(line.quantity, balance.averageUnitCost)
      : null;
  });

  const totalCost = inputCosts.every((value) => value !== null)
    ? add(...(inputCosts as string[]))
    : null;

  const outputCosts = form.outputs.reduce<
    { value: string | null; rate: string | null }[]
  >((costs, line, index) => {
    const value =
      totalCost !== null &&
      distribution !== null &&
      fixed(distribution) === fixed("100")
        ? index === form.outputs.length - 1
          ? subtract(
              totalCost,
              add(...costs.map((row) => row.value ?? "0"))
            )
          : divide(
              multiply(totalCost, line.costAllocationPercentage),
              "100"
            )
        : null;

    return [
      ...costs,
      {
        value,
        rate:
          value !== null &&
          positiveQuantity.safeParse(line.quantity).success
            ? divide(value, line.quantity)
            : null,
      },
    ];
  }, []);

  function update(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
    mutation.setError("");
    setReview(null);
  }

  function updateLine(
    group: Group,
    key: string,
    patch: Partial<QuickLine>
  ) {
    update({
      [group]: form[group].map((line) =>
        line.key === key ? { ...line, ...patch } : line
      ),
    });
  }

  function addLine(group: Group) {
    if (form[group].length >= 100) return;

    const lines =
      group === "outputs" && form.outputs.length === 1
        ? form.outputs.map((line) => ({
            ...line,
            costAllocationPercentage: "",
          }))
        : form[group];

    update({ [group]: [...lines, emptyQuickLine()] });
  }

  function removeLine(group: Group, key: string) {
    if (form[group].length === 1) return;

    let lines = form[group].filter((line) => line.key !== key);

    if (group === "outputs" && lines.length === 1) {
      lines = lines.map((line) => ({
        ...line,
        costAllocationPercentage: "100",
      }));
    }

    update({ [group]: lines });
  }

  function close() {
    if (mutation.busy) return;

    if (!mutation.locked && JSON.stringify(form) !== initial) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  function next() {
    try {
      if (catalog.pending || catalog.error || !catalog.data) {
        throw new Error("Espera a que se cargue el catálogo.");
      }

      const catalogItems = catalog.data;

      const linePayload = (line: QuickLine) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity.replace(",", "."),
        notes: line.notes.trim() || null,
      });

      const body = recipePayloadSchema.parse({
        code: form.code,
        name: form.name,
        notes: form.notes.trim() || null,
        inputs: form.inputs.map(linePayload),
        outputs: form.outputs.map((line) => ({
          ...linePayload(line),
          costAllocationPercentage:
            form.outputs.length === 1
              ? "100"
              : line.costAllocationPercentage.replace(",", "."),
        })),
      });

      if (
        allLines.some(
          (line) =>
            !catalogItems.some(
              (item) =>
                item.id === line.inventoryItemId && item.isActive
            )
        )
      ) {
        throw new Error(
          "Sustituye los artículos inactivos o no disponibles."
        );
      }

      const display = (
        line: RecipePayload["inputs"][number],
        index: number
      ) => {
        const item = catalogItems.find(
          (item) => item.id === line.inventoryItemId
        )!;

        return {
          ...line,
          id: String(index),
          inventoryItemName: item.name,
          inventoryItemSku: item.sku,
          baseUnit: item.baseUnit,
        };
      };

      mutation.setError("");

      setReview({
        body,
        recipe: {
          notes: body.notes,
          inputs: body.inputs.map(display),
          outputs: body.outputs.map((line, index) => ({
            ...display(line, index),
            costAllocationPercentage: line.costAllocationPercentage,
          })),
        },
      });
    } catch (caught) {
      mutation.setError(errorText(caught));
    }
  }

  async function submit() {
    if (!review) return;

    await mutation.run((signal) =>
      saveRecipe(session, signal, recipe?.id ?? null, review.body)
    );
  }

  return {
    form,
    update,
    updateLine,
    addLine,
    removeLine,
    allLines,
    items,
    itemFor,
    balanceFor,
    inputCosts,
    outputCosts,
    distribution,
    catalog,
    balances,
    review,
    setReview,
    discard,
    setDiscard,
    mutation,
    close,
    next,
    submit,
  };
}

export type RecipeFormModel = ReturnType<typeof useRecipeForm>;
