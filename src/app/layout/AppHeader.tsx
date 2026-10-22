import { ArrowUpRight } from "lucide-react";
import { ThemeToggleButton } from "../../components/ui/ThemeToggleButton";
import type { AuthSession } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/schemas/business-profile.schema";
import { UserMenu } from "./UserMenu";
import { MobileNavigation } from "./MobileNavigation";

interface AppHeaderProps {
  title: string;
  subtitle: string;
  session: AuthSession;
  business: BusinessIdentity;
  operatingLocation?: {
    name: string;
    code: string;
  };
  showCashAction?: boolean;
  onLogout: () => void;
}

export function AppHeader({
  title,
  subtitle,
  session,
  business,
  operatingLocation,
  showCashAction = false,
  onLogout,
}: AppHeaderProps) {
  const canOpenCash =
    showCashAction && session.authorization.roles.includes("ADMIN");

  return (
    <header className="shell-header">
      <MobileNavigation
        session={session}
        business={business}
        onLogout={onLogout}
      />

      <div className="shell-header-copy">
        <h1 title={title}>{title}</h1>

        {operatingLocation ? (
          <p
            className="flex min-w-0 items-center gap-1.5"
            title={`${operatingLocation.name} · ${operatingLocation.code}`}
          >
            <span className="min-w-0 truncate">
              {operatingLocation.name}
            </span>

            <span className="shrink-0">
              · {operatingLocation.code}
            </span>
          </p>
        ) : (
          <p title={subtitle}>{subtitle}</p>
        )}
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
