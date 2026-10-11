import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const base = new URL(process.argv[2] ?? "http://localhost:3000/le-grande-center/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const profile = await mkdtemp(join(tmpdir(), "le-grande-smoke-"));
const chrome = spawn(process.env.CHROME_BIN ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "chromium"), [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const stopped = new Promise(resolve => { chrome.once("exit", resolve); chrome.once("error", resolve); });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Chrome did not start: ${stderr}`)), 15_000);
    chrome.once("error", error => { clearTimeout(timer); reject(error); });
    chrome.once("exit", code => { clearTimeout(timer); reject(new Error(`Chrome exited (${code}): ${stderr}`)); });
    chrome.stderr.on("data", chunk => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const discovery = new URL(endpoint);
  discovery.protocol = "http:";
  discovery.pathname = "/json/list";
  const targets = await (await fetch(discovery)).json();
  socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  await once(socket, "open");
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const { id, result, error } = JSON.parse(data);
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    clearTimeout(request.timer);
    if (error) request.reject(new Error(error.message));
    else request.resolve(result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15_000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(fn, ...args) {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression: `(${fn})(${args.map(arg => JSON.stringify(arg)).join(",")})`, returnByValue: true, awaitPromise: true,
    });
    assert(!exceptionDetails, exceptionDetails?.exception?.description ?? exceptionDetails?.text);
    return result.value;
  }
  async function waitFor(fn, ...args) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const value = await evaluate(fn, ...args);
      if (value) return value;
      await sleep(100);
    }
    throw new Error(`UI condition timed out: ${fn}`);
  }
  async function click(selector) {
    await evaluate(selector => document.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "instant" }), selector);
    const point = await waitFor(selector => {
      const element = document.querySelector(selector);
      if (!element || element.disabled) return false;
      const box = element.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      return box.width && box.height && element.contains(document.elementFromPoint(x, y)) && { x, y };
    }, selector);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  }
  async function escape() {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  }
  const viewport = width => send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
  const dialog = '[role="dialog"]';
  await send("Page.bringToFront");
  await viewport(1366);
  await send("Page.navigate", { url: new URL("tong-quan/", base).href });
  await waitFor(() => document.readyState === "complete" && !!document.querySelector("#letter"));
  await sleep(300);
  const backdropStates = await evaluate(() => new Promise(resolve => {
    const letter = document.querySelector("#letter");
    const top = letter.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.8;
    window.scrollTo({ top, behavior: "instant" });
    const samples = [];
    const started = performance.now();
    const sample = now => {
      const style = getComputedStyle(letter);
      samples.push({ backgroundImage: style.backgroundImage, backgroundColor: style.backgroundColor, opacity: style.opacity });
      if (now - started < 1400) requestAnimationFrame(sample);
      else resolve(samples);
    };
    requestAnimationFrame(sample);
  }));
  const backgroundImage = backdropStates[0]?.backgroundImage ?? "";
  assert(backgroundImage.includes("linear-gradient") && backgroundImage.includes("rgba(250, 248, 240, 0.91)") && backgroundImage.includes("url("), "investor-letter background is missing its paper-tinted image layers");
  assert(await evaluate(() => document.querySelector("#letter > img") === null), "investor-letter backdrop must not be a reveal-animated child image");
  assert(backdropStates.every(state => state.backgroundImage === backgroundImage && state.backgroundColor === "rgb(250, 248, 240)" && state.opacity === "1"), "investor-letter background layer changed during reveal");
  if (process.argv[3] === "--investor-letter-only") {
    console.log("PASS investor-letter: tinted CSS background remains static through reveal.");
  } else {
    await send("Page.navigate", { url: new URL("mat-bang/", base).href });
    await waitFor(() => !!document.querySelector('button[id="leasing-plan-A.1"]'));
  await evaluate(() => document.fonts.ready.then(() => true));
  for (const width of [1366, 1201, 1200, 1100, 720, 390, 320]) {
    await viewport(width);
    const compact = width <= 1200;
    if (compact) await click("header summary");
    assert(await evaluate(compact => {
      const nav = document.querySelector(compact ? "header details nav" : 'header nav[aria-label="Điều hướng chính"]');
      const link = nav.querySelector('a[href$="/kham-pha/"]');
      return !!link?.getClientRects().length && getComputedStyle(link).display !== "none" && document.documentElement.scrollWidth === innerWidth;
    }, compact), `3D navigation missing or header overflow at ${width}px`);
    assert(await evaluate(() => Math.abs(document.querySelector("header").getBoundingClientRect().height - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--public-header-height"))) < 1), `header/token mismatch at ${width}px`);
    if (compact) {
      await escape();
      await waitFor(() => !document.querySelector("header details").open && document.activeElement === document.querySelector("header summary"));
    }
  }
  await viewport(1366);
  const slot = 'button[id="leasing-plan-A.1"]';
  await click(slot);
  await waitFor(() => document.querySelector('[role="dialog"] h2')?.textContent === "Mặt bằng A.1");
  assert.equal(await evaluate(() => location.pathname.replace(/\/$/, "")), new URL("mat-bang/", base).pathname.replace(/\/$/, ""), "slot click navigated before detail action");
  await escape();
  await waitFor(() => !document.querySelector('[role="dialog"]') && document.activeElement.id === "leasing-plan-A.1");
  await click('button[aria-label="Xem danh sách (List)"]');
  await waitFor(() => document.querySelector("#leasing-floor-content")?.dataset.view === "list");
  assert(await evaluate(() => !document.querySelector('button[id^="leasing-plan-"]') && document.querySelectorAll('button[id^="leasing-list-"]').length === 22), "group 1–2 lost physical units or rendered both views");
  await click('button[id="leasing-list-A.1"]');
  await waitFor(() => document.querySelector('[role="dialog"] h2')?.textContent === "Mặt bằng A.1");
  await click(`${dialog} a[href*="/mat-bang/"]`);
  await waitFor(() => location.pathname.endsWith("/mat-bang/A.1") || location.pathname.endsWith("/mat-bang/A.1/"));
  await waitFor(() => !!document.querySelector('button[aria-label^="Mở ảnh:"]'));
  await click('button[aria-label^="Mở ảnh:"]');
  await waitFor(() => !!document.querySelector('[role="dialog"] button[aria-label="Phóng to ảnh"]:not([disabled])'));
  await click(`${dialog} button[aria-label="Phóng to ảnh"]`);
  await waitFor(() => [...document.querySelectorAll('[role="dialog"] [aria-live]')].some(el => el.textContent === "125%"));
  await click(`${dialog} button[aria-label="Ảnh tiếp theo"]`);
  await waitFor(() => [...document.querySelectorAll('[role="dialog"] [aria-live]')].some(el => el.textContent.startsWith("2 / 5")));
  assert(await evaluate(() => [...document.querySelectorAll('[role="dialog"] [aria-live]')].some(el => el.textContent === "100%")), "photo change did not reset zoom");
  await escape();
  await waitFor(() => !document.querySelector('[role="dialog"]') && document.activeElement.matches('button[aria-label^="Mở ảnh:"]'));
  assert(await evaluate(() => document.querySelector('[aria-label^="Ảnh dự án tham khảo"] p[aria-live]').textContent.startsWith("2 / 5")), "modal/gallery selection diverged");
  console.log("PASS public UI: responsive 3D navigation, header token, slot popup/detail, exclusive map/list, image zoom/selection/focus, static investor-letter backdrop.");
  }
} finally {
  socket?.close();
  chrome.kill();
  await stopped;
  await rm(profile, { recursive: true, force: true });
}
