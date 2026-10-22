import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type { AuthSession } from "../../features/auth/types/auth.types";
import type { BusinessIdentity } from "../../features/business/schemas/business-profile.schema";
import { AppSidebar } from "./AppSidebar";

interface MobileNavigationProps {
  session: AuthSession;
  business: BusinessIdentity;
  onLogout: () => void;
}

export function MobileNavigation({
  session,
  business,
  onLogout,
}: MobileNavigationProps) {
  const id = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const startedOutside = useRef(false);

  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    const dialog = dialogRef.current;

    if (!dialog?.open || timerRef.current !== null) return;

    // Si se cierra durante la apertura, continúa desde
    // su posición actual para evitar un salto.
    const panel = dialog.querySelector<HTMLElement>(
      ".shell-drawer-panel"
    );

    if (panel) {
      panel.style.setProperty(
        "--drawer-close-from",
        getComputedStyle(panel).transform
      );
    }

    dialog.style.setProperty(
      "--drawer-fade-from",
      getComputedStyle(dialog, "::backdrop").opacity
    );

    dialog.dataset.closing = "true";

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    timerRef.current = window.setTimeout(
      () => {
        timerRef.current = null;
        dialog.close();
        delete dialog.dataset.closing;
      },
      reduced ? 0 : 220
    );
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const desktop = window.matchMedia("(min-width: 80rem)");

    function closeOnDesktop() {
      if (!desktop.matches) return;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      dialog?.close();

      if (dialog) {
        delete dialog.dataset.closing;
      }
    }

    desktop.addEventListener("change", closeOnDesktop);

    return () => {
      desktop.removeEventListener("change", closeOnDesktop);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      dialog?.close();
    };
  }, []);

  function show() {
    const dialog = dialogRef.current;

    if (
      !dialog ||
      dialog.open ||
      window.matchMedia("(min-width: 80rem)").matches
    ) {
      return;
    }

    delete dialog.dataset.closing;

    dialog.showModal();
    setOpen(true);

    dialog
      .querySelector<HTMLButtonElement>('[aria-label="Cerrar menú"]')
      ?.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="shell-menu-trigger"
        aria-label="Abrir menú de navegación"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={show}
      >
        <span className="shell-menu-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <dialog
        ref={dialogRef}
        id={id}
        className="shell-drawer"
        aria-label="Menú de navegación"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onPointerDown={(event) => {
          startedOutside.current =
            event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (
            startedOutside.current &&
            event.target === event.currentTarget
          ) {
            close();
          }

          startedOutside.current = false;
        }}
        onClose={() => {
          setOpen(false);

          if (!window.matchMedia("(min-width: 80rem)").matches) {
            triggerRef.current?.focus({
              preventScroll: true,
            });
          }
        }}
      >
        <div className="shell-drawer-panel">
          <AppSidebar
            session={session}
            business={business}
            collapsed={false}
            mobile
            onToggle={close}
            onNavigate={close}
            onLogout={() => {
              close();
              onLogout();
            }}
          />
        </div>
      </dialog>
    </>
  );
}
