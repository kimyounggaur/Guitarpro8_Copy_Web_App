import { expect } from "@playwright/test";
import { clickToolbarControl, openApp, test } from "../helpers";

const failures = [
  { code: "NotAllowedError", message: "Microphone permission was denied." },
  { code: "NotFoundError", message: "No microphone was found." },
  { code: "NotReadableError", message: "The microphone is busy or unavailable." }
];

for (const { code, message } of failures) {
  test(`[B19] explains ${code} and offers a microphone retry`, async ({ page }) => {
    await page.addInitScript((name) => {
      let count = 0;
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async (constraints: MediaStreamConstraints) => {
          document.documentElement.dataset.microphoneRequest = JSON.stringify(constraints);
          document.documentElement.dataset.microphoneAttempts = String(++count);
          throw new DOMException("Synthetic test microphone failure", name);
        }
      });
    }, code);
    await openApp(page);
    await clickToolbarControl(page, "Tuner");
    const tuner = page.getByRole("region", { name: "Tools" });
    await tuner.getByRole("button", { name: "Start", exact: true }).click();
    await expect(tuner.getByRole("alert")).toContainText(message);
    const constraints = await page.locator("html").getAttribute("data-microphone-request");
    expect(JSON.parse(constraints ?? "null")).toEqual({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    await tuner.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-microphone-attempts", "2");
  });
}
