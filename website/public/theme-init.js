/*
 * Applies a stored theme preference before the document paints.
 *
 * This is a classic blocking script referenced from <head>, so it runs before
 * the body is parsed and no theme flash is visible. Keeping it as a real file
 * (rather than an inline script) means the page needs no inline JavaScript, so
 * it stays compatible with a strict Content-Security-Policy.
 *
 * Dark is the default root state: the `:root` token layer already holds the
 * dark palette, so this script only has to *opt in* to Light. That means a
 * missing, "dark", or unrecognised stored value all land on Dark, which is
 * both the intended default and the safe failure mode.
 */
(function () {
  try {
    if (window.localStorage.getItem("theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (error) {
    // Storage can be unavailable in private modes or with cookies blocked.
    // The site must still work, so fall through to the default Dark theme.
  }
})();
