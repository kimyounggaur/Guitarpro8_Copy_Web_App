/**
 * Visual/E2E determinism gate. Active only when the page is loaded with
 * `?testMode=visual` in the URL — every product code path that reads this
 * must be a no-op on any other URL, per docs/ui-remaster playbook §Phase 1
 * requirement 6 ("실제 제품 경로에서는 testMode가 동작이나 데이터를 변경하지 않아야 한다").
 */
export function isVisualTestMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("testMode") === "visual";
}

/**
 * Stamps `data-testmode="visual"` on the document root so CSS (see
 * src/test/visual/screenshot.css) can disable animations/transitions/caret
 * blink for deterministic screenshots. Called once from main.tsx.
 */
export function applyVisualTestModeMarker(): void {
  if (isVisualTestMode()) {
    document.documentElement.setAttribute("data-testmode", "visual");
  }
}
