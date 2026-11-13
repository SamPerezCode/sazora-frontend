import { useAppShell } from "../../../app/layout/shell-context";
import { money } from "../../../lib/money";

export function usePresentation() {
  const shell = useAppShell();
  const zone = shell.settings.data?.timezone ?? "America/Bogota";
  const currency = shell.settings.data?.currencyCode ?? "COP";

  const date = (value: string) =>
    new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: zone,
    }).format(new Date(value));

  const day = (value: string) => {
    const parts = new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: zone,
    }).formatToParts(new Date(value));

    return ["year", "month", "day"]
      .map((name) => parts.find((part) => part.type === name)?.value)
      .join("-");
  };

  return {
    ...shell,
    date,
    day,
    zone,
    price: (value: string) => money(value, currency),
  };
}
