import { ArrowUpRight } from "lucide-react";
import { ThemeToggleButton } from "../../components/ui/ThemeToggleButton";
import type { AuthSession } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/business-profile.schema";
import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  title: string;
  subtitle: string;
  session: AuthSession;
  business: BusinessIdentity;
  showCashAction?: boolean;
  onLogout: () => void;
}

export function AppHeader({
  title,
  subtitle,
  session,
  business,
  showCashAction = false,
  onLogout,
}: AppHeaderProps) {
  const canOpenCash =
    showCashAction && session.authorization.roles.includes("ADMIN");

  return (
    <header className="shell-header">
      <div className="shell-header-copy">
        <h1 title={title}>{title}</h1>
        <p title={subtitle}>{subtitle}</p>
      </div>

      <div className="shell-header-actions">
        {canOpenCash && (
          <button
            type="button"
            disabled
            className="shell-cash-button"
            title="La apertura de caja aún no está disponible"
          >
            Abrir caja
            <ArrowUpRight
              aria-hidden="true"
              size={14}
              strokeWidth={1.75}
            />
          </button>
        )}

        <ThemeToggleButton variant="shell" />

        <UserMenu
          session={session}
          business={business}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
