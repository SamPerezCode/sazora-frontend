import {
  amount as formatAmount,
  dateTime as formatDate,
} from "../../reports/utils/reports.format";

export function amount(value: string, currency: string | null) {
  return currency
    ? formatAmount(value, currency)
    : value + " (moneda no disponible)";
}

export function dateTime(value: string, timezone: string | null) {
  return timezone
    ? formatDate(value, timezone)
    : new Date(value).toISOString() + " (UTC)";
}
