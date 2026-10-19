import type { AuthSession } from "../../auth/types/auth.types";
import { loadActivity, loadKardex } from "./inventory-audit.service";
import { dayKey } from "../utils/inventory-format";
import { decimal, fixed } from "../utils/inventory-value";

type Entry = Awaited<
  ReturnType<typeof loadKardex>
>["entries"][number];

export function movementAmounts(lines: Entry[]) {
  if (
    !lines.length ||
    lines.some(
      (line) =>
        line.totalCost === null || line.costStatus !== "VALUED"
    )
  ) {
    return {
      incoming: null,
      outgoing: null,
      impact: null,
    };
  }

  let incoming = 0n;
  let outgoing = 0n;

  for (const line of lines) {
    if (line.direction === "IN") {
      incoming += fixed(line.totalCost!);
    } else {
      outgoing += fixed(line.totalCost!);
    }
  }

  return {
    incoming: decimal(incoming),
    outgoing: decimal(outgoing),
    impact: decimal(incoming - outgoing),
  };
}

export async function loadInventoryPeriod(
  session: AuthSession,
  signal: AbortSignal,
  filters: {
    from: string;
    to: string;
    locationId: string;
  },
  timezone: string
) {
  const readPage = async (page: number) =>
    loadKardex(session, signal, {
      ...filters,
      page,
      pageSize: 100,
      inventoryItemId: "",
      movementType: "",
    });

  const [activity, first] = await Promise.all([
    loadActivity(session, signal, false),
    readPage(1),
  ]);

  const entries = [...first.entries];
  const { total, totalPages } = first.pagination;

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await readPage(page);

    if (
      result.pagination.total !== total ||
      result.pagination.totalPages !== totalPages ||
      result.pagination.page !== page
    ) {
      throw new Error(
        "El inventario cambió durante la consulta. Reintenta."
      );
    }

    entries.push(...result.entries);
  }

  if (
    entries.length !== total ||
    new Set(entries.map((entry) => entry.movementLineId)).size !==
      total
  ) {
    throw new Error(
      "No pudimos obtener el período completo. Reintenta."
    );
  }

  const movements = activity.filter(
    (row) =>
      !filters.locationId || row.location?.id === filters.locationId
  );

  const grouped = new Map<string, Entry[]>();

  for (const entry of entries) {
    const group = grouped.get(entry.movementId) ?? [];

    group.push(entry);
    grouped.set(entry.movementId, group);
  }

  const period = movements.filter((row) => {
    const day = dayKey(row.createdAt, timezone);

    return day >= filters.from && day <= filters.to;
  });

  const ids = new Set(period.map((row) => row.id));

  if (
    [...grouped.keys()].some((id) => !ids.has(id)) ||
    period.some(
      (row) => (grouped.get(row.id)?.length ?? 0) !== row.lineCount
    )
  ) {
    throw new Error(
      "Los movimientos cambiaron durante la consulta. Reintenta."
    );
  }

  const rows = period.map((row) => ({
    ...row,
    ...movementAmounts(grouped.get(row.id) ?? []),
  }));

  function totalFor(type: "PURCHASE" | "PRODUCTION") {
    let result = 0n;

    for (const row of rows.filter(
      (row) => row.movementType === type
    )) {
      const amount =
        type === "PURCHASE" ? row.incoming : row.outgoing;

      if (amount === null) return null;

      result += fixed(amount);
    }

    return decimal(result);
  }

  return {
    movements,
    purchases: totalFor("PURCHASE"),
    production: totalFor("PRODUCTION"),
    recent: rows
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          (BigInt(a.id) < BigInt(b.id) ? 1 : -1)
      )
      .slice(0, 5),
  };
}
