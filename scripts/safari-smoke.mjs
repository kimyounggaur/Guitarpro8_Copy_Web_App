import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const appUrl = process.env.TABSCORE_SAFARI_URL ?? "http://127.0.0.1:5174";
const driverUrl = "http://127.0.0.1:4444";
const driver = spawn("/usr/bin/safaridriver", ["--port", "4444"], { stdio: "inherit" });
let sessionId;

async function request(path, body) {
  const response = await fetch(`${driverUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || result.value?.error) throw new Error(JSON.stringify(result));
  return result.value;
}

async function until(check, label) {
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      if (Date.now() + 300 >= end) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const execute = (script, args = []) => request(`/session/${sessionId}/execute/sync`, { script, args });
async function click(selector) {
  const element = await request(`/session/${sessionId}/element`, { using: "css selector", value: selector });
  const id = element["element-6066-11e4-a52e-4f735466cecf"];
  await request(`/session/${sessionId}/element/${id}/click`, {});
}
async function keys(values) {
  await request(`/session/${sessionId}/actions`, { actions: [{ type: "key", id: "ui-keys", actions: values.flatMap(value => [
    { type: "keyDown", value }, { type: "keyUp", value }
  ]) }] });
}

try {
  await until(() => request("/status"), "SafariDriver");
  const session = await request("/session", { capabilities: { alwaysMatch: { browserName: "safari" } } });
  sessionId = session.sessionId;
  await request(`/session/${sessionId}/url`, { url: appUrl });
  await until(() => execute("return !!document.querySelector('#home-title')"), "the Home launcher");
  const version = session.capabilities.browserVersion;
  await request(`/session/${sessionId}/url`, { url: `${appUrl}/?testMode=e2e` });
  await until(() => execute("return !!window.__GPW_TEST__ && window.__GPW_TEST__.getScore().tracks.length > 0"), "the editor");
  await until(() => execute("return document.fonts.status === 'loaded'"), "score fonts");
  await execute("document.querySelector('[role=application][aria-label=\"Editable score\"]').focus()");
  await request(`/session/${sessionId}/actions`, { actions: [{ type: "key", id: "score-input", actions: [
    { type: "keyDown", value: "5" }, { type: "keyUp", value: "5" }
  ] }] });
  await until(() => execute(`const hooks = window.__GPW_TEST__;
    const cursor = hooks.getCursor();
    const track = hooks.getScore().tracks.find(({id}) => id === cursor.trackId);
    return track.bars[cursor.barIndex].voices[cursor.voiceIndex].beats[cursor.beatIndex].notes.some(({fret}) => fret === 5);`), "a typed fret");
  await click('[data-testid="tab-add"]');
  await until(() => execute('return document.querySelectorAll("[data-testid=tab-bar] [role=tab]").length === 2'), "two independent documents");
  await click('[data-testid="tab-bar"] [role="tab"]');
  await until(() => execute("return window.__GPW_TEST__.getScore().tracks[0].bars[0].voices[0].beats[0].notes.some(note => note.fret === 5)"), "the original document's edit");
  const separator = '[role="separator"][aria-label="Resize edition palette"]';
  const beforeWidth = await execute("return Number(document.querySelector(arguments[0]).getAttribute('aria-valuenow'))", [separator]);
  await click(separator);
  await execute("document.querySelector(arguments[0]).focus()", [separator]);
  await keys(["\uE014"]);
  await until(() => execute("return Number(document.querySelector(arguments[0]).getAttribute('aria-valuenow')) > arguments[1]", [separator, beforeWidth]), "keyboard dock resizing");
  await execute("document.querySelector('[role=application][aria-label=\"Editable score\"]').focus()");
  await request(`/session/${sessionId}/actions`, { actions: [{ type: "key", id: "shortcuts", actions: [
    { type: "keyDown", value: "\uE03D" }, { type: "keyDown", value: "e" },
    { type: "keyUp", value: "e" }, { type: "keyUp", value: "\uE03D" }
  ] }] });
  await until(() => execute('return !!document.querySelector("[data-testid=command-palette-input]")'), "the command palette shortcut");
  const bars = await execute("return window.__GPW_TEST__.getScore().masterBars.length");
  await keys([..."add-bar 1", "\uE007"]);
  await until(() => execute("return window.__GPW_TEST__.getScore().masterBars.length === arguments[0] + 1", [bars]), "a command palette edit");
  const invalid = await execute("return [...document.querySelectorAll('svg [id]')].some(node => [...node.attributes].some(attribute => attribute.value.includes('NaN')))");
  if (invalid) throw new Error("The score contains invalid SVG coordinates");
  const overflow = await execute("return document.documentElement.scrollWidth > innerWidth");
  if (overflow) throw new Error("The editor overflows the browser width");
  const result = { browser: "Safari", version, launcher: true, fretInput: true,
    independentDocuments: true, keyboardDockResize: true, commandPaletteShortcut: true,
    commandPaletteEditing: true, invalidSvg: false, overflow: false };
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/safari-smoke.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (sessionId) await fetch(`${driverUrl}/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
  driver.kill();
}
