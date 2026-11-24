import type { Page } from "@playwright/test";

export async function dropFileOnScore(page: Page, name: string, bytes: number[]): Promise<void> {
  const payload = await page.evaluateHandle(({ name, bytes }) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], name));
    return data;
  }, { name, bytes });

  try {
    await page.getByRole("application", { name: "Editable score" }).dispatchEvent("drop", { dataTransfer: payload });
  } finally {
    await payload.dispose();
  }
}
