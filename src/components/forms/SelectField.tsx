import { useId, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  id?: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  error?: string;
  describedBy?: string;
  hideLabel?: boolean;
  className?: string;
}

export function SelectField({
  id,
  label,
  value,
  options,
  onValueChange,
  placeholder = "Selecciona una opción",
  disabled = false,
  required = false,
  name,
  error,
  describedBy,
  hideLabel = false,
  className = "",
}: SelectFieldProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const trigger = useRef<HTMLButtonElement>(null);
  const ignoreClick = useRef(false);
  const [open, setOpen] = useState(false);

  const [container, setContainer] = useState<HTMLElement | null>(
    null
  );

  const selected = options.some((option) => option.value === value);

  const description =
    [describedBy, error ? `${triggerId}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={`select-field ${className}`}>
      <label
        htmlFor={triggerId}
        className={hideLabel ? "sr-only" : "select-field-label"}
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

      <Select.Root
        value={selected ? `value:${value}` : ""}
        onValueChange={(next: string) => {
          onValueChange(next.slice(6));
        }}
        disabled={disabled}
        required={required}
        open={open}
        onOpenChange={(nextOpen: boolean) => {
          if (nextOpen && disabled) return;

          if (nextOpen) {
            setContainer(
              trigger.current?.closest("dialog") ?? document.body
            );
          }

          setOpen(nextOpen);
        }}
      >
        <Select.Trigger
          ref={trigger}
          id={triggerId}
          className="select-field-trigger"
          aria-invalid={!!error}
          aria-describedby={description}
          style={open ? { pointerEvents: "auto" } : undefined}
          onPointerDown={(event) => {
            ignoreClick.current = false;

            if (open && event.button === 0 && !event.ctrlKey) {
              // Cierra y evita que Radix vuelva a abrirlo.
              event.preventDefault();
              ignoreClick.current = true;
              setOpen(false);
            }
          }}
          onClick={(event) => {
            // Evita la reapertura por el click posterior al pointerdown,
            // incluido el que generan los dispositivos táctiles.
            if (ignoreClick.current) {
              event.preventDefault();
              ignoreClick.current = false;
            }
          }}
          onKeyDown={() => {
            ignoreClick.current = false;
          }}
        >
          <Select.Value placeholder={placeholder} />

          <Select.Icon asChild>
            <ChevronDown aria-hidden="true" size={16} />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal container={container}>
          <Select.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className="select-field-content"
            onEscapeKeyDown={(event: KeyboardEvent) => {
              event.stopPropagation();
            }}
          >
            <Select.ScrollUpButton className="select-field-scroll">
              <ChevronUp aria-hidden="true" size={16} />
            </Select.ScrollUpButton>

            <Select.Viewport className="select-field-viewport">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={`value:${option.value}`}
                  disabled={option.disabled}
                  className="select-field-option"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>

                  <Select.ItemIndicator className="select-field-check">
                    <Check aria-hidden="true" size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}

              {options.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted">
                  Sin opciones
                </p>
              )}
            </Select.Viewport>

            <Select.ScrollDownButton className="select-field-scroll">
              <ChevronDown aria-hidden="true" size={16} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {error && (
        <p id={`${triggerId}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
