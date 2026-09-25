import { BrandLogo } from "../../../components/ui/BrandLogo";
import { ThemeToggleButton } from "../../../components/ui/ThemeToggleButton";
import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
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
          aria-labelledby="login-heading"
          className="login-card"
        >
          <p className="login-welcome">Bienvenido a Sazora</p>

          <h1 id="login-heading" className="login-title">
            Acceso
          </h1>

          <p className="login-subtitle">
            Ingresa las credenciales de tu establecimiento
          </p>

          <LoginForm />

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
