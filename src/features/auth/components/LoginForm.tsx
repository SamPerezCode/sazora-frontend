import { ArrowRight, Mail } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { PasswordField } from "../../../components/forms/PasswordField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import { useLoginForm } from "../hooks/useLoginForm";

export function LoginForm() {
  const {
    values,
    errors,
    message,
    submitting,
    setField,
    handleSubmit,
  } = useLoginForm();

  return (
    <form
      noValidate
      aria-label="Inicio de sesión"
      aria-busy={submitting}
      onSubmit={handleSubmit}
      className="login-form"
    >
      {message && <Alert>{message}</Alert>}

      <fieldset disabled={submitting} className="login-fields">
        <legend className="sr-only">Credenciales de acceso</legend>

        <TextField
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="tu@restaurante.com"
          icon={Mail}
          value={values.email}
          onChange={(event) =>
            setField("email", event.currentTarget.value)
          }
          error={errors.email}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />

        <PasswordField
          name="password"
          label="Contraseña"
          value={values.password}
          onChange={(event) =>
            setField("password", event.currentTarget.value)
          }
          error={errors.password}
          autoComplete="current-password"
          disabled={submitting}
          required
        />
      </fieldset>

      <Button
        type="submit"
        loading={submitting}
        loadingText="Ingresando…"
        className="w-full"
      >
        Entrar a la plataforma
        <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
      </Button>
    </form>
  );
}
