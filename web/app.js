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
// Only the two values the Mac screensaver sends count (never inherited names like "constructor")
const exploreParam = new URLSearchParams(location.search).get("explore");
const EXPLORE_ELSEWHERE = exploreParam === "app" ? "To explore, open the Murmuration app"
  : exploreParam === "install" ? "To explore, install the Murmuration app" : "";
if (EXPLORE_ELSEWHERE) {
  document.body.classList.add("explore-" + exploreParam);
  document.querySelector("#exploreBox .hint-app").textContent = EXPLORE_ELSEWHERE;
}
// Following one language (interactive only, never saved): its ring key, or null for everyone
let focus = null, focusShownAt = 0, hoverKey = null;
// Exact key, except bare "zh" also takes Traditional and Simplified
const matchesFocus = (k) => !focus || k === focus || (focus === "zh" && typeof k === "string" && k.startsWith("zh"));

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

// Where people in each country actually are: its big cities as [lat, lng, weight], weighted
// roughly by metro size, a little more where Bluesky is popular (the Bay Area, Seattle, Austin).
// Most guessed posts land on one of these; the rest spread over the country as before.
const CITIES = {
  US: [[40.71, -74.01, 20], [34.05, -118.24, 13], [37.77, -122.42, 5], [37.80, -122.27, 2.5], [37.34, -121.89, 2.5],
    [41.88, -87.63, 9], [38.91, -77.04, 6], [42.36, -71.06, 5], [47.61, -122.33, 5], [39.95, -75.17, 6],
    [32.78, -96.80, 6], [29.76, -95.37, 6], [33.75, -84.39, 5], [25.76, -80.19, 5], [33.45, -112.07, 4],
    [39.74, -104.99, 3], [30.27, -97.74, 3], [45.52, -122.68, 3], [44.98, -93.27, 3], [42.33, -83.05, 3],
    [32.72, -117.16, 3], [36.16, -86.78, 2], [40.44, -79.99, 2], [38.63, -90.20, 2], [35.23, -80.84, 2],
    [35.78, -78.64, 2], [40.76, -111.89, 1.5], [36.17, -115.14, 2], [28.54, -81.38, 2], [29.95, -90.07, 1],
    [39.10, -94.58, 1.5], [39.96, -83.00, 1.5], [39.29, -76.61, 2], [38.58, -121.49, 2], [21.31, -157.86, 1]],
  CA: [[43.65, -79.38, 6], [45.50, -73.57, 4], [49.28, -123.12, 3], [51.05, -114.07, 1.5], [53.55, -113.49, 1.4],
    [45.42, -75.70, 1.4], [49.90, -97.14, 0.8], [46.81, -71.21, 0.8], [44.65, -63.58, 0.5]],
  MX: [[19.43, -99.13, 9], [20.67, -103.35, 3], [25.69, -100.32, 3], [19.04, -98.21, 1.5], [32.51, -117.04, 1.2],
    [21.12, -101.68, 1], [20.59, -100.39, 0.8], [20.97, -89.62, 0.6]],
  GB: [[51.51, -0.13, 9], [53.48, -2.24, 2.8], [52.49, -1.89, 2.6], [55.86, -4.25, 1.8], [53.80, -1.55, 1.8],
    [53.41, -2.98, 1.4], [51.45, -2.59, 1.1], [55.95, -3.19, 1], [54.98, -1.61, 1], [53.38, -1.47, 0.9],
    [52.95, -1.15, 0.8], [54.60, -5.93, 0.7], [50.82, -0.14, 0.6]],
  IE: [[53.35, -6.26, 2], [51.90, -8.47, 0.4], [53.27, -9.05, 0.2], [52.66, -8.63, 0.2]],
  AU: [[-33.87, 151.21, 5], [-37.81, 144.96, 5], [-27.47, 153.03, 2.5], [-31.95, 115.86, 2], [-34.93, 138.60, 1.3],
    [-28.02, 153.40, 0.7], [-35.28, 149.13, 0.5], [-42.88, 147.33, 0.3]],
  NZ: [[-36.85, 174.76, 1.7], [-41.29, 174.78, 0.4], [-43.53, 172.64, 0.4]],
  IN: [[28.61, 77.21, 3], [19.08, 72.88, 3], [12.97, 77.59, 2.5], [17.39, 78.49, 1.5], [13.08, 80.27, 1.5],
    [22.57, 88.36, 1.5], [18.52, 73.86, 1.2], [23.02, 72.57, 1]],
  PH: [[14.60, 120.98, 4], [10.32, 123.89, 0.8], [7.19, 125.46, 0.5]],
  ZA: [[-26.20, 28.05, 3], [-33.92, 18.42, 2], [-29.86, 31.02, 1], [-25.75, 28.19, 1]],
  NG: [[6.52, 3.38, 4], [9.08, 7.40, 1.5], [7.38, 3.94, 0.6], [4.82, 7.03, 0.6]],
  JP: [[35.68, 139.69, 14], [34.69, 135.50, 5], [35.18, 136.91, 2.5], [35.44, 139.64, 2], [33.59, 130.40, 1.5],
    [43.06, 141.35, 1.5], [35.01, 135.77, 1], [34.69, 135.20, 1], [38.27, 140.87, 0.8], [34.39, 132.46, 0.7],
    [26.21, 127.68, 0.4]],
  KR: [[37.57, 126.98, 10], [35.18, 129.08, 2], [37.46, 126.71, 1.5], [35.87, 128.60, 1.2], [36.35, 127.38, 0.8],
    [35.16, 126.85, 0.7]],
  TW: [[25.03, 121.57, 5], [22.63, 120.30, 1.5], [24.15, 120.67, 1.5], [22.99, 120.21, 0.8]],
  CN: [[39.90, 116.41, 4], [31.23, 121.47, 4], [23.13, 113.26, 2.5], [22.54, 114.06, 2.5], [30.66, 104.07, 1.5],
    [29.56, 106.55, 1.3], [30.59, 114.31, 1.2], [30.27, 120.16, 1.2], [34.34, 108.94, 1], [32.06, 118.80, 1]],
  BR: [[-23.55, -46.63, 10], [-22.91, -43.17, 6], [-19.92, -43.94, 2.5], [-15.79, -47.88, 2], [-30.03, -51.23, 2],
    [-25.43, -49.27, 1.8], [-8.05, -34.88, 1.8], [-12.97, -38.50, 1.8], [-3.73, -38.53, 1.6], [-1.46, -48.50, 1],
    [-3.12, -60.02, 1], [-16.69, -49.26, 1], [-27.60, -48.55, 0.8]],
  PT: [[38.72, -9.14, 3], [41.15, -8.61, 1.5], [41.55, -8.42, 0.3], [40.21, -8.43, 0.3], [37.02, -7.93, 0.2]],
  ES: [[40.42, -3.70, 6], [41.39, 2.17, 3], [39.47, -0.38, 1.5], [37.39, -5.98, 1.3], [43.26, -2.93, 0.8],
    [36.72, -4.42, 0.8], [41.65, -0.89, 0.7], [39.57, 2.65, 0.4], [28.12, -15.43, 0.5]],
  AR: [[-34.60, -58.38, 8], [-31.42, -64.18, 1.5], [-32.95, -60.65, 1.2], [-32.89, -68.83, 0.9], [-34.92, -57.95, 0.6]],
  CO: [[4.71, -74.07, 4], [6.24, -75.58, 2], [3.45, -76.53, 1.3], [10.96, -74.80, 1]],
  CL: [[-33.45, -70.67, 6], [-33.05, -71.62, 0.8], [-36.83, -73.05, 0.8]],
  PE: [[-12.05, -77.04, 8], [-16.41, -71.54, 0.8], [-8.11, -79.03, 0.6]],
  VE: [[10.48, -66.90, 4], [10.65, -71.64, 1.5], [10.16, -68.00, 1.2]],
  DE: [[52.52, 13.40, 5], [53.55, 9.99, 2.5], [48.14, 11.58, 2.5], [50.94, 6.96, 2], [50.11, 8.68, 1.5],
    [48.78, 9.18, 1.2], [51.23, 6.77, 1], [51.51, 7.47, 1], [51.46, 7.01, 1], [51.34, 12.37, 0.8],
    [51.05, 13.74, 0.7], [52.38, 9.73, 0.7], [49.45, 11.08, 0.7], [53.08, 8.80, 0.6]],
  AT: [[48.21, 16.37, 4], [47.07, 15.44, 0.7], [48.31, 14.29, 0.5], [47.81, 13.04, 0.4], [47.27, 11.40, 0.3]],
  CH: [[47.38, 8.54, 2], [46.20, 6.14, 1], [47.56, 7.59, 0.8], [46.95, 7.45, 0.7], [46.52, 6.63, 0.6]],
  FR: [[48.86, 2.35, 9], [45.76, 4.84, 2], [43.30, 5.37, 2], [43.60, 1.44, 1.4], [50.63, 3.06, 1.2],
    [44.84, -0.58, 1.2], [43.70, 7.27, 1], [47.22, -1.55, 1], [48.57, 7.75, 0.8], [43.61, 3.88, 0.8],
    [48.11, -1.68, 0.7]],
  BE: [[50.85, 4.35, 2.5], [51.22, 4.40, 1.2], [51.05, 3.72, 0.7], [50.63, 5.57, 0.6]],
  NL: [[52.37, 4.90, 3], [51.92, 4.48, 1.5], [52.08, 4.30, 1.2], [52.09, 5.12, 1.2], [51.44, 5.47, 0.7],
    [53.22, 6.57, 0.5]],
  IT: [[41.90, 12.50, 4], [45.46, 9.19, 4], [40.85, 14.27, 2.5], [45.07, 7.69, 1.5], [44.49, 11.34, 1],
    [43.77, 11.26, 1], [38.12, 13.36, 1], [41.12, 16.87, 0.8], [44.41, 8.93, 0.8], [45.44, 12.32, 0.7],
    [37.50, 15.09, 0.6]],
  PL: [[52.23, 21.01, 3], [50.06, 19.94, 1.5], [50.26, 19.02, 1.2], [51.11, 17.04, 1], [54.35, 18.65, 1],
    [51.76, 19.46, 0.9], [52.41, 16.93, 0.9]],
  SE: [[59.33, 18.07, 4], [57.71, 11.97, 1.5], [55.60, 13.00, 1], [59.86, 17.64, 0.5]],
  NO: [[59.91, 10.75, 3], [60.39, 5.32, 0.8], [63.43, 10.40, 0.5], [58.97, 5.73, 0.5]],
  DK: [[55.68, 12.57, 3], [56.16, 10.20, 0.8], [55.40, 10.39, 0.5], [57.05, 9.92, 0.4]],
  FI: [[60.17, 24.94, 3], [61.50, 23.76, 0.8], [60.45, 22.27, 0.6], [65.01, 25.47, 0.4]],
  IS: [[64.15, -21.94, 3], [65.68, -18.09, 0.3]],
  TR: [[41.01, 28.98, 8], [39.93, 32.86, 3], [38.42, 27.14, 2], [40.19, 29.06, 1], [36.90, 30.71, 1]],
  RU: [[55.76, 37.62, 8], [59.93, 30.36, 3.5], [55.01, 82.93, 1], [56.84, 60.61, 1], [55.80, 49.11, 0.8],
    [56.33, 44.00, 0.8], [45.04, 38.98, 0.7], [53.20, 50.15, 0.7], [43.12, 131.89, 0.4]],
  UA: [[50.45, 30.52, 4], [49.99, 36.23, 1.5], [46.48, 30.72, 1.2], [49.84, 24.03, 1.2], [48.46, 35.05, 1]],
  BY: [[53.90, 27.56, 4], [52.44, 30.98, 0.5], [52.10, 23.69, 0.3]],
  KZ: [[43.24, 76.95, 3], [51.17, 71.45, 2], [42.32, 69.60, 0.8]],
  CZ: [[50.08, 14.44, 3], [49.20, 16.61, 1], [49.82, 18.26, 0.5]],
  SK: [[48.15, 17.11, 2], [48.72, 21.26, 0.6]],
  HU: [[47.50, 19.04, 4], [47.53, 21.63, 0.4], [46.25, 20.15, 0.3]],
  RO: [[44.43, 26.10, 4], [46.77, 23.59, 1], [45.76, 21.23, 0.6], [47.16, 27.59, 0.6]],
  BG: [[42.70, 23.32, 3], [42.14, 24.75, 0.6], [43.21, 27.91, 0.5]],
  GR: [[37.98, 23.73, 5], [40.64, 22.94, 1.5], [38.25, 21.73, 0.3], [35.34, 25.14, 0.3]],
  RS: [[44.79, 20.45, 3], [45.27, 19.83, 0.7], [43.32, 21.90, 0.4]],
  HR: [[45.81, 15.98, 2.5], [43.51, 16.44, 0.6], [45.33, 14.44, 0.4], [45.55, 18.69, 0.3]],
  SI: [[46.06, 14.51, 2], [46.55, 15.65, 0.5]],
  LT: [[54.69, 25.28, 2], [54.90, 23.89, 0.8], [55.70, 21.14, 0.3]],
  LV: [[56.95, 24.11, 3], [55.87, 26.54, 0.3]],
  EE: [[59.44, 24.75, 2.5], [58.38, 26.72, 0.5]],
  IL: [[32.09, 34.78, 3], [31.77, 35.21, 1.5], [32.79, 34.99, 1]],
  EG: [[30.04, 31.24, 8], [31.20, 29.92, 2]],
  SA: [[24.71, 46.68, 4], [21.49, 39.19, 3], [21.39, 39.86, 1], [26.43, 50.10, 1]],
  MA: [[33.57, -7.59, 3], [34.02, -6.84, 1.2], [31.63, -8.01, 1], [34.03, -5.00, 0.8], [35.76, -5.83, 0.8]],
  AE: [[25.20, 55.27, 3], [24.45, 54.38, 1.5], [25.35, 55.42, 0.8]],
  IR: [[35.69, 51.39, 5], [36.30, 59.61, 1.2], [32.65, 51.67, 1], [29.59, 52.58, 0.8], [38.08, 46.29, 0.7]],
  ID: [[-6.21, 106.85, 6], [-7.25, 112.75, 1.5], [-6.91, 107.61, 1.5], [3.59, 98.67, 1], [-7.80, 110.36, 0.7],
    [-8.65, 115.22, 0.5], [-5.15, 119.43, 0.5]],
  TH: [[13.76, 100.50, 8], [18.79, 98.98, 0.8], [12.93, 100.88, 0.4], [7.88, 98.39, 0.3], [16.43, 102.84, 0.3]],
  VN: [[10.82, 106.63, 4], [21.03, 105.85, 3.5], [16.05, 108.22, 0.8], [20.86, 106.68, 0.5]],
  MY: [[3.14, 101.69, 4], [5.41, 100.33, 0.8], [1.49, 103.74, 0.8], [5.98, 116.07, 0.3], [1.55, 110.36, 0.3]],
  CAT: [[41.39, 2.17, 5], [41.98, 2.82, 0.4], [41.12, 1.25, 0.4], [41.62, 0.62, 0.3]],
  EUS: [[43.26, -2.93, 2], [43.32, -1.98, 0.8], [42.85, -2.67, 0.6]],
  GAL: [[42.24, -8.72, 0.8], [43.36, -8.41, 0.8], [42.88, -8.54, 0.5]],
  WAL: [[51.48, -3.18, 2], [51.62, -3.94, 0.6], [51.58, -3.00, 0.4], [53.23, -4.13, 0.2]],
};
const CITY_SHARE = 0.85;  // the share of guessed posts that land in a city
const CITY_SPREAD = 0.35; // degrees of scatter around a city, so it glows as a cluster

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
  const cities = CITIES[code];
  if (cities && Math.random() < CITY_SHARE) {
    let r = Math.random() * cities.reduce((n, c) => n + c[2], 0);
    const [lat, lng] = cities.find((c) => (r -= c[2]) <= 0) || cities[0];
    const dLng = CITY_SPREAD / Math.max(0.2, Math.cos(lat * Math.PI / 180)); // same distance east-west
    return { lat: lat + gauss() * CITY_SPREAD, lng: lng + gauss() * dLng };
  }
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
// The tag is whatever the poster's app sent, so only a well-formed one counts.
const LANG_TAG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
function parseLang(tag) {
  if (!tag || !LANG_TAG_RE.test(String(tag).replace(/_/g, "-"))) return null;
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
  // A language the app doesn't know counts as untagged: its code would otherwise reach the
  // screen (on the ring and in "from language tag …"), and the poster chooses it
  if (p && !LANGS[p.key]) p = null;
  const detected = text ? detectLang(text, p && p.key) : null;
  if (detected && (!p || (detected !== p.key && !(detected === "zh" && p.key.startsWith("zh"))))) {
    const loc = locate(detected);
    if (!loc) return null;
    const single = Object.keys(LANGS[loc.lang]).length === 1;
    const where = single ? placeName(loc.country) : `${langName(loc.lang)} · spot is a guess`;
    return { ...loc, why: `${where} · language read from text` + (p ? ` (tagged ${langName(p.key)})` : "") };
  }
  if (!p) return null;
  if (p.region && PLACES[p.region]) {
    return { ...spot(p.region), tier: "known", country: p.region, lang: p.key,
      why: `${placeName(p.region)} · from language tag ${p.key.split("-")[0]}-${p.region}` };
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
// The slow spin pauses while a post is selected or a language is followed
const updateSpin = () => { controls.autoRotate = rotateWanted && !selected && !focus; };
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
  const shown = focus ? rings.filter((r) => !r.lang || matchesFocus(r.lang)) : rings;  // pink ripples have no lang
  world.ringsData(selected ? shown.concat(selected.ring) : shown);
}, 200);
// The trail is one merged mesh that globe.gl rebuilds on every update, so update it sparingly
setInterval(() => {
  const now = performance.now();
  dots = dots.filter((d) => now - d.t < 45000);
  if (!document.hidden) refreshDots(now);
}, 2000);
function refreshDots(now = performance.now()) {
  const shown = focus ? dots.filter((d) => matchesFocus(d.lang)) : dots;
  for (const d of shown) {
    const a = 0.85 * (1 - (now - d.t) / 45000) + 0.1;
    d.color = `rgba(${d.rgb},${a.toFixed(2)})`;
  }
  world.pointsData(shown);
}

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
  if (focus) showFocusLine();
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
function fitFeedTop() {
  const brand = document.getElementById("brand"), line = document.getElementById("focusLine");
  const top = brand.offsetTop + brand.offsetHeight + 14;
  line.style.top = top + "px";
  feedEl.style.top = top + (line.hidden ? 0 : line.offsetHeight + 8) + "px";
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
  fitFeedTop();
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
  const all = [...langCounts()].filter(([k]) => k !== "und").sort((a, b) => b[1] - a[1]);
  let counts = all.slice(0, 12);
  if (focus && !counts.some(([k]) => k === focus)) {
    counts = all.slice(0, 11).concat([all.find(([k]) => k === focus) || [focus, 0]]);
  }
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

// F1: a label block (name and n/min) as a click target, padded to at least 44 x 28 px
function labelRect(lx, ly, dy, width) {
  const x = ctx.textAlign === "left" ? lx : ctx.textAlign === "right" ? lx - width : lx - width / 2;
  const top = ctx.textBaseline === "bottom" ? ly + dy - 12 : ctx.textBaseline === "top" ? ly : ly - 7;
  const height = ctx.textBaseline === "middle" ? 27 : 26;
  const w = Math.max(44, width + 8), h = Math.max(28, height + 4);
  return { x: x + width / 2 - w / 2, y: top + height / 2 - h / 2, w, h };
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
    const count = `${Math.round(s.shown)}/min`;
    const focused = focus === s.key, dim = focus && !focused ? 0.45 : 1;
    const lit = focused || hoverKey === s.key || s.glow;
    ctx.fillStyle = focused ? `rgba(${PINK},1)` : `rgba(232,238,247,${((lit ? 1 : 0.9) * dim).toFixed(2)})`;
    ctx.fillText(s.label, lx, ly);
    ctx.fillStyle = `rgba(138,150,168,${(0.9 * dim).toFixed(2)})`;
    const dy = ctx.textBaseline === "bottom" ? -13 : 13;
    ctx.fillText(count, lx, ly + dy);
    s.rect = LANGS[s.key] ? labelRect(lx, ly, dy, Math.max(ctx.measureText(s.label).width, ctx.measureText(count).width)) : null;
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
  if (!matchesFocus(c.lang)) return;  // following one language: collect only that one
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
    if (!matchesFocus(c.lang)) continue;  // the focus may have changed while the batch waited
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
// Disguised words: invisible characters, full-width or styled letters, marks stacked on
// letters, and Cyrillic or Greek letters that look Latin. The text is checked as written
// (which keeps the Cyrillic words working), with those stripped, and with the look-alikes
// swapped for Latin letters. Best effort: Bluesky's labels remain the main check.
const LOOKALIKES = {
  "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
  "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "һ": "h", "ԁ": "d",
  "α": "a", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKES).join("")}]`, "gu");
function looksAdult(s) {
  if (!s) return false;
  const plain = String(s).normalize("NFKC").toLowerCase().replace(/[\p{Cf}\p{M}]/gu, "");
  return ADULT_RE.test(s) || ADULT_RE.test(plain) ||
    ADULT_RE.test(plain.replace(LOOKALIKE_RE, (c) => LOOKALIKES[c]));
}

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
  where.textContent = truncate(item.loc.why, 90);
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
  el.dataset.lang = item.lang;
  if (focus) focusShownAt = performance.now();
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

const ENGINE_MB = 26; // Transformers.js (0.6 MB) and ONNX Runtime, mostly its 25.6 MB WebAssembly core
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
  if (!item.lang || base(item.lang) === base(userLang)) { item.trState = "skip"; return; }
  // Links, hashtags and mentions don't translate; leave them out
  const text = item.text.replace(/https?:\/\/\S+|[#@][^\s#@]+/g, "").replace(/\s+/g, " ").trim();
  if ((text.match(/\p{L}/gu) || []).length < 6) { item.trState = "skip"; return; }
  const id = ++trSeq;
  item.trState = "pending";
  trPending.set(id, item);
  trWorker.postMessage({ type: "translate", id, text, src: item.lang, tgt: userLang });
}

function applyTranslation(item) {
  if (!item.translation) return;
  for (const v of item.views || []) {
    v.txt.textContent = truncate(item.translation, v.maxChars);
    v.orig.textContent = truncate(item.text, v.maxChars);
    const lang = langName(item.lang);
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
  updateSpin();
  world.pointOfView({ lat, lng, altitude: world.pointOfView().altitude }, 1400);
}

function deselect() {
  if (!selected) return;
  selected.item.feedEl?.classList.remove("sel");
  selected = null;
  updateSpin();
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
      pulseRing(item.lang);
      if (focus) focusShownAt = performance.now();
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
  const tagKey = parseLang(tag)?.key;
  const key = loc ? loc.lang : (LANGS[tagKey] ? tagKey : "und");  // the ring shows known languages only
  bucket.set(key, (bucket.get(key) || 0) + 1);
  if (!loc) return;

  const rgb = loc.tier === "known" ? CYAN : AMBER;
  const t = performance.now();
  pendingRings.push({ lat: loc.lat, lng: loc.lng, rgb, maxR: loc.tier === "known" ? 3 : 2.2, t, lang: loc.lang });
  dots.push({ lat: loc.lat, lng: loc.lng, rgb, t, color: `rgba(${rgb},.9)`, lang: loc.lang });

  const text = rec.text.trim();
  const selfLabeled = rec.labels && Array.isArray(rec.labels.values) && rec.labels.values.length;
  if (!rec.reply && !selfLabeled && text.length >= 25 && text.length <= 300 &&
      !looksAdult(text) && !looksAdult(postLinks(rec))) {
    offerCandidate({ uri: `at://${m.did}/app.bsky.feed.post/${c.rkey}`, did: m.did, rkey: c.rkey, text, loc, lang: loc.lang });
  }
}
connect();

// ---------------------------------------------------------------------------
// Following one language from the ring
// ---------------------------------------------------------------------------
// Where a language lives: the weighted mean of its countries as 3D unit vectors, which,
// unlike averaging latitudes and longitudes, doesn't break across the date line
function langCentre(key) {
  const weights = LANGS[key];
  if (!weights) return null;
  let x = 0, y = 0, z = 0;
  const r = Math.PI / 180;
  for (const [code, wgt] of Object.entries(weights)) {
    const [lat, lng] = PLACES[code];
    x += wgt * Math.cos(lat * r) * Math.cos(lng * r);
    y += wgt * Math.cos(lat * r) * Math.sin(lng * r);
    z += wgt * Math.sin(lat * r);
  }
  return { lat: Math.atan2(z, Math.hypot(x, y)) / r, lng: Math.atan2(y, x) / r };
}

function setFocus(key) {
  if (key === focus) return;
  focus = key;
  focusShownAt = performance.now();
  if (focus) {
    for (const q of [displayQueue, feedQueue]) {
      for (let i = q.length - 1; i >= 0; i--) if (!matchesFocus(q[i].lang)) q.splice(i, 1);
    }
    reservoir = reservoir.filter((c) => matchesFocus(c.lang));
    offered = reservoir.length;
    const centre = langCentre(focus);
    if (centre) world.pointOfView({ ...centre, altitude: world.pointOfView().altitude }, 1400);
  }
  // Restored or hidden entries change the feed's height: stay at the newest post if that's where we were
  const atBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 40;
  for (const el of feedEl.children) el.classList.toggle("off", !matchesFocus(el.dataset.lang));
  if (atBottom) feedEl.scrollTop = feedEl.scrollHeight;
  const before = cards.length;
  cards = cards.filter((c) => matchesFocus(c.lang));
  if (cards.length !== before) refreshHtml();
  updateSpin();
  refreshDots();
  rerankRing();
  showFocusLine();
}

function showFocusLine() {
  const line = document.getElementById("focusLine");
  const wasHidden = line.hidden;
  line.hidden = !focus;
  if (focus) {
    const waiting = performance.now() - focusShownAt > 20000;
    document.getElementById("focusText").textContent = `${langName(focus)} only${waiting ? ", waiting for posts" : ""}`;
  }
  if (line.hidden !== wasHidden) fitFeedTop();
}
document.getElementById("focusClear").addEventListener("click", () => setFocus(null));

// F2: a ring label is a click target only for a real click: same label at press and release,
// under 6 px of movement, under 600 ms, one pointer. Anything else is a drag of the globe.
function slotAt(e) {
  const box = canvas.getBoundingClientRect();
  const x = e.clientX - box.left, y = e.clientY - box.top;
  return ringSlots.find((s) => s.rect && x >= s.rect.x && x <= s.rect.x + s.rect.w &&
    y >= s.rect.y && y <= s.rect.y + s.rect.h) || null;
}
let press = null;
globeEl.addEventListener("pointerdown", (e) => {
  if (press && performance.now() - press.t > 1000) press = null;  // its release never arrived
  if (press) { press.multi = true; return; }
  if (!interactive || !overlay.hidden || e.target.closest(".card")) return;
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), key: slotAt(e)?.key, multi: false };
}, true);
globeEl.addEventListener("pointerup", (e) => {
  if (!press || e.pointerId !== press.id) return;
  const p = press;
  press = null;
  if (!p.key || p.multi || !interactive) return;
  if (Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 6 || performance.now() - p.t >= 600) return;
  if (slotAt(e)?.key !== p.key) return;
  if (selected) deselect();
  setFocus(p.key === focus ? null : p.key);
}, true);
globeEl.addEventListener("pointercancel", () => { press = null; }, true);
// A release outside the globe, or leaving the window mid-press, ends the press too
window.addEventListener("pointerup", (e) => { if (press && e.pointerId === press.id) press = null; });
window.addEventListener("blur", () => { press = null; });
// Hover: a pointer cursor and a brighter label
globeEl.addEventListener("mousemove", (e) => {
  const key = interactive && overlay.hidden ? slotAt(e)?.key || null : null;
  if (key === hoverKey) return;
  hoverKey = key;
  globeEl.style.cursor = key ? "pointer" : "";
  ringDirty = true;
});

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
    setFocus(null);
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
    updateSpin();
    e.preventDefault();
  } else if (e.key === "Escape") {
    if (selected) deselect(); else if (focus) setFocus(null);
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
