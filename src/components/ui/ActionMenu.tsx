import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";

interface Action {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: (trigger: HTMLButtonElement) => void;
}

interface ActionMenuProps {
  label: string;
  disabled?: boolean;
  actions: Action[];
}

function positionMenu(trigger: HTMLElement, panel: HTMLElement) {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + 12;
  const top = (viewport?.offsetTop ?? 0) + 12;
  const right = left + (viewport?.width ?? window.innerWidth) - 24;
  const bottom = top + (viewport?.height ?? window.innerHeight) - 24;
  const anchor = trigger.getBoundingClientRect();

  if (
    anchor.bottom < top ||
    anchor.top > bottom ||
    anchor.right < left ||
    anchor.left > right
  ) {
    panel.hidePopover();
    return;
  }

  panel.style.width = `${Math.max(0, Math.min(192, right - left))}px`;
  panel.style.maxHeight = "none";

  const height = panel.getBoundingClientRect().height;
  const below = Math.max(0, bottom - anchor.bottom - 6);
  const above = Math.max(0, anchor.top - top - 6);
  const upwards = height > below && above > below;
  const available = upwards ? above : below;

  panel.style.maxHeight = `${available}px`;

  panel.style.left = `${Math.max(
    left,
    Math.min(
      anchor.right - panel.offsetWidth,
      right - panel.offsetWidth
    )
  )}px`;

  panel.style.top = `${Math.max(
    top,
    upwards
      ? anchor.top - 6 - Math.min(height, available)
      : anchor.bottom + 6
  )}px`;
}

export function ActionMenu({
  label,
  disabled = false,
  actions,
}: ActionMenuProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function close(restoreFocus = false) {
    panelRef.current?.hidePopover();

    if (restoreFocus) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }

  function show(last = false) {
    const trigger = triggerRef.current;
    const panel = panelRef.current;

    if (!trigger || !panel || disabled) return;

    panel.showPopover();
    positionMenu(trigger, panel);

    const items = panel.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]'
    );

    items[last ? items.length - 1 : 0]?.focus({
      preventScroll: true,
    });
  }

  useEffect(() => {
    if (disabled) panelRef.current?.hidePopover();
  }, [disabled]);

  useEffect(() => {
    function reposition(event: Event) {
      const panel = panelRef.current;
      const trigger = triggerRef.current;

      if (!panel || !trigger || !panel.matches(":popover-open")) {
        return;
      }

      if (
        event.target instanceof Node &&
        panel.contains(event.target)
      ) {
        return;
      }

      positionMenu(trigger, panel);
    }

    const viewport = window.visualViewport;

    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    viewport?.addEventListener("resize", reposition);
    viewport?.addEventListener("scroll", reposition);

    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
      viewport?.removeEventListener("resize", reposition);
      viewport?.removeEventListener("scroll", reposition);
    };
  }, []);

  return (
    <div
      className="shrink-0"
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
        className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-secondary hover:text-heading focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        onClick={(event) => {
          event.preventDefault();

          if (panelRef.current?.matches(":popover-open")) {
            close(true);
          } else {
            show();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp");
          }
        }}
      >
        <EllipsisVertical aria-hidden="true" size={20} />
      </button>

      <div
        ref={panelRef}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        style={{
          position: "fixed",
          inset: "auto",
          margin: 0,
        }}
        className="box-border overflow-y-auto overscroll-contain rounded-xl border border-outline bg-popover p-1 text-heading shadow-xl"
        onToggle={(event) => {
          setOpen(event.newState === "open");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault();

            event.stopPropagation();
            close(true);
            return;
          }

          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]'
            )
          );

          const index = items.indexOf(
            document.activeElement as HTMLButtonElement
          );

          let next: number;

          if (event.key === "ArrowDown") {
            next = (index + 1) % items.length;
          } else if (event.key === "ArrowUp") {
            next = (index - 1 + items.length) % items.length;
          } else if (event.key === "Home") {
            next = 0;
          } else if (event.key === "End") {
            next = items.length - 1;
          } else {
            return;
          }

          event.preventDefault();
          items[next]?.focus();
        }}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={[
              "group/action flex min-h-11 w-full cursor-pointer items-center gap-2",
              "rounded-lg bg-transparent px-3 py-2 text-left text-sm text-heading",
              "hover:bg-accent hover:text-on-accent",
              "focus:outline-none",
              "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
            ].join(" ")}
            onClick={() => {
              const trigger = triggerRef.current;

              close(true);

              if (trigger) {
                action.onSelect(trigger);
              }
            }}
          >
            <span className="flex shrink-0 text-accent group-hover/action:text-on-accent">
              {action.icon}
            </span>

            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
