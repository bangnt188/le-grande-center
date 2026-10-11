import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// Node 22+: node scripts/profile-3d-startup.mjs baseURL outputPrefix [--check-loading]
const [baseURL, outputPrefix, ...flags] = process.argv.slice(2);
assert(baseURL && outputPrefix && flags.every(flag => flag === "--check-loading"), "Usage: node scripts/profile-3d-startup.mjs baseURL outputPrefix [--check-loading]");
const base = new URL(baseURL);
if (!base.pathname.endsWith("/")) base.pathname += "/";
const viewerURL = new URL("kham-pha/", base).href;
const profileDir = await mkdtemp(join(tmpdir(), "le-grande-profile-"));
const chrome = spawn(process.env.CHROME_BIN ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "chromium"), [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profileDir}`, "--no-first-run", "about:blank",
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
  const pending = new Map(), exceptions = [], browserErrors = [];
  const paused = new Map();
  let interceptedAssets = new Map();
  const bootstrapURL = new URL("__profile-bootstrap", base).href;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry);
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      const asset = interceptedAssets.get(request.url);
      if (request.url === bootstrapURL) {
        void send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/html" }],
          body: Buffer.from('<!doctype html><title>Profile bootstrap</title><link rel="icon" href="data:,">').toString("base64") }).catch(error => browserErrors.push({ text: error.message }));
      } else if (asset) paused.set(asset, requestId);
      else void send("Fetch.continueRequest", { requestId }).catch(error => browserErrors.push({ text: error.message }));
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30_000);
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
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const value = await evaluate(fn, ...args);
      if (value) return value;
      await sleep(100);
    }
    throw new Error(`UI condition timed out: ${fn}`);
  }
  const isReady = () => {
    const control = document.querySelector('select[aria-label="Góc nhìn"]');
    return !!control && !control.disabled && !!document.querySelector("#kham-pha canvas") && window.__startup.readyTime !== null;
  };
  function observeStartup(checkLoading) {
    const state = window.__startup = { readyTime: null, longTasks: [], frameTimes: [], loading: [] };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    }).observe({ type: "longtask", buffered: true });
    let previous;
    function frame(now) {
      if (previous !== undefined) state.frameTimes.push(now - previous);
      previous = now;
      const control = document.querySelector('select[aria-label="Góc nhìn"]');
      const ready = !!control && !control.disabled;
      if (ready && state.readyTime === null) state.readyTime = performance.now();
      if (checkLoading) {
        const loader = document.querySelector('#kham-pha [role="progressbar"]');
        state.loading.push({ time: now, ready, progress: loader ? Number(loader.getAttribute("aria-valuenow")) : null,
          poster: !!document.querySelector('#kham-pha img[src*="project-film-poster"]') });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Performance.enable");
  await send("Page.bringToFront");
  await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${observeStartup})(${flags.includes("--check-loading")})` });
  // Commit an inert same-origin document so navigation does not discard the profiled renderer. No app/assets are warmed.
  await send("Fetch.enable", { patterns: [{ urlPattern: bootstrapURL, requestStage: "Request" }] });
  await send("Page.navigate", { url: bootstrapURL });
  await waitFor(url => location.href === url && document.readyState === "complete", bootstrapURL);
  await send("Fetch.disable");
  const initialMetrics = Object.fromEntries((await send("Performance.getMetrics")).metrics.map(metric => [metric.name, metric.value]));
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 1000 });
  await send("Profiler.start");
  await send("Page.navigate", { url: viewerURL });
  await sleep(6000);
  const { profile } = await send("Profiler.stop");
  const metrics = Object.fromEntries((await send("Performance.getMetrics")).metrics.map(metric => [metric.name, metric.value]));
  const capture = await evaluate(() => ({ ...window.__startup, cutoff: performance.now() }));
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  let selfGetProgramInfoLogMs = 0;
  for (let index = 0; index < (profile.samples?.length ?? 0); index++) {
    if (/getProgramInfoLog/.test(nodes.get(profile.samples[index])?.callFrame.functionName ?? "")) selfGetProgramInfoLogMs += (profile.timeDeltas?.[index] ?? 0) / 1000;
  }
  const uniformNodes = new Set();
  const collectUniforms = id => { if (uniformNodes.has(id)) return; uniformNodes.add(id); for (const child of nodes.get(id)?.children ?? []) collectUniforms(child); };
  for (const node of nodes.values()) if (node.callFrame.functionName === "getUniforms") collectUniforms(node.id);
  const uniformProgramInitializationMs = (profile.samples ?? []).reduce((sum, id, index) => sum + (uniformNodes.has(id) ? (profile.timeDeltas?.[index] ?? 0) / 1000 : 0), 0);
  await mkdir(dirname(outputPrefix), { recursive: true });
  await writeFile(`${outputPrefix}.cpuprofile`, JSON.stringify(profile));
  // A slow machine can become ready after the fixed profiling window. Never call a merely mounted canvas ready.
  let readinessError;
  try { await waitFor(isReady); } catch (error) { readinessError = error.message; }
  const state = await evaluate(() => ({ readyTime: window.__startup.readyTime,
    quality: document.querySelector("#kham-pha canvas")?.dataset.quality ?? null,
    sceneStats: JSON.parse(document.querySelector("#kham-pha canvas")?.dataset.sceneStats ?? "null"),
    alert: document.querySelector('#kham-pha [role="alert"]')?.textContent ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory ?? null }));
  const loadLongTasks = capture.longTasks.filter(task => task.startTime < (state.readyTime ?? capture.cutoff));
  const report = {
    url: viewerURL, viewport: { width: 1366, height: 900, dpr: 1 }, coldBrowserProfile: true,
    requestedCaptureMs: 6000, profileDurationMs: (profile.endTime - profile.startTime) / 1000,
    captureEndMs: capture.cutoff, readyTime: state.readyTime, readyWithinCapture: state.readyTime !== null && state.readyTime <= capture.cutoff,
    loadLongTasks, maxLongTask: Math.max(0, ...loadLongTasks.map(task => task.duration)),
    totalLongTask: loadLongTasks.reduce((sum, task) => sum + task.duration, 0),
    longTasks: capture.longTasks, maxLongTaskEntireCapture: Math.max(0, ...capture.longTasks.map(task => task.duration)),
    totalLongTaskEntireCapture: capture.longTasks.reduce((sum, task) => sum + task.duration, 0), uniformProgramInitializationMs,
    selfGetProgramInfoLogMs, scriptMs: ((metrics.ScriptDuration ?? 0) - (initialMetrics.ScriptDuration ?? 0)) * 1000,
    getProgramInfoLogNodePresent: profile.nodes.some(node => /getProgramInfoLog/.test(node.callFrame.functionName)),
    frameTimes: capture.frameTimes, quality: state.quality, sceneStats: state.sceneStats,
    raf: { frames: capture.frameTimes.length, maxFrameMs: Math.max(0, ...capture.frameTimes), meanFrameMs: capture.frameTimes.length ? capture.frameTimes.reduce((sum, value) => sum + value, 0) / capture.frameTimes.length : null },
    hardwareConcurrency: state.hardwareConcurrency, deviceMemory: state.deviceMemory,
    exceptions: [...exceptions], browserErrors: [...browserErrors], alert: state.alert,
    notes: "Milliseconds. Long tasks and rAF cover the captured navigation window; loadLongTasks start before ready. getProgramInfoLog is V8 sampled self CPU/wait time, not GPU time; zero with no named node means unobserved, not zero native cost. ScriptDuration is CDP main-thread script time. No machine-dependent performance thresholds.",
  };
  if (readinessError) report.readinessError = readinessError;
  await writeFile(`${outputPrefix}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, (key, value) => ["longTasks", "loadLongTasks", "frameTimes", "sceneStats"].includes(key) ? undefined : value, 2));
  assert(!readinessError, readinessError);

  if (flags.includes("--check-loading")) {
    const manifestResponse = await fetch(new URL("model-3d/asset-manifest.json", base));
    assert(manifestResponse.ok, "Cannot read deployed asset manifest");
    const manifest = await manifestResponse.json();
    interceptedAssets = new Map(["building", "tree"].map(id => {
      const asset = manifest.assets.find(asset => asset.id === id);
      assert(asset, `Missing ${id} in deployed manifest`);
      return [new URL(`model-3d/${asset.file}`, base).href, id];
    }));
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Fetch.enable", { patterns: [...interceptedAssets.keys()].map(urlPattern => ({ urlPattern, requestStage: "Request" })) });
    async function waitPaused(id) {
      const deadline = Date.now() + 30_000;
      while (!paused.has(id) && Date.now() < deadline) await sleep(100);
      assert(paused.has(id), `Asset was not intercepted: ${id}`);
    }
    async function release(id, fail = false) {
      const requestId = paused.get(id);
      assert(requestId, `No pending ${id}`);
      paused.delete(id);
      await send(fail ? "Fetch.failRequest" : "Fetch.continueRequest", fail ? { requestId, errorReason: "Failed" } : { requestId });
    }
    async function assertPending(cap, from = 0) {
      await sleep(1800);
      const samples = await evaluate(from => window.__startup.loading.slice(from), from);
      assert(samples.some(sample => sample.progress !== null), "No accessible loading progress");
      assert(samples.every(sample => !sample.ready && !sample.poster && (sample.progress === null || sample.progress <= cap)), `Loading became ready, showed poster, or exceeded ${cap}% while asset pending`);
      assert(await evaluate(() => document.querySelector('select[aria-label="Góc nhìn"]')?.disabled), "Viewer became ready while asset pending");
      return samples.length + from;
    }
    await send("Page.navigate", { url: viewerURL });
    await waitPaused("building");
    const buildingEnd = await assertPending(70);
    await release("building");
    await waitPaused("tree");
    await assertPending(95, buildingEnd);
    await evaluate(() => document.querySelector('button[aria-controls="viewer-information"]').click());
    await waitFor(() => !document.querySelector("#viewer-information").hidden);
    await evaluate(() => [...document.querySelectorAll('#viewer-information button[aria-controls="floor-detail"]')].find(button => button.textContent === "Tầng 3").click());
    await release("tree");
    await waitFor(isReady);
    assert(await evaluate(() => document.querySelector('select[aria-label="Góc nhìn"]').value === "front" && document.querySelector('button[aria-label="Tầng 3"]').getAttribute("aria-pressed") === "true"), "Pending floor selection did not focus the ready scene");
    assert(await evaluate(() => {
      const floor = document.querySelector('button[aria-label="Tầng 4"]');
      if (!floor || floor.disabled) return false;
      floor.click();
      return true;
    }), "Cannot choose a floor");
    await waitFor(() => document.querySelector('button[aria-label="Tầng 4"]')?.getAttribute("aria-pressed") === "true");
    const chosenView = await evaluate(() => {
      const control = document.querySelector('select[aria-label="Góc nhìn"]');
      const next = [...control.options].find(option => !option.disabled && option.value !== control.value);
      if (!next || control.disabled) return null;
      control.value = next.value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return next.value;
    });
    assert(chosenView, "Cannot choose another viewpoint");
    await waitFor(value => document.querySelector('select[aria-label="Góc nhìn"]')?.value === value, chosenView);
    await send("Page.navigate", { url: "about:blank" });
    await waitFor(() => location.href === "about:blank" && !document.querySelector("canvas"));
    await send("Page.navigate", { url: viewerURL });
    await waitPaused("building");
    await release("building", true);
    await waitFor(() => !!document.querySelector('#kham-pha [role="alert"]'));
    const failure = await evaluate(() => ({ ready: !document.querySelector('select[aria-label="Góc nhìn"]')?.disabled,
      samples: window.__startup.loading, alert: document.querySelector('#kham-pha [role="alert"]')?.textContent }));
    assert(!failure.ready && failure.samples.every(sample => !sample.ready && sample.progress !== 100 && !sample.poster), "Core building failure falsely completed loading");
    assert(failure.alert?.trim(), "Core building failure has no error message");
    await send("Fetch.disable");
    await send("Page.navigate", { url: "about:blank" });
    report.loadingCheck = { passed: true, delayedAssets: ["building", "tree"], buildingProgressCap: 70, treeProgressCap: 95, pendingFloor: 3, floor: 4, viewpoint: chosenView, coreFailureAlert: failure.alert };
    await writeFile(`${outputPrefix}.json`, JSON.stringify(report, null, 2));
    console.log("PASS 3D loading: pending caps, no poster/false ready, floor/viewpoint selection, navigation disposal, core building failure.");
  }
  await send("Page.navigate", { url: "about:blank" });
} finally {
  socket?.close();
  chrome.kill();
  await stopped;
  await rm(profileDir, { recursive: true, force: true });
}
