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
  const invalid = await execute("return [...document.querySelectorAll('svg [id]')].some(node => [...node.attributes].some(attribute => attribute.value.includes('NaN')))");
  if (invalid) throw new Error("The score contains invalid SVG coordinates");
  const overflow = await execute("return document.documentElement.scrollWidth > innerWidth");
  if (overflow) throw new Error("The editor overflows the browser width");
  const result = { browser: "Safari", version, launcher: true, fretInput: true, invalidSvg: false, overflow: false };
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/safari-smoke.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (sessionId) await fetch(`${driverUrl}/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
  driver.kill();
}
