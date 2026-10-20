// What the optional translation extra installs, and which model each post goes through.
// Shared by the page (to describe the download before anything is fetched) and the worker.

// Browser-ready Opus-MT models (Xenova/opus-mt-*) out of English
const FROM_EN = new Set("af ar cs da de es fi fr hi hu id it jap nl ro ru sv uk vi zh".split(" "));
const ROMANCE = new Set(["pt", "es", "fr", "it", "ca", "gl", "ro"]);
const SRC_CODE = { "zh-hans": "zh", "zh-hant": "zh" };
const TGT_CODE = { ja: "jap", "zh-hans": "zh", "zh-hant": "zh" };
// Targets reached through a multi-target model need a language token
const ROMANCE_TOKEN = { pt: ">>pt<<", ca: ">>ca<<", gl: ">>gl<<" };
const MUL_TOKEN = { ko: ">>kor<<", tr: ">>tur<<", pl: ">>pol<<", el: ">>ell<<", he: ">>heb<<",
  no: ">>nob<<", fa: ">>pes<<", th: ">>tha<<", bg: ">>bul<<", sk: ">>slk<<", hr: ">>hrv<<",
  sr: ">>srp_Cyrl<<", sl: ">>slv<<", lt: ">>lit<<", lv: ">>lav<<", et: ">>est<<", ms: ">>zsm_Latn<<",
  tl: ">>tgl_Latn<<", be: ">>bel<<", kk: ">>kaz_Cyrl<<", eu: ">>eus<<", cy: ">>cym<<", ga: ">>gle<<",
  is: ">>isl<<", bn: ">>ben<<", ta: ">>tam<<", ur: ">>urd<<", sw: ">>swh<<", ne: ">>npi<<", eo: ">>epo<<" };

// Dedicated models for Bluesky's biggest non-English languages; everything else uses the
// shared many-languages model. Sizes are the q8 downloads, in MB.
export const CATCH_ALL = "mul-en";
const DEDICATED = {
  "ja-en": { mb: 115, label: "Japanese" },
  "ROMANCE-en": { mb: 119, label: "Portuguese, Spanish, French, Italian, Catalan" },
  "de-en": { mb: 112, label: "German" },
  "ko-en": { mb: 120, label: "Korean" },
  "zh-en": { mb: 119, label: "Chinese" },
};
export const ENGINE_MB = 6;

function toEnglishIdeal(src) {
  const code = SRC_CODE[src] || src;
  if (ROMANCE.has(code)) return "ROMANCE-en";
  return DEDICATED[`${code}-en`] ? `${code}-en` : CATCH_ALL;
}

function fromEnglish(tgt) {
  const code = TGT_CODE[tgt] || tgt;
  if (FROM_EN.has(code)) return { model: `en-${code}`, prefix: "" };
  if (ROMANCE_TOKEN[tgt]) return { model: "en-ROMANCE", prefix: ROMANCE_TOKEN[tgt] + " " };
  if (MUL_TOKEN[tgt]) return { model: "en-mul", prefix: MUL_TOKEN[tgt] + " " };
  return null;
}

// Everything the extra installs for a viewer whose language is `tgt`, or null if unsupported
export function plan(tgt, langName) {
  const own = toEnglishIdeal(tgt);
  const models = Object.entries(DEDICATED)
    .filter(([name]) => name !== own)
    .map(([name, m]) => ({ name, mb: m.mb, label: m.label }));
  models.push({ name: CATCH_ALL, mb: 118, label: "All other languages (shared model, rougher)" });
  if (tgt !== "en") {
    const out = fromEnglish(tgt);
    if (!out) return null;
    models.push({ name: out.model, mb: 115, label: `English into ${langName ? langName(tgt) : tgt}` });
  }
  return models;
}

// Steps from `src` to `tgt`, using only models in the installed plan
export function route(src, tgt, installed) {
  const steps = [];
  if (src !== "en") {
    const ideal = toEnglishIdeal(src);
    steps.push({ model: installed.has(ideal) ? ideal : CATCH_ALL, prefix: "" });
  }
  if (tgt !== "en") {
    const out = fromEnglish(tgt);
    if (!out) return null;
    steps.push(out);
  }
  return steps;
}
