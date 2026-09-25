import { useId, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

type PasswordFieldProps = Omit<
  TextFieldProps,
  "type" | "icon" | "action" | "trailing"
>;

export function PasswordField({
  id,
  disabled,
  ...props
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  const Icon = visible ? EyeOff : Eye;

  function toggleVisibility(): void {
    setVisible((current) => !current);
  }

  return (
    <TextField
      {...props}
      id={inputId}
      disabled={disabled}
      type={visible ? "text" : "password"}
      icon={LockKeyhole}
      action={
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-controls={inputId}
          onClick={toggleVisibility}
          className="cursor-pointer rounded text-[length:var(--field-label-size,0.6875rem)] font-semibold uppercase tracking-wider text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      }
      trailing={
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-controls={inputId}
          onClick={toggleVisibility}
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed"
        >
          <Icon
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
            className="size-[var(--field-icon-size,1rem)]"
          />{" "}
        </button>
      }
    />
  );
}
