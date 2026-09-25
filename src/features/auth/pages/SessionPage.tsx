import { LogOut } from "lucide-react";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { Button } from "../../../components/ui/Button";
import { ThemeToggleButton } from "../../../components/ui/ThemeToggleButton";
import { useAuth } from "../hooks/useAuth";

export function SessionPage() {
  const { state, logout } = useAuth();

  if (state.status !== "authenticated") {
    return null;
  }

  const { user, business } = state.session;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-start justify-between px-5 pt-5 sm:px-8">
        <BrandLogo />
        <ThemeToggleButton />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <section className="w-full max-w-md rounded-3xl border border-outline bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-heading">
            Bienvenido, {user.fullName}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            Has accedido a {business.name}.
          </p>

          <Button
            variant="secondary"
            onClick={logout}
            className="mt-6"
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={1.75} />
            Cerrar sesión
          </Button>
        </section>
      </main>
    </div>
  );
}
