import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  id: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({
  id,
  open,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || !open) return;

    const previousFocus = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      dialog.close();

      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    <dialog
      id={id}
      ref={dialogRef}
      aria-labelledby={titleId}
      className="bottom-sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;

        const bounds = event.currentTarget.getBoundingClientRect();

        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <div className="bottom-sheet-heading">
        <h2 id={titleId}>{title}</h2>

        <button
          type="button"
          aria-label={`Cerrar ${title.toLowerCase()}`}
          className="bottom-sheet-close"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} strokeWidth={1.75} />
        </button>
      </div>

      {children}
    </dialog>
  );
}
