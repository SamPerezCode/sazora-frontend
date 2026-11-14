import {
  refundPaymentAmount,
  type Refund,
  type RefundSale,
  type RefundItemDraft,
  type RefundPaymentDraft,
  type RefundInput,
} from "../schemas/refund.schema";

const SCALE = 1000000n;

export function micros(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}

export function refundDecimal(value: bigint): string {
  return (
    (value / SCALE).toString() +
    "." +
    (value % SCALE)
      .toString()
      .padStart(6, "0")
      .replace(/0{1,4}$/, "")
  );
}

export function refundMoney(
  value: string | bigint | null,
  currency: string
): string {
  if (value === null) return "Sin valorar";

  const amount = typeof value === "bigint" ? value : micros(value);
  const parts = refundDecimal(amount).split(".");
  const fraction = parts[1].replace(/0+$/, "");

  const symbol =
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  return (
    symbol +
    " " +
    new Intl.NumberFormat("es-CO").format(BigInt(parts[0])) +
    (fraction ? "," + fraction : "")
  );
}

export function returnedQuantity(
  refunds: Refund[],
  id: string
): number {
  return refunds
    .flatMap((row) => row.items)
    .filter((row) => row.saleItemId === id)
    .reduce((sum, row) => sum + row.quantity, 0);
}

export function returnedPayment(
  refunds: Refund[],
  id: string
): bigint {
  return refunds
    .flatMap((row) => row.payments)
    .filter((row) => row.salePaymentId === id)
    .reduce((sum, row) => sum + micros(row.amount), 0n);
}

function allocate(
  original: bigint,
  returned: bigint,
  bought: number,
  available: number,
  quantity: number
) {
  return quantity === available
    ? original - returned
    : (original * BigInt(quantity)) / BigInt(bought);
}

export function refundPlan(
  sale: RefundSale,
  refunds: Refund[],
  drafts: RefundItemDraft[]
) {
  const items: RefundInput["items"] = [];

  let net = 0n;
  let tax = 0n;
  let cost: bigint | null = 0n;
  let error = "";

  for (const draft of drafts) {
    const quantity = Number(draft.quantity);

    if (
      !/^\d+$/.test(draft.quantity) ||
      !Number.isSafeInteger(quantity) ||
      quantity > 65535
    ) {
      error ||=
        "Revisa las cantidades: deben ser enteros entre 0 y 65535.";
      continue;
    }

    if (!quantity) continue;

    const item = sale.items.find(
      (row) => row.id === draft.saleItemId
    );

    if (!item) {
      error ||= "El producto no pertenece a esta venta.";
      continue;
    }

    const prior = refunds
      .flatMap((row) => row.items)
      .filter((row) => row.saleItemId === item.id);

    const available =
      item.quantity -
      prior.reduce((sum, row) => sum + row.quantity, 0);

    if (quantity > available) {
      error ||= "La cantidad supera las unidades disponibles.";
      continue;
    }

    const sum = (field: "netAmount" | "taxAmount" | "costAmount") =>
      prior.reduce(
        (total, row) => total + micros(row[field] ?? "0"),
        0n
      );

    net += allocate(
      micros(item.lineNetTotal),
      sum("netAmount"),
      item.quantity,
      available,
      quantity
    );

    tax += allocate(
      micros(item.lineTaxTotal),
      sum("taxAmount"),
      item.quantity,
      available,
      quantity
    );

    if (item.costTotal === null) {
      cost = null;
    } else if (cost !== null) {
      cost += allocate(
        micros(item.costTotal),
        sum("costAmount"),
        item.quantity,
        available,
        quantity
      );
    }

    items.push({
      saleItemId: item.id,
      quantity,
      restoreInventory: draft.restoreInventory,
    });
  }

  const total = net + tax;

  if (!items.length || items.length > 100) {
    error ||= "Selecciona entre 1 y 100 productos.";
  }

  if (total <= 0n) {
    error ||= "El importe a devolver debe ser mayor que cero.";
  }

  if (total % 10000n !== 0n) {
    error ||=
      "Este importe requiere corregir el cálculo de decimales en el servidor antes de continuar.";
  }

  return { items, net, tax, cost, total, error };
}

export function refundPayments(
  sale: RefundSale,
  refunds: Refund[],
  drafts: RefundPaymentDraft[],
  total: bigint
) {
  const payments: RefundInput["payments"] = [];

  let applied = 0n;
  let cash = 0n;
  let error = "";

  for (const draft of drafts) {
    if (
      !draft.amount.trim() ||
      /^0(?:\.0{1,2})?$/.test(draft.amount.trim())
    ) {
      continue;
    }

    const original = sale.payments.find(
      (row) => row.id === draft.salePaymentId
    );

    const parsed = refundPaymentAmount.safeParse(draft.amount);

    if (!original || !parsed.success) {
      error ||= "Revisa los valores de reembolso.";
      continue;
    }

    const amount = micros(parsed.data);
    const available =
      micros(original.amount) - returnedPayment(refunds, original.id);

    if (amount > available) {
      error ||=
        "Un reembolso supera el saldo disponible del pago original.";
    }

    if (original.requiresReference && !draft.reference.trim()) {
      error ||= "Completa la referencia obligatoria.";
    }

    if (
      draft.reference.trim().length > 120 ||
      draft.notes.trim().length > 500
    ) {
      error ||= "Revisa la longitud de la referencia y las notas.";
    }

    applied += amount;

    if (original.affectsCash) cash += amount;

    payments.push({
      salePaymentId: original.id,
      amount: parsed.data,
      reference: draft.reference.trim() || null,
      notes: draft.notes.trim() || null,
    });
  }

  if (!payments.length || payments.length > 20) {
    error ||= "Selecciona entre 1 y 20 pagos originales.";
  }

  if (applied !== total) {
    error ||=
      "Los reembolsos deben sumar exactamente el total calculado.";
  }

  return { payments, applied, cash, error };
}

export function refundSnapshot(sale: RefundSale, refunds: Refund[]) {
  return JSON.stringify([
    sale,
    [...refunds].sort((a, b) => a.id.localeCompare(b.id)),
  ]);
}
