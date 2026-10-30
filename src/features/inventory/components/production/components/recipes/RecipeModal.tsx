import { useId, type ReactNode } from "react";
import { BottomSheet } from "../../../../../../components/layout/BottomSheet";

export function RecipeModal({
  title,
  subtitle,
  children,
  footer,
  busy = false,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  busy?: boolean;
  onClose: () => void;
}) {
  const id = useId();

  return (
    <BottomSheet
      id={id}
      open
      variant="modal"
      title={title}
      busy={busy}
      onClose={onClose}
      className="w-[calc(100%_-_2rem)]! max-w-[1000px]! max-h-[calc(100dvh_-_2rem)]! overflow-hidden! p-0! [&[open]]:flex [&[open]]:flex-col [&>.bottom-sheet-heading]:m-0 [&>.bottom-sheet-heading]:shrink-0 [&>.bottom-sheet-heading]:px-5 [&>.bottom-sheet-heading]:pt-4 [&>.bottom-sheet-heading]:pb-2 [&>.bottom-sheet-heading_h2]:text-base"
    >
      <p className="shrink-0 border-b border-outline px-5 pb-5 text-xs text-muted">
        {subtitle}
      </p>

      <div className="min-h-0 overflow-y-auto overscroll-contain p-5 text-sm">
        {children}
      </div>

      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-outline bg-background px-5 py-3">
        {footer}
      </footer>
    </BottomSheet>
  );
}
