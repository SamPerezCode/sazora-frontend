import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import type { NavigationItem } from "../navigation";

interface Props {
  item: NavigationItem;
  onNavigate?: () => void;
}

export function CollapsedSidebarItem({ item, onNavigate }: Props) {
  const { pathname } = useLocation();
  const id = useId();

  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);

  const [open, setOpen] = useState(false);

  const group = item.status === "group";
  const Icon = item.icon;

  const active =
    item.status === "ready"
      ? item.to === pathname
      : item.status === "group" &&
        item.children.some(
          (child) => child.status === "ready" && child.to === pathname
        );

  function cancelClose() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = null;
  }

  function close(restoreFocus = false) {
    cancelClose();

    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
    }
    frame.current = null;

    panel.current?.hidePopover();

    if (restoreFocus) {
      root.current
        ?.querySelector<HTMLElement>(".shell-nav-item")
        ?.focus({ preventScroll: true });
    }
  }

  function position() {
    const popup = panel.current;
    const anchor = root.current;

    if (!popup || !anchor || !popup.matches(":popover-open")) {
      return;
    }

    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + 12;
    const top = (viewport?.offsetTop ?? 0) + 12;
    const right = left + (viewport?.width ?? window.innerWidth) - 24;
    const bottom =
      top + (viewport?.height ?? window.innerHeight) - 24;
    const rect = anchor.getBoundingClientRect();

    if (
      rect.bottom < top ||
      rect.top > bottom ||
      rect.right < left ||
      rect.left > right
    ) {
      close();
      return;
    }

    popup.style.maxWidth = Math.max(0, right - left) + "px";
    popup.style.maxHeight = Math.max(0, bottom - top) + "px";

    const width = popup.offsetWidth;
    const height = popup.offsetHeight;

    const x =
      rect.right + 10 + width <= right
        ? rect.right + 10
        : rect.left - width - 10;

    const y = group
      ? rect.top
      : rect.top + (rect.height - height) / 2;

    popup.style.left =
      Math.max(left, Math.min(x, right - width)) + "px";

    popup.style.top =
      Math.max(top, Math.min(y, bottom - height)) + "px";
  }

  function show(focusFirst = false) {
    cancelClose();

    const popup = panel.current;
    if (!popup) return;

    if (!popup.matches(":popover-open")) {
      popup.showPopover();
    }

    position();

    if (focusFirst && group) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        panel.current
          ?.querySelector<HTMLAnchorElement>("a[href]")
          ?.focus();
      });
    }
  }

  function scheduleClose() {
    cancelClose();

    // Permite cruzar el espacio entre el icono y el submenú.
    timer.current = setTimeout(() => {
      timer.current = null;

      if (!root.current?.contains(document.activeElement)) {
        close();
      }
    }, 200);
  }

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;

    function update(event: Event) {
      if (
        event.target instanceof Node &&
        panel.current?.contains(event.target)
      ) {
        return;
      }

      position();
    }

    const observer = new ResizeObserver(() => position());

    if (root.current) observer.observe(root.current);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  });

  const triggerClass =
    "shell-nav-item" +
    (active || (group && open) ? " is-active" : "");

  const content = (
    <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
  );

  return (
    <div
      ref={root}
      className="shell-collapsed-entry"
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") show();
      }}
      onPointerLeave={scheduleClose}
      onFocusCapture={(event) => {
        if (
          !group &&
          event.target ===
            root.current?.querySelector(".shell-nav-item")
        ) {
          show();
        }
      }}
      onBlurCapture={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (
          group &&
          (event.key === "ArrowRight" || event.key === "ArrowDown") &&
          event.target ===
            root.current?.querySelector(".shell-nav-item")
        ) {
          event.preventDefault();
          show(true);
        }
      }}
    >
      {item.status === "ready" ? (
        <NavLink
          to={item.to}
          end
          className={triggerClass}
          aria-label={item.label}
          aria-describedby={open ? id : undefined}
          onClick={() => {
            close();
            onNavigate?.();
          }}
        >
          {content}
        </NavLink>
      ) : (
        <button
          type="button"
          className={triggerClass}
          aria-label={item.label}
          aria-disabled={item.status === "planned" || undefined}
          aria-expanded={group ? open : undefined}
          aria-controls={group ? id : undefined}
          aria-describedby={!group && open ? id : undefined}
          onClick={() => {
            if (group) show(true);
          }}
        >
          {content}
        </button>
      )}

      <div
        ref={panel}
        id={id}
        popover="auto"
        role={group ? undefined : "tooltip"}
        className={group ? "shell-flyout" : "shell-tooltip"}
        onToggle={(event) => {
          setOpen(event.newState === "open");
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        {item.status === "group" ? (
          <>
            <p className="shell-flyout-heading">{item.label}</p>

            <nav
              aria-label={"Opciones de " + item.label}
              className="shell-flyout-links"
            >
              {item.children.map((child) => {
                const ChildIcon = child.icon;

                const label = (
                  <>
                    <ChildIcon
                      aria-hidden="true"
                      size={17}
                      strokeWidth={1.75}
                    />
                    <span>{child.label}</span>
                  </>
                );

                return child.status === "ready" ? (
                  <NavLink
                    key={child.id}
                    to={child.to}
                    end
                    className={({ isActive }) =>
                      "shell-flyout-link" +
                      (isActive ? " is-active" : "")
                    }
                    onClick={() => {
                      close();
                      onNavigate?.();
                    }}
                  >
                    {label}
                  </NavLink>
                ) : (
                  <button
                    key={child.id}
                    type="button"
                    disabled
                    className="shell-flyout-link"
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          </>
        ) : (
          <>
            {item.label}

            {item.status === "planned" && (
              <span className="shell-tooltip-note">Próximamente</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
