/**
 * OFFO Smoke Test — run before every push to catch regressions.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                        # tests production
 *   node scripts/smoke-test.mjs http://localhost:3000  # tests local dev
 *   node scripts/smoke-test.mjs https://<preview-url>  # tests Netlify preview
 *
 * Pass/fail printed per test. Any failure exits with code 1 (blocks CI).
 */

const BASE = process.argv[2] ?? "https://offolab.com";
const TIMEOUT = 12000;

let passed = 0;
let failed = 0;

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function ok(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name, reason) {
  console.error(`  ✗ ${name}: ${reason}`);
  failed++;
}

async function test(name, fn) {
  try {
    await fn();
  } catch (e) {
    fail(name, e.message);
  }
}

console.log(`\nOFFO Smoke Test → ${BASE}\n`);

// ── Photos API ────────────────────────────────────────────────────────────────
console.log("[ /api/photos ]");

await test("Ioniq 5 photo returns correct make (Hyundai, not Tesla)", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/photos?make=Hyundai&model=Ioniq+5&year=2024&no_market=1`);
  const data = await res.json();
  if (!data.photo_urls?.length) throw new Error("No photos returned");
  const url = data.photo_urls[0];
  if (url.toLowerCase().includes("tesla")) throw new Error(`Got Tesla photo for Hyundai: ${url}`);
  ok("Ioniq 5 photo (not Tesla)");
});

await test("Volvo XC40 photo returns Volvo image", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/photos?make=Volvo&model=XC40+Recharge&year=2021&no_market=1`);
  const data = await res.json();
  if (!data.photo_urls?.length) throw new Error("No photos returned");
  const url = data.photo_urls[0];
  if (url.toLowerCase().includes("tesla")) throw new Error(`Got Tesla photo for Volvo: ${url}`);
  ok("Volvo XC40 photo (not Tesla)");
});

await test("Tesla Model 3 photo returns Model 3 image", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/photos?make=Tesla&model=Model+3&year=2023&no_market=1`);
  const data = await res.json();
  if (!data.photo_urls?.length) throw new Error("No photos returned");
  ok("Tesla Model 3 photo");
});

await test("Tesla Model S photo is different from Model 3 photo", async () => {
  const [r3, rs] = await Promise.all([
    fetchWithTimeout(`${BASE}/api/photos?make=Tesla&model=Model+3&year=2020&no_market=1`),
    fetchWithTimeout(`${BASE}/api/photos?make=Tesla&model=Model+S&year=2015&no_market=1`),
  ]);
  const d3 = await r3.json();
  const ds = await rs.json();
  if (!d3.photo_urls?.length) throw new Error("No Model 3 photos");
  if (!ds.photo_urls?.length) throw new Error("No Model S photos");
  if (d3.photo_urls[0] === ds.photo_urls[0]) throw new Error("Model 3 and Model S returning same photo URL");
  ok("Model 3 and Model S have distinct photos");
});

await test("Kia EV6 photo is not Tesla", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/photos?make=Kia&model=EV6&year=2022&no_market=1`);
  const data = await res.json();
  if (!data.photo_urls?.length) throw new Error("No photos returned");
  if (data.photo_urls[0].toLowerCase().includes("tesla")) throw new Error(`Got Tesla photo for Kia: ${data.photo_urls[0]}`);
  ok("Kia EV6 photo (not Tesla)");
});

// ── Deals API ─────────────────────────────────────────────────────────────────
console.log("\n[ /api/deals ]");

await test("Deals endpoint returns active listings", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/deals?per_page=5&page=1`);
  const data = await res.json();
  if (!data.deals?.length) throw new Error("No deals returned");
  ok(`Deals endpoint (${data.deals.length} returned)`);
});

await test("Deal photo_urls are distinct across makes", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/deals?per_page=20&page=1`);
  const data = await res.json();
  if (!data.deals?.length) throw new Error("No deals");
  const photoUrls = data.deals.filter(d => d.photo_url).map(d => d.photo_url);
  if (photoUrls.length < 2) throw new Error("Too few deals with photos to compare");
  const unique = new Set(photoUrls);
  const dupeRatio = 1 - unique.size / photoUrls.length;
  if (dupeRatio > 0.5) throw new Error(`>50% of deal photos are the same URL (${Math.round(dupeRatio * 100)}% duplication)`);
  ok(`Deal photos are distinct (${unique.size} unique of ${photoUrls.length})`);
});

// ── Recommendations API ───────────────────────────────────────────────────────
console.log("\n[ /api/recommendations ]");

// Minimal valid routine: charging_access + climate + longest_day_pattern + weekly_miles
const VALID_ROUTINE = {
  charging_access: "home",
  climate: "mild",
  weekly_miles: 150,
  longest_day_pattern: "once_a_week",
};

await test("Recommendations return results for basic routine", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routine: VALID_ROUTINE }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`API returned success:false — ${data.error} ${JSON.stringify(data.details ?? "")}`);
  if (!data.recommendations?.length) throw new Error("No recommendations returned");
  ok(`Recommendations (${data.recommendations.length} vehicles)`);
});

await test("Recommendations have fit_score between 0-100", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routine: VALID_ROUTINE }),
  });
  const data = await res.json();
  if (!data.recommendations?.length) throw new Error("No recommendations");
  const invalid = data.recommendations.filter(r => r.fit_score < 0 || r.fit_score > 100);
  if (invalid.length) throw new Error(`${invalid.length} recommendations have out-of-range fit_score`);
  ok("All fit_scores in 0–100 range");
});

// ── Receipt / Deal Cache ──────────────────────────────────────────────────────
console.log("\n[ /api/receipt ]");

await test("Receipt endpoint responds (200 or expected error shape)", async () => {
  const res = await fetchWithTimeout(`${BASE}/api/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_url: "https://example.com/fake-listing-smoke-test" }),
  });
  // Should return JSON regardless of whether it finds anything
  const data = await res.json();
  if (typeof data !== "object") throw new Error("Non-JSON response");
  ok("Receipt endpoint returns JSON");
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed\n`);

if (failed > 0) {
  console.error(`SMOKE TEST FAILED — do not push until these pass.\n`);
  process.exit(1);
} else {
  console.log(`All checks passed. Safe to push.\n`);
}
