/*
 * Applies a stored theme preference before the document paints.
 *
 * This is a classic blocking script referenced from <head>, so it runs before
 * the body is parsed and no Light -> Dark flash is visible. Keeping it as a
 * real file (rather than an inline script) means the page needs no inline
 * JavaScript, so it stays compatible with a strict Content-Security-Policy.
 *
 * Only "dark" is ever written. Leaving the attribute off keeps the plain
 * `:root` token values, so a visitor with no preference sees the default
 * Light theme and nothing extra is applied.
 */
(function () {
  try {
    if (window.localStorage.getItem("theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (error) {
    // Storage can be unavailable in private modes or with cookies blocked.
    // The site must still work, so fall through to the default Light theme.
  }
})();