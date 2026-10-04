"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Two-state theme control for the public site.
 *
 * The selection itself lives in a `data-theme` attribute on <html>, which the
 * token layer in globals.css keys off. This component reads that attribute
 * back through `useSyncExternalStore`, so the button reflects the real state
 * as soon as the document is hydrated rather than a tick later, and the root
 * layout stays a server component.
 *
 * Light is the default: with no stored preference nothing is written and the
 * document keeps the plain `:root` token values.
 */

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Reads the attribute the blocking init script has already applied. */
function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/** The server has no stored preference, so it always renders the default. */
function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);

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

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    applyTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <svg
        className="theme-toggle__icon"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        {isDark ? (
          // Sun: shown while dark is active, i.e. "switch back to light".
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </g>
        ) : (
          // Moon: shown while light is active, i.e. "switch to dark".
          <path
            fill="currentColor"
            d="M20.3 14.2a8.3 8.3 0 0 1-10.5-10.5 8.3 8.3 0 1 0 10.5 10.5Z"
          />
        )}
      </svg>
      <span className="theme-toggle__label">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}