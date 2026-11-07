import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Navigate } from "react-router";
import { ArrowLeft, ArrowRight, Layers } from "lucide-react";
import { Alert } from "../../../components/feedback/Alert";
import { Button } from "../../../components/ui/Button";
import { ThemeToggleButton } from "../../../components/ui/ThemeToggleButton";
import { ApiError } from "../../../lib/http/client";
import { useAuth } from "../hooks/useAuth";
import { getRolePresentation } from "../role-presentation";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import type {
  PendingRoleSelection,
  RoleChoice,
} from "../types/auth.types";
import "../role-selection.css";

export function RoleSelectionPage() {
  const { state } = useAuth();

  if (state.status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  if (state.status !== "selecting-role") {
    return <Navigate to="/login" replace />;
  }

  return (
    <RoleSelectionForm
      key={state.pending.expiresAt}
      pending={state.pending}
    />
  );
}

function RoleSelectionForm({
  pending,
}: {
  pending: PendingRoleSelection;
}) {
  const { selectRole, cancelRoleSelection } = useAuth();

  const [choice, setChoice] = useState<RoleChoice>({
    mode: "ALL_ROLES",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const sending = useRef(false);
  const mounted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    mounted.current = true;
    heading.current?.focus();

    return () => {
      mounted.current = false;
    };
  }, []);

  const options = [
    {
      value: "ALL_ROLES",
      choice: { mode: "ALL_ROLES" } as RoleChoice,
      label: "Todos mis roles",
      description:
        "Ingresa con los permisos combinados de tus roles asignados.",
      icon: Layers,
    },
    ...[...new Set(pending.membership.roles)].map((role) => ({
      value: "ROLE:" + role,
      choice: {
        mode: "SINGLE_ROLE",
        role,
      } as RoleChoice,
      ...getRolePresentation(role),
    })),
  ];

  const selectedValue =
    choice.mode === "ALL_ROLES" ? "ALL_ROLES" : "ROLE:" + choice.role;

  const validChoice =
    choice.mode === "ALL_ROLES" ||
    pending.membership.roles.includes(choice.role);

  async function submit(
    event: SubmitEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (sending.current || !validChoice) return;

    sending.current = true;
    setSubmitting(true);
    setMessage("");

    try {
      await selectRole(choice);
    } catch (error: unknown) {
      if (mounted.current) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "No pudimos completar el acceso. Intenta nuevamente."
        );
      }
    } finally {
      sending.current = false;

      if (mounted.current) {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="auth-background login-page">
      <header className="login-header">
        <div className="login-brand">
          <BrandLogo className="login-brand-image" />
        </div>

        <ThemeToggleButton />
      </header>

      <main className="login-main">
        <section
          aria-labelledby="brand-heading"
          className="login-intro"
        >
          <p className="login-tagline">
            Operación gastronómica, conectada
          </p>

          <h2 id="brand-heading" className="login-intro-title">
            Bienvenido a<span>SAZORA</span>
          </h2>

          <p className="login-intro-description">
            El mejor espacio para administrar la operación de tu
            restaurante.
          </p>
        </section>
        <section
          className="login-card role-selection-card"
          aria-labelledby="role-selection-heading"
        >
          <h1
            ref={heading}
            tabIndex={-1}
            id="role-selection-heading"
            className="login-title"
          >
            Acceso
          </h1>

          <p className="login-subtitle">
            Ingresa las credenciales de tu establecimiento
          </p>

          <form
            className="role-selection-form"
            onSubmit={submit}
            aria-busy={submitting}
          >
            <fieldset
              disabled={submitting}
              className="role-selection-options"
            >
              <legend className="role-selection-legend">
                <span>Tienes varios roles asignados</span>
                <span>¿Con cuál deseas iniciar sesión?</span>
              </legend>

              {options.map((option) => {
                const Icon = option.icon;
                const checked = selectedValue === option.value;

                return (
                  <label
                    key={option.value}
                    className="role-selection-option"
                  >
                    <input
                      type="radio"
                      name="session-role"
                      value={option.value}
                      checked={checked}
                      onChange={() => {
                        setChoice(option.choice);
                        setMessage("");
                      }}
                    />

                    <span className="role-selection-option-body">
                      <span className="role-selection-icon">
                        <Icon size={20} aria-hidden="true" />
                      </span>

                      <span className="role-selection-copy">
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {message && <Alert>{message}</Alert>}

            <Button
              type="submit"
              className="role-selection-submit"
              loading={submitting}
              loadingText="Ingresando…"
              disabled={!validChoice}
            >
              Continuar
              <ArrowRight size={18} aria-hidden="true" />
            </Button>

            <button
              type="button"
              className="role-selection-back"
              disabled={submitting}
              onClick={cancelRoleSelection}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Volver
            </button>
          </form>

          <p className="login-help">
            ¿No puedes entrar? Solicita acceso al administrador de tu
            restaurante.
          </p>
        </section>
      </main>

      <footer className="login-footer">
        Ventas · Cocina · Inventario · Equipo
      </footer>
    </div>
  );
}
