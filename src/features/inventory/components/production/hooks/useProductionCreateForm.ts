import {
  useId,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useAppShell } from "../../../../../app/layout/shell-context";
import { calendarToday } from "../../../../../components/forms/calendar-date";
import { ApiError } from "../../../../../lib/http/client";
import type { AuthSession } from "../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../hooks/useInventoryQuery";
import {
  add,
  multiply,
  fixed,
  subtract,
  divide,
  quantity3,
  quantity,
} from "../../../utils/inventory-value";
import {
  isAdmin,
  assignedPlant,
  productionRoles,
} from "../utils/production.access";
import {
  emptyQuickLine,
  plannedISO,
  errorText,
  percentage,
} from "../utils/production.utils";
import {
  loadCreationCatalog,
  productionBalances,
  getRecipe,
} from "../services/production.catalog";
import {
  positiveQuantity,
  allocationSchema,
  quickCreateSchema,
  createOrderSchema,
} from "../schemas/production.schemas";
import {
  registerQuickProduction,
  createDraftOrder,
} from "../services/production.mutations";
import type {
  QuickLine,
  ProductionCreateProps,
} from "../types/production.types";

export function useProductionCreateForm({
  kind,
  initialLocationId,
  zone,
  onClose,
  onOrderSaved,
  onQuickSaved,
  onRefresh,
}: ProductionCreateProps) {
  const { session } = useAppShell();
  const dialogId = useId();
  const quick = kind === "quick";

  const [form, setForm] = useState(() => ({
    locationId: isAdmin(session)
      ? initialLocationId
      : (assignedPlant(session)?.id ?? ""),
    recipeId: "",
    batch: "1",
    day: calendarToday(zone),
    notes: "",
    inputs: [emptyQuickLine()],
    outputs: [emptyQuickLine("100")],
  }));

  const [initial] = useState(() => JSON.stringify(form));
  const [step, setStep] = useState(1);
  const [discard, setDiscard] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const catalogLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      loadCreationCatalog(current, signal, kind),
    [kind]
  );

  const catalog = useInventoryQuery(
    "production-create:" + kind,
    catalogLoader,
    0,
    productionRoles
  );

  const balanceLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      form.locationId
        ? productionBalances(current, signal, form.locationId)
        : Promise.resolve(null),
    [form.locationId]
  );

  const balances = useInventoryQuery(
    "production-create-balances:" + form.locationId,
    balanceLoader,
    0,
    productionRoles
  );

  const recipeLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) =>
      !quick && form.recipeId
        ? getRecipe(current, signal, form.recipeId)
        : Promise.resolve(null),
    [quick, form.recipeId]
  );

  const recipeQuery = useInventoryQuery(
    "production-create-recipe:" + form.recipeId,
    recipeLoader,
    0,
    productionRoles
  );

  const recipe = recipeQuery.data;
  const pending =
    catalog.pending ||
    balances.pending ||
    (!quick && recipeQuery.pending);
  const readError =
    catalog.error ||
    balances.error ||
    (!quick ? recipeQuery.error : null);
  const batchValid = positiveQuantity.safeParse(form.batch).success;
  const allLines = [...form.inputs, ...form.outputs];

  const itemFor = (line: QuickLine) =>
    catalog.data?.items.find(
      (item) => item.id === line.inventoryItemId
    );

  const balanceFor = (itemId: string) =>
    balances.data?.find((row) => row.inventoryItemId === itemId);

  const percentagesValid = form.outputs.every(
    (line) =>
      allocationSchema.safeParse(line.costAllocationPercentage)
        .success
  );

  const distribution = percentagesValid
    ? form.outputs.reduce(
        (sum, line) => add(sum, line.costAllocationPercentage),
        "0"
      )
    : null;

  const lineCosts = form.inputs.map((line) => {
    const balance = balanceFor(line.inventoryItemId);

    return !balances.pending &&
      !balances.error &&
      positiveQuantity.safeParse(line.quantity).success &&
      balance?.valuationStatus === "VALUED" &&
      balance.averageUnitCost !== null
      ? multiply(line.quantity, balance.averageUnitCost)
      : null;
  });

  const totalCost = lineCosts.every((value) => value !== null)
    ? lineCosts.reduce<string>((sum, value) => add(sum, value!), "0")
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
              costs.reduce(
                (sum, row) => add(sum, row.value ?? "0"),
                "0"
              )
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

  const planned = (value: string) =>
    quantity3(multiply(value, form.batch));

  function top() {
    scroll.current?.scrollTo({ top: 0 });
  }

  function update(patch: Partial<typeof form>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setConfirmed(false);
    setError("");
  }

  function updateLine(
    group: "inputs" | "outputs",
    key: string,
    patch: Partial<QuickLine>
  ) {
    update({
      [group]: form[group].map((line) =>
        line.key === key ? { ...line, ...patch } : line
      ),
    });
  }

  function addLine(group: "inputs" | "outputs") {
    if (form[group].length >= 100) return;

    const existing =
      group === "outputs" && form.outputs.length === 1
        ? form.outputs.map((line) => ({
            ...line,
            costAllocationPercentage: "",
          }))
        : form[group];

    update({ [group]: [...existing, emptyQuickLine()] });
  }

  function removeLine(group: "inputs" | "outputs", key: string) {
    if (form[group].length === 1) return;

    let next = form[group].filter((line) => line.key !== key);

    if (group === "outputs" && next.length === 1) {
      next = next.map((line) => ({
        ...line,
        costAllocationPercentage: "100",
      }));
    }

    update({ [group]: next });
  }

  function close() {
    if (lock.current) return;

    if (!locked && JSON.stringify(form) !== initial) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  function validate() {
    if (pending || readError || !catalog.data) {
      throw new Error("Espera a que se carguen los datos.");
    }

    if (
      !catalog.data.plants.some(
        (plant) => plant.id === form.locationId
      )
    ) {
      throw new Error("Selecciona una planta habilitada.");
    }

    if (quick) {
      const body = quickCreateSchema.parse({
        locationId: form.locationId,
        notes: form.notes.trim() || null,
        inputs: form.inputs.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          notes: line.notes.trim() || null,
        })),
        outputs: form.outputs.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          costAllocationPercentage:
            form.outputs.length === 1
              ? "100.000000"
              : line.costAllocationPercentage,
          notes: line.notes.trim() || null,
        })),
      });

      for (const line of allLines) {
        if (!itemFor(line)) {
          throw new Error(
            "Selecciona artículos activos del catálogo."
          );
        }
      }

      for (const line of form.inputs) {
        const balance = balanceFor(line.inventoryItemId);

        if (
          balance &&
          fixed(line.quantity) > fixed(balance.currentStock)
        ) {
          const item = itemFor(line)!;

          throw new Error(
            item.name +
              ": la cantidad supera el stock disponible. " +
              "Disponible: " +
              quantity(balance.currentStock, item.baseUnit) +
              ". Solicitado: " +
              quantity(line.quantity, item.baseUnit) +
              "."
          );
        }
      }

      return { kind: "quick" as const, body };
    }

    const body = createOrderSchema.parse({
      recipeId: form.recipeId,
      locationId: form.locationId,
      batchQuantity: form.batch,
      plannedFor: plannedISO(form.day, zone, null),
      notes: form.notes.trim() || null,
    });

    if (!isAdmin(session)) {
      throw new Error("Solo ADMIN puede crear órdenes.");
    }

    if (
      !recipe?.isActive ||
      !catalog.data.recipes.some((row) => row.id === recipe.id)
    ) {
      throw new Error("Selecciona una receta activa.");
    }

    if (
      [...recipe.inputs, ...recipe.outputs].some(
        (line) => fixed(planned(line.quantity)) <= 0n
      )
    ) {
      throw new Error(
        "El lote produce una cantidad demasiado pequeña."
      );
    }

    return { kind: "order" as const, body };
  }

  function next() {
    try {
      validate();
      setError("");
      setConfirmed(false);
      setStep((value) => value + 1);
      top();
    } catch (caught) {
      setError(errorText(caught));
      top();
    }
  }

  async function submit() {
    if (lock.current || locked || (quick && !confirmed)) return;

    let payload: ReturnType<typeof validate>;

    try {
      payload = validate();
    } catch (caught) {
      setError(errorText(caught));
      top();
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();

    try {
      if (payload.kind === "quick") {
        const movement = await registerQuickProduction(
          session,
          controller.current.signal,
          payload.body
        );
        onQuickSaved(movement);
      } else {
        const order = await createDraftOrder(
          session,
          controller.current.signal,
          payload.body
        );
        onOrderSaved(order);
      }
    } catch (caught) {
      if (controller.current.signal.aborted) return;

      let message = errorText(caught);
      setConfirmed(false);

      if (
        caught instanceof ApiError &&
        (caught.status === 0 || caught.status >= 500)
      ) {
        setLocked(true);
        message +=
          "\nEl resultado no está confirmado. Revisa las órdenes o los movimientos antes de volver a registrar esta operación.";
        onRefresh();
      } else if (
        caught instanceof ApiError &&
        (caught.status === 401 || caught.status === 403)
      ) {
        setLocked(true);
      } else {
        setStep(1);

        if (
          caught instanceof ApiError &&
          (caught.status === 404 || caught.status === 409)
        ) {
          catalog.refresh();
          balances.refresh();
          recipeQuery.refresh();
          onRefresh();
        }
      }

      setError(message);
      top();
    } finally {
      lock.current = false;
      if (!controller.current?.signal.aborted) setBusy(false);
    }
  }

  const last = step === (quick ? 2 : 3);
  const controlClass =
    "h-9 w-full min-w-0 rounded-xl border border-outline bg-surface px-3 text-sm text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

  const reviewRows =
    quick && step === 2
      ? allLines.map((line, index) => {
          const item = itemFor(line);

          return {
            id: line.key,
            fields: [
              {
                label: "Artículo",
                value: item?.name ?? "Artículo no disponible",
              },
              {
                label: "Cantidad real",
                value: item
                  ? quantity(line.quantity, item.baseUnit)
                  : "—",
              },
              {
                label: "Asignación",
                value:
                  index < form.inputs.length
                    ? "Consumo"
                    : percentage(line.costAllocationPercentage),
              },
            ],
          };
        })
      : [];

  return {
    session,
    dialogId,
    quick,
    form,
    step,
    discard,
    confirmed,
    busy,
    locked,
    error,
    scroll,
    catalog,
    balances,
    recipeQuery,
    recipe,
    pending,
    readError,
    batchValid,
    allLines,
    itemFor,
    balanceFor,
    distribution,
    lineCosts,
    outputCosts,
    totalCost,
    planned,
    update,
    updateLine,
    addLine,
    removeLine,
    close,
    next,
    submit,
    last,
    controlClass,
    reviewRows,
    top,
    setStep,
    setDiscard,
    setConfirmed,
    setError,
  };
}

export type ProductionCreateModel = ReturnType<
  typeof useProductionCreateForm
>;
