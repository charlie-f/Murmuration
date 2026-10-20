// Where the project lives: source, releases, issues and credits all point here
const APP = {
  name: "Murmuration",
  version: "0.1.0",
  repo: "https://github.com/charlie-f/Murmuration",
};
document.getElementById("appVersion").textContent = APP.version;

// Inside the Windows/Mac wrapper the page is opened with ?host=screensaver or ?host=app,
// and can ask the wrapper to close
const HOST = new URLSearchParams(location.search).get("host");
if (HOST) document.body.classList.add("host-" + HOST);
const EXPLORE_ELSEWHERE = { app: "To explore, open the Murmuration app",
  install: "To explore, install the Murmuration app" }[new URLSearchParams(location.search).get("explore")];
if (EXPLORE_ELSEWHERE) {
  document.body.classList.add("explore-" + new URLSearchParams(location.search).get("explore"));
  document.querySelector("#exploreBox .hint-app").textContent = EXPLORE_ELSEWHERE;
}
const tellHost = (message) => {
  window.chrome?.webview?.postMessage(message);                       // Windows (WebView2)
  window.webkit?.messageHandlers?.murmuration?.postMessage(message);  // macOS (WKWebView)
};
document.getElementById("linkRepo").href = APP.repo;
document.getElementById("linkIssues").href = APP.repo + "/issues";
document.getElementById("linkCredits").href = APP.repo + "/blob/main/NOTICE";

// ---------------------------------------------------------------------------
// Places. [lat, lng, latSpread, lngSpread]: a rough box over where people live.
// ---------------------------------------------------------------------------
const PLACES = {
  US: [38, -96, 7, 18], CA: [48, -95, 3.5, 25], MX: [21, -101, 4, 6], GB: [53, -2, 2.5, 2],
  IE: [53.2, -7.8, 1, 1.5], AU: [-31, 141, 5, 9], NZ: [-40, 174, 3, 2], IN: [22, 79, 7, 7],
  PH: [12.5, 122, 4, 2], ZA: [-28, 26, 3, 4], NG: [9.5, 7.5, 2, 2], JP: [36, 138, 3, 4],
  KR: [36.5, 127.8, 1.3, 1], TW: [23.7, 121, 1, 0.5], HK: [22.35, 114.15, 0.1, 0.1],
  CN: [32, 113, 6, 8], SG: [1.35, 103.8, 0.1, 0.1], BR: [-17, -46, 7, 7], PT: [39.6, -8.2, 1.5, 0.6],
  ES: [40, -3.7, 3, 4], AR: [-34, -61, 3, 3], CO: [5, -74, 2.5, 2], CL: [-33.5, -71, 3, 0.6],
  PE: [-10, -76, 4, 2], VE: [8, -66, 2, 4], DE: [51, 10, 2.5, 3], AT: [47.6, 14.5, 0.7, 2.5],
  CH: [46.8, 8.2, 0.5, 1.5], FR: [46.5, 2.5, 3, 3], BE: [50.6, 4.5, 0.5, 1], NL: [52.2, 5.4, 0.7, 0.8],
  IT: [42.5, 12.8, 3.5, 2.5], PL: [52, 19.3, 1.8, 3], SE: [59.5, 15.5, 2.5, 3], NO: [60.5, 9, 2, 3],
  DK: [55.8, 10, 1, 1.3], FI: [62, 25.5, 2, 2.5], IS: [64.5, -19, 0.6, 3], TR: [39, 34, 2, 7],
  RU: [55.5, 40, 3, 10], UA: [49, 31, 2, 6], BY: [53.7, 28, 1, 2.5], KZ: [48, 68, 4, 12],
  CZ: [49.8, 15.5, 0.8, 2], SK: [48.7, 19.5, 0.5, 1.8], HU: [47.2, 19.3, 0.8, 2], RO: [45.8, 25, 1.5, 3],
  BG: [42.7, 25.3, 0.8, 2.5], GR: [39, 22.5, 2, 2], RS: [44, 20.8, 1.2, 1], HR: [45.3, 16, 1, 1.5],
  SI: [46.1, 14.8, 0.4, 0.8], LT: [55.3, 23.9, 0.8, 2], LV: [56.9, 24.6, 0.6, 2], EE: [58.7, 25.5, 0.6, 1.5],
  IL: [31.8, 34.9, 0.8, 0.3], EG: [29, 31, 2, 1.2], SA: [24, 45, 4, 6], MA: [32.5, -6.5, 2, 3],
  AE: [24.5, 54.7, 0.6, 1], IR: [33, 53, 4, 6], ID: [-6.5, 108, 2, 6], TH: [14.5, 101, 3, 2],
  VN: [16, 106.5, 5, 1.5], MY: [3.5, 102, 1.5, 1.5],
  // Regions that have their own language but no ISO country code
  CAT: [41.7, 1.8, 0.8, 1], EUS: [43.1, -2.4, 0.4, 0.8], GAL: [42.8, -8, 0.5, 0.7], WAL: [52.4, -3.7, 0.6, 0.7],
};
const REGION_NAMES = { CAT: "Catalonia", EUS: "Basque Country", GAL: "Galicia", WAL: "Wales" };

// Language -> where its speakers on Bluesky are likely to be (relative weights).
const LANGS = {
  en: { US: 46, GB: 13, CA: 9, AU: 6, IN: 4, IE: 2, NZ: 2, PH: 2, ZA: 1, NG: 1, SG: 1 },
  ja: { JP: 1 }, ko: { KR: 1 }, pt: { BR: 85, PT: 15 },
  es: { ES: 30, MX: 20, AR: 15, CO: 8, CL: 8, PE: 5, VE: 3, US: 6 },
  de: { DE: 80, AT: 10, CH: 10 }, fr: { FR: 75, CA: 12, BE: 8, CH: 5 },
  zh: { TW: 55, HK: 15, CN: 20, SG: 10 }, "zh-hant": { TW: 70, HK: 30 }, "zh-hans": { CN: 60, SG: 40 },
  it: { IT: 95, CH: 5 }, nl: { NL: 80, BE: 20 }, pl: { PL: 1 }, sv: { SE: 1 }, fi: { FI: 1 },
  no: { NO: 1 }, da: { DK: 1 }, is: { IS: 1 }, tr: { TR: 1 }, ru: { RU: 80, BY: 8, KZ: 7, UA: 5 },
  uk: { UA: 1 }, be: { BY: 1 }, kk: { KZ: 1 }, cs: { CZ: 1 }, sk: { SK: 1 }, hu: { HU: 1 },
  ro: { RO: 1 }, bg: { BG: 1 }, el: { GR: 1 }, sr: { RS: 1 }, hr: { HR: 1 }, sl: { SI: 1 },
  lt: { LT: 1 }, lv: { LV: 1 }, et: { EE: 1 }, he: { IL: 1 }, ar: { EG: 30, SA: 30, MA: 20, AE: 20 },
  fa: { IR: 1 }, hi: { IN: 1 }, id: { ID: 1 }, ms: { MY: 1 }, th: { TH: 1 }, vi: { VN: 1 },
  tl: { PH: 1 }, ca: { CAT: 1 }, eu: { EUS: 1 }, gl: { GAL: 1 }, cy: { WAL: 1 }, ga: { IE: 1 },
};
const LANG_ALIASES = { nb: "no", nn: "no", fil: "tl", iw: "he", in: "id" };

// ccTLDs that are mostly used as vanity domains, not as a country signal.
const VANITY_TLDS = new Set(["io", "co", "tv", "me", "ai", "fm", "gg", "ly", "sh", "am", "to", "ws",
  "cc", "nu", "im", "gy", "so", "la", "ag", "sx", "vc", "mu", "cx", "ms", "st", "is"]);

const regionNames = safeDisplayNames("region");
const langNames = safeDisplayNames("language");
function safeDisplayNames(type) {
  try { return new Intl.DisplayNames(["en"], { type }); } catch { return { of: (c) => c }; }
}
const placeName = (code) => REGION_NAMES[code] || regionNames.of(code) || code;
function langName(code) {
  if (code === "zh-hant") return "Chinese (Traditional)";
  if (code === "zh-hans") return "Chinese (Simplified)";
  try { return langNames.of(code) || code; } catch { return code; }
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~[-1, 1]
function spot(code) {
  const [lat, lng, dLat, dLng] = PLACES[code];
  return { lat: Math.max(-85, Math.min(85, lat + gauss() * dLat)), lng: lng + gauss() * dLng };
}
function weightedPick(weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) { if ((r -= weights[k]) <= 0) return k; }
  return Object.keys(weights)[0];
}

// Parse a BCP-47 tag into { key, region } where key indexes LANGS.
function parseLang(tag) {
  if (!tag) return null;
  const parts = String(tag).toLowerCase().split(/[-_]/);
  let base = LANG_ALIASES[parts[0]] || parts[0];
  const script = parts.slice(1).find((p) => p.length === 4);
  const region = parts.slice(1).find((p) => p.length === 2);
  if (base === "zh" && (script === "hant" || script === "hans")) base = `zh-${script}`;
  else if (base === "zh" && (region === "tw" || region === "hk")) base = "zh-hant";
  else if (base === "zh" && (region === "cn" || region === "sg")) base = "zh-hans";
  return { key: base, region: region ? region.toUpperCase().replace("UK", "GB") : null };
}

// The langs tag often reflects the poster's app/device language, not the text.
// A cheap second opinion: writing system first, then common-word voting for Latin script.
const SCRIPTS = [
  ["ja", /[぀-ヿ]/g], ["ko", /[가-힯ᄀ-ᇿ]/g], ["zh", /[一-鿿]/g],
  ["cyrl", /[Ѐ-ӿ]/g], ["arab", /[؀-ۿ]/g], ["he", /[֐-׿]/g],
  ["th", /[฀-๿]/g], ["hi", /[ऀ-ॿ]/g], ["el", /[Ͱ-Ͽ]/g],
];
const SCRIPT_LANGS = { cyrl: ["ru", "uk", "be", "bg", "sr", "kk"], arab: ["ar", "fa"] };
const STOPWORDS = {
  en: "the and is are you that this with have was for not what just my it's i'm don't they will",
  pt: "não nao você voce isso muito também uma com pra tá são já nós eu meu minha aqui dos foi tem tudo essa esse",
  es: "el los las del pero muy también yo hoy qué eso esto hay sí gracias mi ser una por",
  fr: "le les des est et pas une je vous nous c'est pour dans avec qui sur ce il elle j'ai",
  de: "der die und das ist nicht ich ein eine zu mit auf sie den auch wir",
  it: "il che non di per sono della è gli anche questo ho ma",
  nl: "de het een en van ik niet dat je op zijn met voor maar ook wat",
};
const STOPSETS = Object.fromEntries(Object.entries(STOPWORDS).map(([k, v]) => [k, new Set(v.split(" "))]));

function detectLang(text, taggedKey) {
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < 12) return null;
  for (const [key, re] of SCRIPTS) {
    const n = (text.match(re) || []).length;
    if (n / letters < 0.3) continue;
    if (key === "zh" && /[぀-ヿ]/.test(text)) return "ja";
    if (SCRIPT_LANGS[key]) return SCRIPT_LANGS[key].includes(taggedKey) ? taggedKey : SCRIPT_LANGS[key][0];
    return key;
  }
  const words = text.toLowerCase().split(/[^\p{L}']+/u);
  const score = {};
  for (const w of words) for (const k in STOPSETS) if (STOPSETS[k].has(w)) score[k] = (score[k] || 0) + 1;
  let best = null;
  for (const k in score) if (!best || score[k] > score[best]) best = k;
  if (!best || best === taggedKey) return null;
  const tagged = score[taggedKey] || 0;
  return score[best] >= 3 && score[best] >= 2 * tagged + 1 ? best : null;
}

// Decide where on the globe a post goes, and how confident we are.
function locate(langTag, text) {
  let p = parseLang(langTag);
  const detected = text ? detectLang(text, p && p.key) : null;
  if (detected && (!p || (detected !== p.key && !(detected === "zh" && p.key.startsWith("zh"))))) {
    const loc = locate(detected);
    if (!loc) return null;
    const single = Object.keys(LANGS[loc.lang]).length === 1;
    const where = single ? placeName(loc.country) : `${langName(loc.lang)} · spot is a guess`;
    return { ...loc, why: `${where} · language read from text` + (p ? ` (tagged ${langTag})` : "") };
  }
  if (!p) return null;
  if (p.region && PLACES[p.region]) {
    return { ...spot(p.region), tier: "known", country: p.region, lang: p.key,
      why: `${placeName(p.region)} · from language tag ${langTag}` };
  }
  const weights = LANGS[p.key];
  if (!weights) return null;
  const country = weightedPick(weights);
  const single = Object.keys(weights).length === 1;
  return { ...spot(country), tier: "guess", country, lang: p.key,
    why: single ? `${placeName(country)} · guessed from ${langName(p.key)}`
                : `${langName(p.key)} · spot on map is a guess` };
}

function countryFromHandle(handle) {
  if (!handle || handle.endsWith(".brid.gy") || handle === "handle.invalid") return null;
  const tld = handle.split(".").pop().toLowerCase();
  if (tld.length !== 2 || VANITY_TLDS.has(tld)) return null;
  const cc = tld === "uk" ? "GB" : tld.toUpperCase();
  return PLACES[cc] ? { cc, tld } : null;
}

// ---------------------------------------------------------------------------
// Globe
// ---------------------------------------------------------------------------
const AMBER = "255,180,84", CYAN = "95,224,255";
const IMG = "vendor/";
const world = new Globe(document.getElementById("globe"), {
  animateIn: true,
  // Hours of running: prefer the integrated GPU on dual-GPU laptops
  rendererConfig: { antialias: true, alpha: true, powerPreference: "low-power" },
})
  .globeImageUrl(IMG + "earth-night.jpg")
  .backgroundImageUrl(IMG + "night-sky.png")
  .atmosphereColor("#4a86d8")
  .atmosphereAltitude(0.18)
  .ringColor((d) => (t) => `rgba(${d.rgb},${(1 - t) * 0.9})`)
  .ringMaxRadius((d) => d.maxR)
  .ringPropagationSpeed((d) => d.speed || 2.6)
  .ringRepeatPeriod((d) => d.period || 5000)
  .ringAltitude(0.003)
  .pointsMerge(true)
  .pointResolution(4)  // the dots are ~2px; 4 sides look the same as 12 at a third of the geometry
  .pointAltitude(0.004)
  .pointRadius(0.16)
  .pointColor((d) => d.color)
  .pointsTransitionDuration(0)
  .htmlElement((d) => d.el)
  .htmlAltitude(0.01)
  .htmlTransitionDuration(0);

const controls = world.controls();
let rotateWanted = true; // what Space last asked for; selection pauses rotation on top of this
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enableDamping = true;
// I1: globe.gl's directional light, moved to where the sun is overhead right now (declination
// from the day of the year, longitude from UTC time), so the real night side reads as night
const sun = world.lights().find((l) => l.isDirectionalLight);
function placeSun() {
  if (!sun) return;
  const now = new Date();
  const day = (now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5;
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (day + 10));
  const longitude = (12 - now.getUTCHours() - now.getUTCMinutes() / 60) * 15;
  const { x, y, z } = world.getCoords(declination, longitude, 100);
  sun.position.set(x, y, z);
}
placeSun();
setInterval(placeSun, 60000);

// Full 2x pixel density costs 4x the fill for little visible gain on a moving globe
world.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

function angDist(a, b) {
  const r = Math.PI / 180;
  const s = Math.sin((b.lat - a.lat) * r / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) / r;
}

// Ripples for every placed post, plus a fading trail of dots.
// While the page is hidden nothing is drawn, so nothing is queued or rebuilt either.
let pendingRings = [], rings = [], dots = [];
setInterval(() => {
  const now = performance.now();
  rings = rings.concat(pendingRings).filter((r) => now - r.t < 1400);
  pendingRings = [];
  if (document.hidden) return;
  world.ringsData(selected ? rings.concat(selected.ring) : rings);
}, 200);
// The trail is one merged mesh that globe.gl rebuilds on every update, so update it sparingly
setInterval(() => {
  const now = performance.now();
  dots = dots.filter((d) => now - d.t < 45000);
  if (document.hidden) return;
  for (const d of dots) {
    const a = 0.85 * (1 - (now - d.t) / 45000) + 0.1;
    d.color = `rgba(${d.rgb},${a.toFixed(2)})`;
  }
  world.pointsData(dots);
}, 2000);

// ---------------------------------------------------------------------------
// Stats: posts/sec and a rolling 60-second count per language
// ---------------------------------------------------------------------------
let total = 0, secCount = 0;
const ppsWindow = [];
const langBuckets = [new Map()];
setInterval(() => {
  ppsWindow.push(secCount); secCount = 0;
  if (ppsWindow.length > 5) ppsWindow.shift();
  langBuckets.push(new Map());
  if (langBuckets.length > 60) langBuckets.shift();
  const pps = ppsWindow.reduce((a, b) => a + b, 0) / ppsWindow.length;
  document.getElementById("pps").textContent = pps.toFixed(1);
  document.getElementById("total").textContent = total.toLocaleString();
}, 1000);

function langCounts() {
  const m = new Map();
  for (const b of langBuckets) for (const [k, v] of b) m.set(k, (m.get(k) || 0) + v);
  return m;
}

// ---------------------------------------------------------------------------
// The ring of languages around the globe (the Twingly country ring, by language)
// ---------------------------------------------------------------------------
const canvas = document.getElementById("ring");
const ctx = canvas.getContext("2d");
let ringSlots = []; // [{ key, label, target, shown }]
let ringDirty = true, ringRadius = 0; // repaint only when a bar moves, the ranking changes or the view resizes

// Layout: feed column on the left, globe + ring centred in the space to its right.
const globeEl = document.getElementById("globe");
const feedEl = document.getElementById("feed");
const RING_ROOM = 135; // px kept around the globe for the language ring
function fitAltitude() {
  const w = world.width(), h = world.height();
  const avail = Math.max(60, Math.min(w, h) / 2 - RING_ROOM);
  const fov = world.camera().fov * Math.PI / 180;
  const theta = Math.atan((avail / (h / 2)) * Math.tan(fov / 2));
  return Math.max(1.3, Math.min(4, 1 / Math.sin(theta) - 1));
}
function fitFeedBottom() {
  feedEl.style.bottom = document.getElementById("legend").offsetHeight + 30 + "px";
}
function layout() {
  const side = innerWidth >= 700 ? Math.min(340, Math.round(innerWidth * 0.3)) : 0;
  const w = innerWidth - side, h = innerHeight;
  feedEl.style.display = side ? "" : "none";
  feedEl.style.width = side - 28 + "px";
  const brand = document.getElementById("brand"), legend = document.getElementById("legend");
  feedEl.style.top = brand.offsetTop + brand.offsetHeight + 14 + "px";
  fitFeedBottom();
  globeEl.style.left = side + "px";
  world.width(w).height(h);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.left = side + "px";
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ringDirty = true; // resizing the canvas cleared it
  const pov = world.pointOfView();
  world.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: fitAltitude() });
}
window.addEventListener("resize", layout);
world.pointOfView({ lat: 30, lng: -40 });
layout();

function rerankRing() {
  const counts = [...langCounts()].filter(([k]) => k !== "und").sort((a, b) => b[1] - a[1]).slice(0, 12);
  const prev = new Map(ringSlots.map((s) => [s.key, s]));
  ringSlots = counts.map(([key, n]) => ({ key, label: langName(key), target: n, shown: prev.get(key)?.shown || 0,
    pulseAt: prev.get(key)?.pulseAt || 0, glow: 0 }));
  ringDirty = true;
}
setInterval(rerankRing, 5000);
setInterval(() => { const c = langCounts(); for (const s of ringSlots) s.target = c.get(s.key) || 0; }, 1000);

function globeScreenRadius() {
  const alt = world.pointOfView().altitude;
  const theta = Math.asin(1 / (1 + alt));
  const fov = world.camera().fov * Math.PI / 180;
  return (world.height() / 2) * Math.tan(theta) / Math.tan(fov / 2);
}

// I3: a new card brightens its language's bar: a quick rise, then a slow ease out
const PULSE_MS = 1600;
function pulseRing(key) {
  const s = ringSlots.find((x) => x.key === key);
  const now = performance.now();
  if (!s || now - s.pulseAt < 5000) return;  // the same bar at most every 5 s
  s.pulseAt = now;
}
function glowAt(s, now) {
  const t = (now - s.pulseAt) / PULSE_MS;
  if (!(t >= 0 && t < 1)) return 0;
  return t < 0.12 ? t / 0.12 : (1 - (t - 0.12) / 0.88) ** 2;
}

// I4: in screensaver mode the view nods gently south and back (+35 to -25 latitude over
// about four minutes), so the southern hemisphere gets its turn
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const NOD_MS = 240000;
let nodding = false;
function nod(now) {
  if (interactive || reducedMotion.matches) { stopNod(); return; }
  const lat = 5 + 30 * Math.sin((now / NOD_MS) * 2 * Math.PI);
  const target = (90 - lat) * Math.PI / 180;      // the controls measure from the north pole
  const current = controls.getPolarAngle();
  controls.minPolarAngle = controls.maxPolarAngle = current + (target - current) * 0.02;
  nodding = true;
}
function stopNod() {
  if (!nodding) return;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  nodding = false;
}

function drawRing(now) {
  requestAnimationFrame(drawRing);
  nod(now);
  let moved = false;
  for (const s of ringSlots) {
    const glow = glowAt(s, now);
    if (glow !== s.glow) { s.glow = glow; moved = true; }
  }
  for (const s of ringSlots) {
    const d = s.target - s.shown;
    if (!d) continue;
    s.shown = Math.abs(d) < 0.05 ? s.target : s.shown + d * 0.08;
    moved = true;
  }
  const r = globeScreenRadius() + 16;
  if (!moved && !ringDirty && Math.abs(r - ringRadius) < 0.5) return;
  ringDirty = false;
  ringRadius = r;

  const w = world.width(), h = world.height(), cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  const room = Math.min(w, h) / 2 - r - 8;
  const maxLen = Math.max(18, Math.min(90, room - 55));
  ctx.strokeStyle = "rgba(140,170,210,.16)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  if (!ringSlots.length) return;

  const max = Math.max(1, ...ringSlots.map((s) => s.target));
  const n = ringSlots.length;
  ctx.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ringSlots.forEach((s, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const len = 4 + (s.shown / max) * maxLen;
    const x0 = cx + Math.cos(a) * (r + 4), y0 = cy + Math.sin(a) * (r + 4);
    const x1 = cx + Math.cos(a) * (r + 4 + len), y1 = cy + Math.sin(a) * (r + 4 + len);
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(${AMBER},.15)`); grad.addColorStop(1, `rgba(${AMBER},.95)`);
    if (s.glow) grad.addColorStop(1, `rgba(255,${180 + Math.round(60 * s.glow)},${84 + Math.round(120 * s.glow)},1)`);
    ctx.strokeStyle = grad; ctx.lineWidth = 5 + 2 * s.glow; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

    const lx = cx + Math.cos(a) * (r + 12 + len), ly = cy + Math.sin(a) * (r + 12 + len);
    const right = Math.cos(a) >= -0.01;
    ctx.textAlign = Math.abs(Math.cos(a)) < 0.2 ? "center" : right ? "left" : "right";
    ctx.textBaseline = Math.sin(a) < -0.8 ? "bottom" : Math.sin(a) > 0.8 ? "top" : "middle";
    ctx.fillStyle = `rgba(232,238,247,${(0.9 + 0.1 * s.glow).toFixed(2)})`;
    ctx.fillText(s.label, lx, ly);
    ctx.fillStyle = "rgba(138,150,168,.9)";
    const dy = ctx.textBaseline === "bottom" ? -13 : 13;
    ctx.fillText(`${Math.round(s.shown)}/min`, lx, ly + dy);
  });
}
requestAnimationFrame(drawRing);

// ---------------------------------------------------------------------------
// Post cards: sample posts, check moderation labels via the public AppView, show
// ---------------------------------------------------------------------------
const API = "https://public.api.bsky.app/xrpc/";
let showTitles = true;
const CHECK_BATCH = 8; // posts checked per round: about what the feed and cards can use
let reservoir = [], offered = 0;
const displayQueue = []; // checked posts waiting for a card on the globe
const feedQueue = [];    // checked posts waiting for the feed
let cards = [];

function offerCandidate(c) {
  offered++;
  if (reservoir.length < CHECK_BATCH) reservoir.push(c);
  else { const j = Math.floor(Math.random() * offered); if (j < CHECK_BATCH) reservoir[j] = c; }
}

setInterval(() => {
  const batch = reservoir; reservoir = []; offered = 0;
  if (!batch.length || feedQueue.length >= 10) return; // enough waiting already
  // Wait a little so the AppView has indexed the posts and applied labels
  // Wait so the AppView has indexed the posts and Bluesky's automatic labelers have had time to act
  setTimeout(() => checkBatch(batch), 15000);
}, 3000);

async function checkBatch(batch) {
  const qs = batch.map((c) => "uris=" + encodeURIComponent(c.uri)).join("&");
  let posts;
  try {
    const res = await fetch(API + "app.bsky.feed.getPosts?" + qs);
    if (!res.ok) return;
    posts = (await res.json()).posts || [];
  } catch { return; }
  const byUri = new Map(posts.map((p) => [p.uri, p]));
  const center = world.pointOfView();
  for (const c of batch) {
    const p = byUri.get(c.uri);
    if (!p) continue;
    // Anything carrying a moderation label (on the post or the account) is skipped,
    // including accounts that asked not to be shown to logged-out viewers.
    if ((p.labels && p.labels.length) || (p.author.labels && p.author.labels.length)) continue;
    if (looksAdult(p.author.displayName) || looksAdult(p.author.handle) ||
        looksAdult(p.embed?.external?.uri) || looksAdult(p.embed?.media?.external?.uri)) continue;
    const item = { ...c, handle: p.author.handle, name: p.author.displayName || "", added: performance.now() };
    const fromHandle = countryFromHandle(p.author.handle);
    if (fromHandle) {
      item.loc = { ...spot(fromHandle.cc), tier: "known",
        why: `${placeName(fromHandle.cc)} · from handle domain .${fromHandle.tld}` };
    }
    // Front-facing posts are candidates for a globe card; the rest go to the feed
    if (angDist(item.loc, center) < 70 && displayQueue.length <= 15) displayQueue.push(item);
    else feedQueue.push(item);
  }
  if (feedQueue.length > 30) feedQueue.splice(0, feedQueue.length - 30);
}

// Moderation labels often arrive late (or never) for spam and promo accounts, so a blunt
// multilingual word filter backs them up. It errs toward hiding: this runs unattended.
// Whole words only (JavaScript's \b only knows ASCII, so use letter lookarounds instead)
const wholeWords = (words) => String.raw`(?<![\p{L}\p{N}])(?:${words})(?![\p{L}\p{N}])`;
const ADULT_RE = new RegExp([
  wholeWords(String.raw`nsfw|porn\p{L}*|xxx|nudes?|nudity|naked|onlyfans|fansly|hentai|r-?18|18\+|sex\p{L}*|horny|explicit|camgirls?|escorts?|fetish\p{L}*|lewd|erotic\p{L}*|boobs?|tits|cock|dick|pussy|milf|blowjob|handjob|cum(?:shot|s)?|masturbat\p{L}*|orgasm\p{L}*|creampie|bdsm|thots?|adult (?:content|videos?|fiction|works?|films?)`),
  wholeWords(String.raw`desnud\p{L}*|tesão|putas?|putaria|safad[ao]s?|conte[uú]do adulto|contenido para adultos|nackt|geil|baise|порно|секс|интим`),
  // Japanese, Chinese, Korean: no word gaps to rely on
  "成人向け|18禁|R-?18|エロ|アダルト|AV女優|FANZA|裏垢|オフパコ|エッチ|えっち|オナニー|フェラ|まんこ|ちんぽ|ちんこ|射精|中出し|パイズリ|潮吹き|無修正|巨乳|爆乳|乳首|痴女|痴漢|セフレ|淫",
  "色情|约炮|約炮|福利姬|成人影片|做爱|做愛|自慰|口交|裸聊|黄片",
  "야동|19금|성인용|섹스|자위|야한",
  // Adult stores and sites, in the text or in links
  String.raw`dlsite|fanza|dmm\.co\.jp|onlyfans\.com|fansly|pornhub|xvideos|xhamster|xnxx|chaturbate|stripchat|manyvids|redtube|youporn|spankbang|eporner|missav|erome`,
].join("|"), "iu");
const looksAdult = (s) => !!s && ADULT_RE.test(s);

// Every link a post carries: link facets in the text and a link-preview card
function postLinks(rec) {
  const uris = [rec.embed?.external?.uri, rec.embed?.media?.external?.uri];
  for (const f of Array.isArray(rec.facets) ? rec.facets : []) {
    for (const feature of Array.isArray(f.features) ? f.features : []) uris.push(feature.uri);
  }
  return uris.filter((u) => typeof u === "string").join(" ");
}

function hideItem(item) {
  item.hidden = true;
  item.feedEl?.remove();
  for (const q of [displayQueue, feedQueue]) { const i = q.indexOf(item); if (i >= 0) q.splice(i, 1); }
  if (selected && selected.item === item) deselect();
  if (cards.includes(item)) { cards = cards.filter((c) => c !== item); refreshHtml(); }
}

function truncate(s, n) {
  const chars = [...s.replace(/\s+/g, " ").trim()];
  return chars.length > n ? chars.slice(0, n - 1).join("") + "…" : chars.join("");
}

// Name, text and "where" lines shared by globe cards and feed items.
// Each rendering is remembered on the item so a translation can be filled in when it arrives.
function postBody(item, box, maxChars) {
  const who = document.createElement("div");
  who.className = "who";
  const strong = document.createElement("strong");
  strong.textContent = item.name ? truncate(item.name, 28) : "";
  who.append(strong, document.createTextNode((item.name ? "  " : "") + "@" + item.handle));
  const txt = document.createElement("div");
  txt.className = "txt";
  txt.dir = "auto";
  txt.textContent = truncate(item.text, maxChars);
  const orig = document.createElement("div");
  orig.className = "orig";
  orig.dir = "auto";
  const where = document.createElement("div");
  where.className = "where";
  where.textContent = item.loc.why;
  const trnote = document.createElement("span");
  trnote.className = "trnote";
  where.append(trnote);
  box.append(who, txt, orig, where);
  (item.views ||= []).push({ box, txt, orig, trnote, maxChars });
  if (item.translation) applyTranslation(item);
  else requestTranslation(item);
}

function makeCard(item, isSelected) {
  const pin = document.createElement("div");
  pin.className = "pin " + (isSelected ? "sel" : item.loc.tier);
  const card = document.createElement("div");
  card.className = "card";
  postBody(item, card, 140);
  pin.append(card);
  card.addEventListener("click", () => {
    window.open(`https://bsky.app/profile/${encodeURIComponent(item.did)}/post/${encodeURIComponent(item.rkey)}`,
      "_blank", "noopener,noreferrer");
  });
  return pin;
}

// ---------------------------------------------------------------------------
// Feed: a slow chat-like stream down the left; click an entry to find it on the globe
// ---------------------------------------------------------------------------
let feedHover = false, nextFeedAt = 0;
feedEl.addEventListener("mouseenter", () => { feedHover = true; });
feedEl.addEventListener("mouseleave", () => { feedHover = false; });

// I5: resting the pointer on a feed entry sends one pink ripple from its spot, if it's in view
let hoverTimer = null;
function hoverLocate(item) {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (!interactive || angDist(item.loc, world.pointOfView()) >= 80) return;
    pendingRings.push({ lat: item.loc.lat, lng: item.loc.lng, rgb: PINK, maxR: 4, speed: 3.5, t: performance.now() });
  }, 150);
}

function addToFeed(item) {
  const el = document.createElement("div");
  el.className = "fitem " + item.loc.tier;
  postBody(item, el, 180);
  el.addEventListener("click", () => select(item));
  el.addEventListener("mouseenter", () => hoverLocate(item));
  el.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
  item.feedEl = el;
  // Follow new posts unless the viewer has scrolled up to read older ones
  const atBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 40;
  feedEl.append(el);
  while (feedEl.children.length > 60) feedEl.firstElementChild.remove();
  if (!interactive || atBottom) feedEl.scrollTop = feedEl.scrollHeight;
}

setInterval(() => {
  const now = performance.now();
  if (feedHover || now < nextFeedAt) return;
  // Feed posts that weren't picked for globe cards, oldest first; fall back to the card queue
  const item = feedQueue.shift() || (displayQueue.length > 6 ? displayQueue.shift() : null);
  if (!item) return;
  addToFeed(item);
  nextFeedAt = now + 1100 + Math.random() * 1300;
  // Start translating the next one so it's usually ready when it slides in
  if (feedQueue[0]) requestTranslation(feedQueue[0]);
}, 250);

// ---------------------------------------------------------------------------
// Translation: an optional extra. Nothing downloads until the viewer installs it from the
// Translation panel; it can be uninstalled there without removing Murmuration.
// Models run in a worker (translator.js); the install plan lives in translate-plan.js.
// ---------------------------------------------------------------------------
const userLang = parseLang(navigator.language || "en")?.key || "en";
const trStatus = document.getElementById("trStatus");
const MODEL_CACHE = "transformers-cache";
let extras = readPref("murmuration.extras", "none") === "installed" ? "installed" : "none"; // none | installing | installed | failed
let trEnabled = extras === "installed" && readPref("murmuration.translate", "on") === "on";
let trWorker = null, trReady = false, trSeq = 0;
let trStorageBytes = 0, installProgress = 0, installError = "", confirmingUninstall = false;
const trPending = new Map(); // id -> item
let trPlan = null; // [{ name, mb, label }] or null if the viewer's language isn't supported
const planReady = import("./translate-plan.js").then((mod) => {
  trPlan = mod.plan(userLang, langName);
  return mod;
}).catch(() => null);

function readPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try {
    if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
}

const ENGINE_MB = 6; // Transformers.js and its runtime
const planMB = () => (trPlan || []).reduce((n, m) => n + m.mb, 0) + ENGINE_MB;

function setTrStatus(text, progress) {
  trStatus.textContent = "";
  trStatus.append(document.createTextNode(text));
  if (progress != null) {
    const bar = document.createElement("span");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = Math.round(progress * 100) + "%";
    bar.append(fill);
    trStatus.append(bar, document.createTextNode(Math.round(progress * 100) + "%"));
  }
}

function showTrStatus() {
  document.getElementById("trKey").hidden = extras !== "installed";
  document.getElementById("trState").textContent = trEnabled ? "on" : "off";
  if (extras === "installing") setTrStatus("installing translation", installProgress);
  else if (extras !== "installed") setTrStatus("");
  else if (!trEnabled) setTrStatus("translation off");
  else setTrStatus(`translating into ${langName(userLang)}` +
    (trStorageBytes ? ` · ${Math.round(trStorageBytes / 1e6)} MB` : ""));
}

function startTranslator() {
  if (trWorker) return;
  try {
    trWorker = new Worker("translator.js", { type: "module" });
  } catch {
    installFailed("This browser can't run the translator.");
    return;
  }
  trWorker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "ready") {
      trReady = true;
      if (extras === "installing") trWorker.postMessage({ type: "install" });
    } else if (m.type === "install-progress") {
      installProgress = m.total ? m.loaded / m.total : 0;
      renderExtras();
    } else if (m.type === "installed") {
      extras = "installed";
      writePref("murmuration.extras", "installed");
      setTranslate(true);
      renderExtras();
    } else if (m.type === "install-failed") {
      installFailed(m.message);
    } else if (m.type === "storage") {
      trStorageBytes = m.bytes;
      renderExtras();
    } else if (m.type === "result") {
      const item = trPending.get(m.id);
      trPending.delete(m.id);
      if (!item) return;
      // A phrase repeating itself is the classic sign of a made-up translation: keep the original
      if (!m.text || /\b(\w+ \w+ \w+ \w+)\b.*\b\1\b/i.test(m.text)) { item.trState = "failed"; return; }
      if (looksAdult(m.text)) { hideItem(item); return; }
      item.translation = m.text;
      item.trState = "done";
      applyTranslation(item);
    }
  };
  trWorker.onerror = () => installFailed("The translator couldn't start.");
  trWorker.postMessage({ type: "init", tgt: userLang });
}

function stopTranslator() {
  trWorker?.terminate();
  trWorker = null;
  trReady = false;
  trPending.clear();
}

function installExtras() {
  extras = "installing";
  installProgress = 0;
  installError = "";
  stopTranslator();
  startTranslator();
  renderExtras();
}

function installFailed(message) {
  stopTranslator();
  extras = "failed";
  installError = message || "";
  renderExtras();
}

// Removes every translation file this page stored; Murmuration itself keeps working
async function uninstallExtras() {
  stopTranslator();
  try {
    await caches.delete(MODEL_CACHE);
  } catch { /* storage unavailable */ }
  writePref("murmuration.extras", null);
  writePref("murmuration.translate", null);
  extras = "none";
  trStorageBytes = 0;
  confirmingUninstall = false;
  setTranslate(false);
  renderExtras();
}

function requestTranslation(item) {
  if (!trEnabled || !trReady || item.trState) return;
  const base = (k) => k.split("-")[0];
  if (!item.loc.lang || base(item.loc.lang) === base(userLang)) { item.trState = "skip"; return; }
  // Links, hashtags and mentions don't translate; leave them out
  const text = item.text.replace(/https?:\/\/\S+|[#@][^\s#@]+/g, "").replace(/\s+/g, " ").trim();
  if ((text.match(/\p{L}/gu) || []).length < 6) { item.trState = "skip"; return; }
  const id = ++trSeq;
  item.trState = "pending";
  trPending.set(id, item);
  trWorker.postMessage({ type: "translate", id, text, src: item.loc.lang, tgt: userLang });
}

function applyTranslation(item) {
  if (!item.translation) return;
  for (const v of item.views || []) {
    v.txt.textContent = truncate(item.translation, v.maxChars);
    v.orig.textContent = truncate(item.text, v.maxChars);
    const lang = langName(item.loc.lang);
    v.trnote.textContent = item.loc.why.includes(lang) ? " · translated" : ` · translated from ${lang}`;
    v.box.classList.add("has-tr");
  }
}

function setTranslate(on) {
  trEnabled = on && extras === "installed";
  document.body.classList.toggle("no-tr", !trEnabled);
  if (extras === "installed") startTranslator();
  showTrStatus();
}

// --- The Translation panel ---------------------------------------------------
const extrasPanel = document.getElementById("extrasPanel");

function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "onclick") node.addEventListener("click", v);
    else if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...kids.filter((k) => k != null));
  return node;
}
const button = (label, cls, onclick) => el("button", { class: "btn " + (cls || ""), type: "button", onclick }, label);

function renderExtras() {
  showTrStatus();
  if (extrasPanel.hidden) return;
  const lang = langName(userLang);
  const body = [el("h2", { id: "extrasTitle" }, "Translation extra")];

  if (!trPlan) {
    body.push(el("p", {}, `Translation into ${lang} isn't available yet.`),
      el("div", { class: "actions" }, button("Close", "", closePanel)));
  } else if (extras === "installed") {
    const mb = trStorageBytes ? Math.round(trStorageBytes / 1e6) : planMB();
    const toggle = el("input", { type: "checkbox", id: "trToggle" });
    toggle.checked = trEnabled;
    toggle.addEventListener("change", () => {
      setTranslate(toggle.checked);
      writePref("murmuration.translate", trEnabled ? "on" : "off");
    });
    body.push(
      el("p", {}, `Installed. Posts in other languages are translated into ${lang} on this computer.`),
      el("label", { class: "toggle", for: "trToggle" }, toggle, "Translate posts (or press L)"),
      el("p", { class: "note" }, `Using ${mb} MB of storage. Hover over a translated post to see the original.`));
    if (confirmingUninstall) {
      body.push(el("p", {}, `Remove the translation models and free ${mb} MB? Murmuration keeps working; posts will show in their original language.`),
        el("div", { class: "actions" },
          button("Keep it", "", () => { confirmingUninstall = false; renderExtras(); }),
          button("Uninstall", "danger", uninstallExtras)));
    } else {
      body.push(el("div", { class: "actions" },
        button("Uninstall extra", "danger", () => { confirmingUninstall = true; renderExtras(); }),
        button("Done", "primary", closePanel)));
    }
  } else if (extras === "installing") {
    const fill = el("i");
    fill.style.width = Math.round(installProgress * 100) + "%";
    body.push(
      el("p", {}, `Downloading ${Math.round(installProgress * planMB())} of about ${planMB()} MB…`),
      el("div", { class: "progress" }, fill),
      el("p", { class: "note" }, "You can close this panel; the download carries on in the background."),
      el("div", { class: "actions" },
        button("Cancel", "", uninstallExtras),
        button("Hide", "primary", closePanel)));
  } else {
    const rows = trPlan.map((m) => el("tr", {}, el("td", {}, m.label), el("td", { class: "mb" }, `${m.mb} MB`)));
    rows.push(el("tr", {}, el("td", {}, "Translation engine (Transformers.js)"), el("td", { class: "mb" }, `${ENGINE_MB} MB`)));
    rows.push(el("tr", { class: "total" }, el("td", {}, "Total"), el("td", { class: "mb" }, `about ${planMB()} MB`)));
    body.push(
      el("p", {}, `Translates posts in other languages into ${lang}, right on this computer. ` +
        "It uses free, open-source Opus-MT models from the University of Helsinki: no account, no API key, and post text never leaves your machine."),
      el("p", {}, "What gets downloaded and stored:"),
      el("table", {}, ...rows),
      el("p", { class: "note" }, "Nothing else is downloaded later. Languages without their own model use the shared one. " +
        "You can uninstall the extra here at any time without removing Murmuration."));
    if (extras === "failed") body.push(el("p", {}, "The last install didn't finish" + (installError ? `: ${installError}` : ".")));
    body.push(el("div", { class: "actions" },
      button("Not now", "", closePanel),
      button(`Install (${planMB()} MB)`, "primary", installExtras)));
  }
  extrasPanel.replaceChildren(...body);
}

// --- Panels --------------------------------------------------------------------
const overlay = document.getElementById("overlay");
const helpPanel = document.getElementById("helpPanel");

function openPanel(which) {
  overlay.hidden = false;
  helpPanel.hidden = which !== "help";
  extrasPanel.hidden = which !== "extras";
  confirmingUninstall = false;
  if (which === "extras") planReady.then(renderExtras);
  else helpPanel.querySelector("button")?.focus();
}
function closePanel() {
  overlay.hidden = true;
  helpPanel.hidden = true;
  extrasPanel.hidden = true;
}
overlay.addEventListener("click", (e) => {
  if (e.target === overlay || e.target.hasAttribute("data-close")) closePanel();
});

// Not installed means nothing stored: clear leftovers from an interrupted install
if (extras === "none") {
  try { caches.delete(MODEL_CACHE); } catch { /* storage unavailable */ }
}
setTranslate(trEnabled);

// ---------------------------------------------------------------------------
// Selection: pink, centred, pinned until deselected
// ---------------------------------------------------------------------------
const PINK = "255,95,162";
let selected = null;

function select(item) {
  if (selected && selected.item === item) { deselect(); return; }
  if (selected) selected.item.feedEl?.classList.remove("sel");
  item.feedEl?.classList.add("sel");
  const { lat, lng } = item.loc;
  selected = {
    item, lat, lng,
    el: makeCard(item, true),
    ring: { lat, lng, rgb: PINK, maxR: 6, speed: 4, period: 900 },
  };
  // Clear the area: no duplicate of this post, and no ordinary cards crowding it
  cards = cards.filter((c) => c !== item && angDist(c, item.loc) > 25);
  refreshHtml();
  controls.autoRotate = false;
  world.pointOfView({ lat, lng, altitude: world.pointOfView().altitude }, 1400);
}

function deselect() {
  if (!selected) return;
  selected.item.feedEl?.classList.remove("sel");
  selected = null;
  controls.autoRotate = rotateWanted;
  refreshHtml();
}

function refreshHtml() {
  world.htmlElementsData(selected ? cards.concat(selected) : cards.slice());
}

setInterval(() => {
  const now = performance.now();
  // Drop stale queue entries and expired cards
  for (let i = displayQueue.length - 1; i >= 0; i--) if (now - displayQueue[i].added > 40000) displayQueue.splice(i, 1);
  const before = cards.length;
  cards = cards.filter((c) => now - c.shownAt < 9000);
  let changed = cards.length !== before;

  if (showTitles && cards.length < 5 && displayQueue.length) {
    // Pick the queued post nearest the middle of the view that doesn't crowd a visible card
    let best = -1, bestD = 1e9;
    const center = world.pointOfView();
    const taken = cards.concat(selected || []).map((c) => world.getScreenCoords(c.lat, c.lng, 0.01));
    displayQueue.forEach((it, i) => {
      const d = angDist(it.loc, center);
      if (d > 60) return;
      // Cards sit above their pin (~260 x 90px); keep them on screen and apart
      const s = world.getScreenCoords(it.loc.lat, it.loc.lng, 0.01);
      if (s.x < 140 || s.x > world.width() - 140 || s.y < 130) return;
      if (taken.some((t) => Math.abs(t.x - s.x) < 270 && Math.abs(t.y - s.y) < 115)) return;
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      const item = displayQueue.splice(best, 1)[0];
      item.lat = item.loc.lat; item.lng = item.loc.lng;
      item.el = makeCard(item);
      item.shownAt = now;
      cards.push(item);
      pulseRing(item.loc.lang);
      changed = true;
    }
  }
  if (changed) refreshHtml();
}, 1700);

// ---------------------------------------------------------------------------
// Jetstream (the firehose as JSON)
// ---------------------------------------------------------------------------
const JETSTREAMS = [
  "jetstream2.us-east.bsky.network", "jetstream1.us-east.bsky.network",
  "jetstream1.us-west.bsky.network", "jetstream2.us-west.bsky.network",
];
let hostIdx = 0, ws = null, retryMs = 1000, retryTimer = null;
let lastMessageAt = 0, paused = false, hiddenTimer = null;
const connEl = document.getElementById("conn"), connText = document.getElementById("connText");

function connect() {
  clearTimeout(retryTimer);
  const host = JETSTREAMS[hostIdx % JETSTREAMS.length];
  connEl.className = ""; connText.textContent = `connecting to ${host}…`;
  const sock = new WebSocket(`wss://${host}/subscribe?wantedCollections=app.bsky.feed.post`);
  ws = sock;
  // Events from a socket we've already replaced are ignored
  sock.onopen = () => {
    if (ws !== sock) return;
    retryMs = 1000; lastMessageAt = performance.now();
    connEl.className = "on"; connText.textContent = "live";
  };
  sock.onmessage = (ev) => {
    if (ws !== sock) return;
    lastMessageAt = performance.now();
    try { onEvent(JSON.parse(ev.data)); } catch { /* ignore malformed */ }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (paused) return;
    connEl.className = "off"; connText.textContent = "reconnecting…";
    hostIdx++;
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 30000);
  };
}

function dropSocket() {
  const sock = ws;
  ws = null;
  if (sock) { sock.onopen = sock.onmessage = sock.onclose = null; try { sock.close(); } catch { /* already closed */ } }
}

// A connection can go quiet without ever closing; after 30s of silence, start a fresh one
setInterval(() => {
  if (paused || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (performance.now() - lastMessageAt > 30000) { dropSocket(); hostIdx++; connect(); }
}, 10000);

// Nobody watching: after a minute hidden, stop the stream (about 50 KB/s); resume at once when shown
document.addEventListener("visibilitychange", () => {
  clearTimeout(hiddenTimer);
  if (document.hidden) {
    hiddenTimer = setTimeout(() => {
      paused = true;
      clearTimeout(retryTimer);
      dropSocket();
      connEl.className = ""; connText.textContent = "paused while hidden";
    }, 60000);
  } else if (paused) {
    paused = false;
    retryMs = 1000;
    connect();
  }
});

// did:plc / did:web identifiers and record keys, per the AT Protocol specs
const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]{1,2000}$/;
const RKEY_RE = /^[A-Za-z0-9._~:-]{1,512}$/;

function onEvent(m) {
  if (m.kind !== "commit") return;
  const c = m.commit;
  if (!c || c.operation !== "create" || c.collection !== "app.bsky.feed.post" || !c.record) return;
  // Stream data is untrusted: identifiers must match the AT Protocol formats before they're
  // used in links, and text must be a string
  if (!DID_RE.test(m.did || "") || !RKEY_RE.test(c.rkey || "")) return;
  const rec = c.record;
  if (typeof rec.text !== "string") return;
  total++; secCount++;

  const tag = Array.isArray(rec.langs) && rec.langs[0];
  const loc = locate(tag, rec.text);
  const bucket = langBuckets[langBuckets.length - 1];
  const key = loc ? loc.lang : (parseLang(tag)?.key || "und");
  bucket.set(key, (bucket.get(key) || 0) + 1);
  if (!loc) return;

  const rgb = loc.tier === "known" ? CYAN : AMBER;
  const t = performance.now();
  pendingRings.push({ lat: loc.lat, lng: loc.lng, rgb, maxR: loc.tier === "known" ? 3 : 2.2, t });
  dots.push({ lat: loc.lat, lng: loc.lng, rgb, t, color: `rgba(${rgb},.9)` });

  const text = rec.text.trim();
  const selfLabeled = rec.labels && Array.isArray(rec.labels.values) && rec.labels.values.length;
  if (!rec.reply && !selfLabeled && text.length >= 25 && text.length <= 300 &&
      !looksAdult(text) && !looksAdult(postLinks(rec))) {
    offerCandidate({ uri: `at://${m.did}/app.bsky.feed.post/${c.rkey}`, did: m.did, rkey: c.rkey, text, loc });
  }
}
connect();

// ---------------------------------------------------------------------------
// Modes: screensaver (look only) and interactive (spin, click, scroll)
// ---------------------------------------------------------------------------
let interactive = false, iaTimer = null;
const IA_TIMEOUT = 120000; // back to screensaver after 2 minutes without input

function setInteractive(on) {
  interactive = on;
  document.body.classList.toggle("interactive", on);
  fitFeedBottom();
  if (on) {
    stopNod();
    if (readPref("murmuration.helpSeen", "") !== "yes") {
      openPanel("help");
      writePref("murmuration.helpSeen", "yes");
    }
  } else {
    deselect();
    closePanel();
    feedEl.scrollTop = feedEl.scrollHeight;
  }
  bumpActivity();
}

function bumpActivity() {
  clearTimeout(iaTimer);
  if (interactive) iaTimer = setTimeout(() => setInteractive(false), IA_TIMEOUT);
}

document.getElementById("explore").addEventListener("click", () => setInteractive(true));
document.getElementById("btnExit").addEventListener("click", () => setInteractive(false));
document.getElementById("btnHelp").addEventListener("click", () => openPanel("help"));
document.getElementById("btnExtras").addEventListener("click", () => openPanel("extras"));
document.getElementById("btnQuit").addEventListener("click", () => tellHost("exit"));

// ---------------------------------------------------------------------------
// Keys and idle cursor
// ---------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  bumpActivity();
  const isE = (e.key === "e" || e.key === "E") && !EXPLORE_ELSEWHERE;
  if (HOST === "screensaver" && !interactive && overlay.hidden && !isE) {
    tellHost("exit");
    return;
  }
  if (!overlay.hidden) {
    if (e.key === "Escape") closePanel();
    return; // keys belong to the open panel
  }
  if (e.key === "f" || e.key === "F") {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  } else if (e.key === "t" || e.key === "T") {
    showTitles = !showTitles;
    document.getElementById("titlesState").textContent = showTitles ? "on" : "off";
    if (!showTitles) { cards = []; displayQueue.length = 0; refreshHtml(); }
  } else if (e.key === " ") {
    rotateWanted = !rotateWanted;
    controls.autoRotate = rotateWanted && !selected;
    e.preventDefault();
  } else if (e.key === "Escape") {
    deselect();
  } else if (e.key === "l" || e.key === "L") {
    if (extras === "installed") {
      setTranslate(!trEnabled);
      writePref("murmuration.translate", trEnabled ? "on" : "off");
    } else if (interactive) {
      openPanel("extras");
    }
  } else if (isE) {
    if (!interactive) setInteractive(true);
  } else if (!interactive && HOST !== "screensaver" && isPlainKey(e)) {
    setInteractive(true);  // the app and the browser: any key with no other job explores
  }
});
// A key someone presses to do something, not a modifier, shortcut or system key
function isPlainKey(e) {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !/^(Shift|Control|Alt|Meta|Tab|CapsLock|F\d+)$/.test(e.key);
}
let idleTimer;
function wake() {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
  bumpActivity();
}
window.addEventListener("mousedown", (e) => {
  if (interactive || !overlay.hidden) return;
  if (HOST === "screensaver") { if (!e.target.closest("#explore")) tellHost("exit"); }
  else setInteractive(true);
});
for (const ev of ["mousemove", "mousedown", "wheel", "touchstart"]) {
  window.addEventListener(ev, wake, { passive: true });
}

// The app (not the screensaver) opens ready to explore
if (HOST === "app") setInteractive(true);
