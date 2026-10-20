// Murmuration translation worker (the optional "translation extra").
// Runs open Opus-MT models (Helsinki-NLP) in the browser with Transformers.js on the CPU.
// Nothing downloads until the viewer installs the extra; then exactly the models listed by
// plan() are fetched and cached, and translation works offline with nothing else installed.
// Anything else found in the cache is deleted, so storage never grows past the plan.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";
import { plan, route } from "./translate-plan.js";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_CACHE = "transformers-cache"; // where Transformers.js keeps downloads

let target = "en";
let planned = [];            // [{ name, mb, label }]
let installed = new Set();   // model names in the plan

// --- Cache housekeeping -------------------------------------------------------
async function cleanup() {
  try {
    const keep = new Set(planned.map((m) => `Xenova/opus-mt-${m.name}`));
    const cache = await caches.open(MODEL_CACHE);
    let bytes = 0;
    for (const req of await cache.keys()) {
      const repo = req.url.match(/huggingface\.co\/([^/]+\/[^/]+)\//)?.[1];
      if (repo && !keep.has(repo)) { await cache.delete(req); continue; }
      const res = await cache.match(req);
      bytes += +(res && res.headers.get("content-length")) || 0;
    }
    postMessage({ type: "storage", bytes });
  } catch { /* storage unavailable */ }
}

// --- Loaded pipelines (least recently used first; a few at most to bound memory) ---
const models = new Map(); // name -> Promise<pipeline>
const MAX_LOADED = 3;

function getModel(name, onProgress) {
  if (models.has(name)) {
    const p = models.get(name);
    models.delete(name); models.set(name, p);
    return p;
  }
  const files = new Map();
  const p = pipeline("translation", `Xenova/opus-mt-${name}`, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (e) => {
      if (e.status !== "progress" || !e.total) return;
      files.set(e.file, { loaded: e.loaded, total: e.total });
      let loaded = 0, total = 0;
      for (const f of files.values()) { loaded += f.loaded; total += f.total; }
      onProgress?.(loaded, total);
    },
  }).catch((err) => {
    models.delete(name);
    throw err;
  });
  models.set(name, p);
  while (models.size > MAX_LOADED) {
    const [oldest, op] = models.entries().next().value;
    models.delete(oldest);
    op.then((t) => t.dispose?.()).catch(() => {});
  }
  return p;
}

// Download every planned model, reporting overall progress against the planned sizes
async function install() {
  const loaded = new Map();
  const totals = new Map(planned.map((m) => [m.name, m.mb * 1e6]));
  let lastPost = 0;
  const report = (force) => {
    const now = Date.now();
    if (!force && now - lastPost < 250) return;
    lastPost = now;
    let l = 0, t = 0;
    for (const [name, total] of totals) { t += total; l += Math.min(loaded.get(name) || 0, total); }
    postMessage({ type: "install-progress", loaded: l, total: t });
  };
  try {
    for (const m of planned) {
      await getModel(m.name, (l, t) => { loaded.set(m.name, l); totals.set(m.name, t); report(); });
      loaded.set(m.name, totals.get(m.name));
      report(true);
    }
    await cleanup();
    postMessage({ type: "installed" });
  } catch (err) {
    postMessage({ type: "install-failed", message: String(err && err.message || err) });
  }
}

// --- Translation ----------------------------------------------------------------
// Sentence by sentence: short inputs keep these small models accurate.
function sentences(text) {
  // Full-width ！？ make some models loop on punctuation; use the ASCII forms
  const cleaned = text.replace(/！/g, "!").replace(/？/g, "?").replace(/([!?。…])\1+/g, "$1");
  const parts = cleaned.match(/[^.!?。…\n]+[.!?。…]*/g) || [cleaned];
  return parts.map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
}

// Characters of output per character of input before we call it a hallucination
const DENSE_SCRIPTS = new Set(["ja", "ko", "zh", "zh-hans", "zh-hant"]);

async function runStep(step, parts, src) {
  const t = await getModel(step.model);
  const out = await t(parts.map((s) => step.prefix + s), { max_new_tokens: 160 });
  const maxRatio = DENSE_SCRIPTS.has(src) ? 4.5 : 2.5;
  return out.map((o, i) => {
    const text = o.translation_text
      .replace(/([!?.。…])\1{2,}/g, "$1")              // runaway "!!!!!!" or "......"
      .replace(/([.!?…])[^\s\w]*\w{0,2}[:.]+$/u, "$1") // stray junk after the last sentence
      .trim();
    // Far longer than the source: the model is making things up; give up on this post
    if (text.length > Math.max(40, parts[i].length * maxRatio)) throw new Error("implausible output");
    return text;
  });
}

let queue = []; // [{ id, text, src, tgt, t }]
let busy = false;

// Every job gets an answer, even a skipped one, so the page can let go of it
const dropped = (job) => postMessage({ type: "result", id: job.id, text: null });

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    // Newest first: what's on screen now matters more than what has scrolled away
    const now = Date.now();
    queue = queue.filter((q) => now - q.t < 30000 || (dropped(q), false));
    const job = queue.pop();
    if (!job) break;
    const steps = route(job.src, job.tgt, installed);
    if (!steps) { dropped(job); continue; }
    try {
      let parts = sentences(job.text);
      let lang = job.src;
      for (const step of steps) {
        if (parts.length) parts = await runStep(step, parts, lang);
        lang = "en";
      }
      const text = parts.filter(Boolean).join(" ");
      postMessage({ type: "result", id: job.id, text: text || null });
    } catch {
      dropped(job);
    }
  }
  busy = false;
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    target = m.tgt;
    planned = plan(target) || [];
    installed = new Set(planned.map((p) => p.name));
    postMessage({ type: "ready" });
    cleanup();
  } else if (m.type === "install") {
    install();
  } else if (m.type === "translate") {
    queue.push({ ...m, t: Date.now() });
    if (queue.length > 12) dropped(queue.shift());
    pump();
  }
};
