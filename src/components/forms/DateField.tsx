import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarToday,
  parseCalendarDate,
} from "./calendar-date";

interface DateFieldProps {
  id?: string;
  name?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  timeZone?: string;
  disabled?: boolean;
  error?: string;
  hideLabel?: boolean;
  clearable?: boolean;
  className?: string;
}

export function DateField({
  id,
  name,
  label,
  value,
  onValueChange,
  min,
  max,
  timeZone,
  disabled = false,
  error,
  hideLabel = false,
  clearable = true,
  className = "",
}: DateFieldProps) {
  const generated = useId();
  const triggerId = id ?? generated;
  const panelId = generated + "-calendar";

  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusDay = useRef(false);

  const [open, setOpen] = useState(false);

  const [today, setToday] = useState(() => calendarToday(timeZone));

  const [cursor, setCursor] = useState(() =>
    parseCalendarDate(value) ? value : calendarToday(timeZone)
  );

  const [view, setView] = useState(() => cursor.slice(0, 7) + "-01");

  const lower = min && parseCalendarDate(min) ? min : "0001-01-01";

  const upper = max && parseCalendarDate(max) ? max : "9999-12-31";

  const unavailable = disabled || lower > upper;

  const month = view;
  const monthDate = parseCalendarDate(month)!;
  const start = (monthDate.getUTCDay() + 6) % 7;

  const cells = Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(month, index - start)
  );

  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate);

  const validValue = !!parseCalendarDate(value);

  const displayed = validValue
    ? value.split("-").reverse().join("/")
    : "dd/mm/aaaa";

  const message =
    error ||
    (value && (!validValue || value < lower || value > upper)
      ? "Selecciona una fecha dentro del rango permitido."
      : "");

  function close(restoreFocus = true) {
    panel.current?.hidePopover();

    if (restoreFocus) {
      trigger.current?.focus({
        preventScroll: true,
      });
    }
  }

  function move(next: string, focus = true) {
    if (!next) return;

    focusDay.current = focus;

    const clamped =
      next < lower ? lower : next > upper ? upper : next;

    setCursor(clamped);
    setView(clamped.slice(0, 7) + "-01");
  }

  function show() {
    if (unavailable) return;

    if (panel.current?.matches(":popover-open")) {
      close();
      return;
    }

    const currentToday = calendarToday(timeZone);

    setToday(currentToday);
    move(validValue ? value : currentToday);

    panel.current?.showPopover();
  }

  function select(next: string) {
    if (next && (next < lower || next > upper)) {
      return;
    }

    onValueChange(next);
    close();
  }

  useEffect(() => {
    if (unavailable) {
      panel.current?.hidePopover();
    }
  }, [unavailable]);

  useLayoutEffect(() => {
    if (!open) return;

    const button = trigger.current;
    const popup = panel.current;

    if (!button || !popup) return;

    function position(event?: Event) {
      if (!button || !popup) return;

      if (
        event?.target instanceof Node &&
        popup.contains(event.target)
      ) {
        return;
      }

      const viewport = window.visualViewport;

      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;

      const width = (viewport?.width ?? window.innerWidth) - 16;

      const bottom =
        top + (viewport?.height ?? window.innerHeight) - 16;

      const anchor = button.getBoundingClientRect();

      if (anchor.bottom < top || anchor.top > bottom) {
        popup.hidePopover();
        return;
      }

      popup.style.width = Math.min(320, width) + "px";
      popup.style.maxHeight = bottom - top + "px";

      const height = popup.getBoundingClientRect().height;

      const below = bottom - anchor.bottom - 6;
      const above = anchor.top - top - 6;

      const y =
        height > below && above > below
          ? anchor.top - height - 6
          : anchor.bottom + 6;

      popup.style.left =
        Math.max(
          left,
          Math.min(anchor.left, left + width - popup.offsetWidth)
        ) + "px";

      popup.style.top =
        Math.max(top, Math.min(y, bottom - height)) + "px";
    }

    position();

    if (focusDay.current) {
      popup
        .querySelector<HTMLButtonElement>(
          '[data-day="' + cursor + '"]'
        )
        ?.focus({
          preventScroll: true,
        });

      focusDay.current = false;
    }

    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);

    window.visualViewport?.addEventListener("resize", position);

    window.visualViewport?.addEventListener("scroll", position);

    return () => {
      window.removeEventListener("resize", position);

      document.removeEventListener("scroll", position, true);

      window.visualViewport?.removeEventListener("resize", position);

      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [open, cursor, view]);

  const previous = addCalendarMonths(month, -1);
  const next = addCalendarMonths(month, 1);

  return (
    <div
      className={"date-field " + className}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          close(false);
        }
      }}
    >
      <label
        htmlFor={triggerId}
        className={hideLabel ? "sr-only" : "date-field-label"}
      >
        {label}
      </label>

      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          disabled={disabled}
        />
      )}

      <button
        ref={trigger}
        id={triggerId}
        type="button"
        className="date-field-trigger"
        disabled={unavailable}
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-invalid={!!message}
        aria-describedby={message ? generated + "-error" : undefined}
      >
        <span data-placeholder={!value || undefined}>
          {displayed}
        </span>

        <CalendarDays size={16} aria-hidden="true" />
      </button>

      {message && (
        <p className="date-field-error" id={generated + "-error"}>
          {message}
        </p>
      )}

      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={"Elegir " + label}
        className="date-calendar"
        onToggle={(event) => setOpen(event.newState === "open")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <header className="date-calendar-heading">
          <button
            type="button"
            aria-label="Mes anterior"
            disabled={
              !previous || previous.slice(0, 7) < lower.slice(0, 7)
            }
            onClick={() => move(previous, false)}
          >
            <ChevronLeft size={18} />
          </button>

          <strong aria-live="polite">{monthLabel}</strong>

          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={!next || next.slice(0, 7) > upper.slice(0, 7)}
            onClick={() => move(next, false)}
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            aria-label="Cerrar calendario"
            className="date-calendar-close"
            onClick={() => close()}
          >
            <X size={17} />
          </button>
        </header>

        <p className="sr-only" id={generated + "-help"}>
          Flechas para cambiar de día. Inicio y Fin para cambiar
          dentro de la semana. Página anterior y siguiente para
          cambiar de mes; con Mayúsculas, de año.
        </p>

        <table
          role="grid"
          aria-label={monthLabel}
          aria-describedby={generated + "-help"}
          onKeyDown={(event) => {
            const target = event.target;

            if (
              !(target instanceof HTMLButtonElement) ||
              !target.dataset.day
            ) {
              return;
            }

            const day = target.dataset.day;

            const weekday =
              (parseCalendarDate(day)!.getUTCDay() + 6) % 7;

            const steps: Record<string, number> = {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -7,
              ArrowDown: 7,
              Home: -weekday,
              End: 6 - weekday,
            };

            let destination: string;

            if (event.key in steps) {
              destination = addCalendarDays(day, steps[event.key]);
            } else if (
              event.key === "PageUp" ||
              event.key === "PageDown"
            ) {
              destination = addCalendarMonths(
                day,
                (event.key === "PageUp" ? -1 : 1) *
                  (event.shiftKey ? 12 : 1)
              );
            } else {
              return;
            }

            event.preventDefault();
            event.stopPropagation();

            move(destination);
          }}
        >
          <thead>
            <tr>
              {["L", "M", "X", "J", "V", "S", "D"].map(
                (day, index) => (
                  <th
                    key={index}
                    scope="col"
                    aria-label={
                      [
                        "Lunes",
                        "Martes",
                        "Miércoles",
                        "Jueves",
                        "Viernes",
                        "Sábado",
                        "Domingo",
                      ][index]
                    }
                  >
                    {day}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 6 }, (_, week) => (
              <tr key={week}>
                {cells
                  .slice(week * 7, week * 7 + 7)
                  .map((day, index) => (
                    <td
                      key={index}
                      aria-selected={!!day && value === day}
                    >
                      {day && (
                        <button
                          type="button"
                          data-day={day}
                          data-outside={
                            day.slice(0, 7) !== month.slice(0, 7) ||
                            undefined
                          }
                          data-selected={value === day || undefined}
                          aria-current={
                            day === today ? "date" : undefined
                          }
                          aria-label={new Intl.DateTimeFormat(
                            "es-CO",
                            {
                              dateStyle: "full",
                              timeZone: "UTC",
                            }
                          ).format(parseCalendarDate(day)!)}
                          disabled={day < lower || day > upper}
                          tabIndex={day === cursor ? 0 : -1}
                          onFocus={() => setCursor(day)}
                          onClick={() => select(day)}
                        >
                          {Number(day.slice(-2))}
                        </button>
                      )}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="date-calendar-footer">
          {clearable && (
            <button type="button" onClick={() => select("")}>
              Limpiar
            </button>
          )}

          <button
            type="button"
            disabled={today < lower || today > upper}
            onClick={() => select(today)}
          >
            Hoy
          </button>
        </footer>
      </div>
    </div>
  );
}
