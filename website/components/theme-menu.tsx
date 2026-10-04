"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Theme control for the public site: a "Theme" button that opens a small menu
 * with one radio item per theme.
 *
 * The selection itself lives in a `data-theme` attribute on <html>, which the
 * token layer in globals.css keys off. Dark is the default, so the attribute is
 * only ever written for Light. This component reads the attribute back through
 * `useSyncExternalStore` so the menu shows the real state as soon as the
 * document is hydrated, and the root layout stays a server component.
 */

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Menu order is fixed: Light first, Dark second. */
const OPTIONS: readonly Theme[] = ["light", "dark"];

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

/**
 * Inline SVG glyphs drawn with `currentColor`, so they inherit the row's text
 * colour and stay legible in both themes without a second set of assets. Both
 * are decorative: the text label beside them is the accessible name.
 */
const SUN_ICON = (
  <g
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
  </g>
);

const MOON_ICON = (
  <path
    fill="currentColor"
    d="M20.3 14.2a8.3 8.3 0 0 1-10.5-10.5 8.3 8.3 0 1 0 10.5 10.5Z"
  />
);

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Reads the attribute the blocking init script has already applied. */
function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** The server renders the default, which is Dark. */
function getServerSnapshot(): Theme {
  return "dark";
}

function applyTheme(next: Theme) {
  // Dark is the root default, so only Light needs the attribute.
  if (next === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable in private modes or with cookies blocked.
    // The theme still applies for this visit; it just will not persist.
  }

  listeners.forEach((listener) => {
    listener();
  });
}

export function ThemeMenu() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }, []);

  // Dismiss on Escape or on a pointer press outside the control.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        close(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Opening the menu moves focus to the item for the active theme.
  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, OPTIONS.indexOf(theme));
    itemRefs.current[index]?.focus();
  }, [open, theme]);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const active = itemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );

    const focusAt = (next: number) => {
      event.preventDefault();
      const items = itemRefs.current;
      const bounded = (next + items.length) % items.length;
      items[bounded]?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
        focusAt(active + 1);
        break;
      case "ArrowUp":
        focusAt(active - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(itemRefs.current.length - 1);
        break;
      case "Tab":
        // Let focus leave naturally, but do not leave the menu open behind it.
        close(false);
        break;
      default:
        break;
    }
  };

  const select = (next: Theme) => {
    applyTheme(next);
    close(true);
  };

  return (
    <div className="theme-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="theme-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="theme-menu__trigger-label">Theme</span>
        <svg
          className="theme-menu__caret"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          className="theme-menu__list"
          role="menu"
          aria-label="Theme"
          onKeyDown={onMenuKeyDown}
        >
          {OPTIONS.map((option, index) => {
            const selected = option === theme;
            return (
              <button
                key={option}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className="theme-menu__item"
                data-selected={selected ? "true" : undefined}
                onClick={() => {
                  select(option);
                }}
              >
                <span className="theme-menu__tick" aria-hidden="true">
                  {selected ? (
                    <svg
                      className="theme-menu__tick-icon"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      focusable="false"
                    >
                      <path
                        d="M4 12.5l5 5L20 6.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>

                <svg
                  className="theme-menu__icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  {option === "light" ? SUN_ICON : MOON_ICON}
                </svg>

                {LABELS[option]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}