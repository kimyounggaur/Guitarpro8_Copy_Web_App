/**
 * Explicit test-mode selectors. Every product code path that reads these
 * must be a no-op when its mode is absent, per docs/ui-remaster playbook §Phase 1
 * requirement 6 ("실제 제품 경로에서는 testMode가 동작이나 데이터를 변경하지 않아야 한다").
 */
function requestedTestMode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("testMode");
}

export function isVisualTestMode(): boolean {
  return requestedTestMode() === "visual";
}

export async function applyE2eTestMode(): Promise<void> {
  if (requestedTestMode() === "e2e") {
    const { installTestHooks } = await import("./testHooks");
    installTestHooks();
  }
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
