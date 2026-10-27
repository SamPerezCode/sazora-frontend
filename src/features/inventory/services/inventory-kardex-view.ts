import type { AuthSession } from "../../auth/types/auth.types";
import { loadKardex } from "./inventory-audit.service";
import type { KardexFilters } from "./inventory-audit.service";
import { loadPurchaseRows } from "./inventory-location.service";
import { add } from "../utils/inventory-value";

type Entry = Awaited<
  ReturnType<typeof loadKardex>
>["entries"][number];

type Filters = Pick<
  KardexFilters,
  "from" | "to" | "locationId" | "inventoryItemId"
>;

const sumKnown = (values: (string | null)[]) =>
  values.some((value) => value === null)
    ? null
    : values.reduce<string>(
        (total, value) => add(total, value!),
        "0"
      );

export function summarizeKardex(entries: Entry[]) {
  const groups = new Map<string, { first: Entry; last: Entry }>();

  // La API ordena por fecha, movimiento y línea descendentes.
  for (const entry of [...entries].reverse()) {
    const key = entry.inventoryItemId + ":" + entry.location?.id;

    const group = groups.get(key);

    groups.set(key, {
      first: group?.first ?? entry,
      last: entry,
    });
  }

  const balancesKnown =
    entries.length > 0 &&
    entries.every(
      (entry) =>
        entry.location !== null && entry.costStatus === "VALUED"
    );

  const boundaries = [...groups.values()];

  const total = (direction: Entry["direction"]) =>
    sumKnown(
      entries
        .filter((entry) => entry.direction === direction)
        .map((entry) =>
          entry.costStatus === "VALUED" ? entry.totalCost : null
        )
    );

  return {
    initial: balancesKnown
      ? sumKnown(
          boundaries.map(({ first }) => first.inventoryValueBefore)
        )
      : null,

    incoming: total("IN"),
    outgoing: total("OUT"),

    final: balancesKnown
      ? sumKnown(
          boundaries.map(({ last }) => last.inventoryValueAfter)
        )
      : null,
  };
}

async function loadAllEntries(
  session: AuthSession,
  signal: AbortSignal,
  filters: Filters
) {
  const entries = new Map<string, Entry>();
  let expected = -1;

  for (let page = 1; ; page++) {
    signal.throwIfAborted();

    const report = await loadKardex(session, signal, {
      ...filters,
      movementType: "",
      page,
      pageSize: 100,
    });

    if (expected !== -1 && expected !== report.pagination.total) {
      throw new Error(
        "El kardex cambió durante la consulta. Reintenta."
      );
    }

    expected = report.pagination.total;

    for (const entry of report.entries) {
      if (entries.has(entry.movementLineId)) {
        throw new Error(
          "El kardex cambió durante la consulta. Reintenta."
        );
      }

      entries.set(entry.movementLineId, entry);
    }

    if (page >= report.pagination.totalPages) break;

    if (!report.entries.length) {
      throw new Error(
        "No se pudo obtener el kardex completo. Reintenta."
      );
    }
  }

  if (entries.size !== expected) {
    throw new Error(
      "No se pudo obtener el kardex completo. Reintenta."
    );
  }

  return [...entries.values()];
}

export async function loadKardexView(
  session: AuthSession,
  signal: AbortSignal,
  filters: Filters
) {
  const [entries, purchases] = await Promise.all([
    loadAllEntries(session, signal, filters),
    loadPurchaseRows(session, signal, filters),
  ]);

  signal.throwIfAborted();

  return {
    entries,
    purchases,
    summary: summarizeKardex(entries),
  };
}
