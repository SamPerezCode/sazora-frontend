import { useEffect, useId, useRef, useState } from "react";
import {
  Building2,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import type { AuthSession } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/schemas/business-profile.schema";
import { ROLE_LABELS } from "../navigation";

interface UserMenuProps {
  session: AuthSession;
  business: BusinessIdentity;
  onLogout: () => void;
}

export function UserMenu({
  session,
  business,
  onLogout,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const panelId = useId();
  const nameId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="user-menu"
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        title="Perfil"
        aria-label={`Perfil de ${session.user.fullName}`}
        aria-expanded={open}
        aria-controls={panelId}
        className="profile-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar
          name={session.user.fullName}
          size="sm"
          variant="profile"
        />
      </button>

      <section
        id={panelId}
        hidden={!open}
        aria-labelledby={nameId}
        className="profile-panel"
      >
        <div className="profile-heading">
          <Avatar name={session.user.fullName} variant="profile" />

          <div className="min-w-0">
            <h2 id={nameId} className="profile-name">
              {session.user.fullName}
            </h2>

            <ul
              className="profile-roles"
              aria-label="Roles en este negocio"
            >
              {session.authorization.roles.map((role) => (
                <li key={role} title={ROLE_LABELS[role]}>
                  <ShieldCheck
                    aria-hidden="true"
                    size={12}
                    strokeWidth={1.75}
                  />
                  {role}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <dl className="profile-business">
          <div>
            <dt>
              <Building2
                aria-hidden="true"
                size={14}
                strokeWidth={1.75}
              />
              Negocio
            </dt>
            <dd>{business.name}</dd>
          </div>

          <div>
            <dt>
              <UserRound
                aria-hidden="true"
                size={14}
                strokeWidth={1.75}
              />
              Slug
            </dt>
            <dd className="profile-slug">{business.slug}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="profile-logout"
          onClick={() => {
            setOpen(false);
            onLogout();
          }}
        >
          <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}
