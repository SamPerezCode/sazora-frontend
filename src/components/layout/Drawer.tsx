import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({
  open,
  label,
  onClose,
  children,
}: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog || !open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

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
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-64 max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 text-inherit backdrop:bg-black/50"
    >
      {children}
    </dialog>
  );
}
