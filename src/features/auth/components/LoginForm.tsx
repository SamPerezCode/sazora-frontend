import { ArrowRight, Mail, Store } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { Checkbox } from "../../../components/forms/Checkbox";
import { PasswordField } from "../../../components/forms/PasswordField";
import { TextField } from "../../../components/forms/TextField";
import { Button } from "../../../components/ui/Button";
import { useLoginForm } from "../hooks/useLoginForm";

export function LoginForm() {
  const {
    values,
    errors,
    message,
    remember,
    submitting,
    setField,
    setRememberBusiness,
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
        <legend className="sr-only">
          Credenciales del establecimiento
        </legend>

        <TextField
          name="businessSlug"
          label="Espacio de trabajo"
          placeholder="nombre-del-restaurante"
          icon={Store}
          value={values.businessSlug}
          onChange={(event) =>
            setField("businessSlug", event.currentTarget.value)
          }
          error={errors.businessSlug}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />

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

        <Checkbox
          name="rememberBusiness"
          label="Recordar restaurante"
          checked={remember}
          onChange={(event) =>
            setRememberBusiness(event.currentTarget.checked)
          }
          disabled={submitting}
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
