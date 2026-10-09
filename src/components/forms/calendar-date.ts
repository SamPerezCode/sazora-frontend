export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(0);

  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function calendarKey(date: Date): string {
  const year = date.getUTCFullYear();

  if (year < 1 || year > 9999) return "";

  return [
    String(year).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function calendarToday(timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;

  return (
    part("year").padStart(4, "0") +
    "-" +
    part("month") +
    "-" +
    part("day")
  );
}

export function addCalendarDays(value: string, days: number): string {
  const date = parseCalendarDate(value);

  if (!date) return "";

  date.setUTCDate(date.getUTCDate() + days);

  return calendarKey(date);
}

export function addCalendarMonths(
  value: string,
  months: number
): string {
  const date = parseCalendarDate(value);

  if (!date) return "";

  const day = date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  const last = new Date(date);

  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);

  date.setUTCDate(Math.min(day, last.getUTCDate()));

  return calendarKey(date);
}
