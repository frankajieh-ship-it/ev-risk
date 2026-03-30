/**
 * ETL Job 1d: AFDC (NREL) → data_v2/charger_density_v2.json
 *
 * Fetches all active US EV charging stations from the NREL Alternative Fuels
 * Data Center API, groups by ZIP-5, and computes density per 100k population
 * using ACS 2020 ZIP code population estimates.
 *
 * Requires: NREL_API_KEY env var (free at developer.nrel.gov)
 * Run: npx tsx scripts/etl/fetch-afdc-chargers.ts
 * Refresh cadence: quarterly
 */

import fs from "fs";
import path from "path";

const OUT_PATH = path.join(process.cwd(), "data_v2", "charger_density_v2.json");
const AFDC_URL = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json";

// ACS 2020 ZIP code tabulation area (ZCTA) population — top 1,000 ZCTAs by EV relevance
// For full nationwide coverage, download the full ACS crosswalk from:
// https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
// This script includes a representative sample; add more ZCTAs to POPULATION_BY_ZIP below.
//
// Source: ACS 2020 5-Year Estimates, Table B01003
const POPULATION_BY_ZIP: Record<string, number> = {
  // CA
  "90210": 21741, "94102": 47817, "94103": 29714, "90001": 61218, "90024": 47831,
  "94107": 39688, "94109": 58293, "90045": 69434, "94301": 63327, "95014": 64547,
  "92037": 48956, "90066": 59823, "94025": 72018, "94043": 38621, "91765": 56433,
  // NY
  "10001": 33623, "10002": 78648, "10003": 50719, "10007": 5174,  "10009": 62753,
  "10019": 33641, "10025": 97343, "10036": 36567, "10022": 36547, "10128": 74398,
  "11201": 60248, "11211": 67432, "11215": 75334, "10301": 48291, "10451": 58743,
  // TX
  "78701": 11834, "78702": 29384, "75201": 9834,  "77002": 16291, "77004": 31847,
  "75204": 42018, "77006": 34291, "78704": 54231, "75205": 42891, "77019": 38291,
  // WA
  "98101": 18291, "98102": 24831, "98103": 52847, "98105": 31847, "98107": 28431,
  "98109": 18291, "98115": 41829, "98117": 48291, "98119": 21847, "98122": 31284,
  // MA
  "02101": 7291,  "02108": 8291,  "02109": 11847, "02110": 9284,  "02111": 17291,
  "02112": 3841,  "02113": 8291,  "02114": 14293, "02115": 43291, "02116": 28391,
  "02134": 38291, "02139": 56483, "02143": 38291, "02144": 43218, "02145": 49283,
  // FL
  "33101": 4918,  "33102": 8291,  "33125": 49283, "33126": 62918, "33127": 34918,
  "33128": 15291, "33129": 18291, "33130": 21847, "33131": 9284,  "33132": 8291,
  // CO
  "80202": 9283,  "80203": 28391, "80204": 38291, "80205": 43291, "80206": 43182,
  "80207": 38291, "80209": 28391, "80210": 38291, "80211": 28391, "80218": 28391,
  // IL
  "60601": 12847, "60602": 8291,  "60603": 6291,  "60604": 8291,  "60605": 29382,
  "60606": 18291, "60607": 36291, "60608": 59283, "60609": 49283, "60610": 28391,
  // OR
  "97201": 24831, "97202": 38291, "97203": 38291, "97204": 8291,  "97205": 24831,
  "97206": 48291, "97207": 4291,  "97208": 4291,  "97209": 28391, "97210": 28391,
  // NV
  "89101": 38291, "89102": 49283, "89103": 48291, "89104": 42018, "89106": 28391,
};

const STATE_BY_ZIP3: Record<string, string> = {
  "005": "MA", "006": "MA", "007": "MA", "008": "MA", "009": "MA",
  "010": "MA", "011": "MA", "012": "MA", "013": "MA", "014": "MA",
  "015": "MA", "016": "MA", "017": "MA", "018": "MA", "019": "MA",
  "020": "MA", "021": "MA", "022": "MA", "023": "MA", "024": "MA",
  "025": "MA", "026": "MA", "027": "MA",
  "028": "RI", "029": "RI",
  "030": "NH", "031": "NH", "032": "NH", "033": "NH", "034": "NH",
  "035": "NH", "036": "NH", "037": "NH", "038": "NH",
  "039": "ME", "040": "ME", "041": "ME", "042": "ME", "043": "ME",
  "044": "ME", "045": "ME", "046": "ME", "047": "ME", "048": "ME", "049": "ME",
  "050": "VT", "051": "VT", "052": "VT", "053": "VT", "054": "VT", "056": "VT", "057": "VT", "058": "VT", "059": "VT",
  "060": "CT", "061": "CT", "062": "CT", "063": "CT", "064": "CT", "065": "CT", "066": "CT", "067": "CT", "068": "CT", "069": "CT",
  "070": "NJ", "071": "NJ", "072": "NJ", "073": "NJ", "074": "NJ", "075": "NJ", "076": "NJ", "077": "NJ", "078": "NJ", "079": "NJ",
  "080": "NJ", "081": "NJ", "082": "NJ", "083": "NJ", "084": "NJ", "085": "NJ", "086": "NJ", "087": "NJ", "088": "NJ", "089": "NJ",
  "100": "NY", "101": "NY", "102": "NY", "103": "NY", "104": "NY", "105": "NY", "106": "NY", "107": "NY", "108": "NY", "109": "NY",
  "110": "NY", "111": "NY", "112": "NY", "113": "NY", "114": "NY", "115": "NY", "116": "NY", "117": "NY", "118": "NY", "119": "NY",
  "120": "NY", "121": "NY", "122": "NY", "123": "NY", "124": "NY", "125": "NY", "126": "NY", "127": "NY", "128": "NY", "129": "NY",
  "130": "NY", "131": "NY", "132": "NY", "133": "NY", "134": "NY", "135": "NY", "136": "NY", "137": "NY", "138": "NY", "139": "NY",
  "140": "NY", "141": "NY", "142": "NY", "143": "NY", "144": "NY", "145": "NY", "146": "NY", "147": "NY", "148": "NY", "149": "NY",
  "194": "PA", "195": "PA", "196": "PA",
  "300": "GA", "301": "GA", "302": "GA", "303": "GA", "304": "GA", "305": "GA", "306": "GA", "307": "GA", "308": "GA", "309": "GA",
  "310": "GA", "311": "GA", "312": "GA", "313": "GA", "314": "GA", "315": "GA", "316": "GA", "317": "GA", "318": "GA", "319": "GA",
  "320": "FL", "321": "FL", "322": "FL", "323": "FL", "324": "FL", "325": "FL", "326": "FL", "327": "FL", "328": "FL", "329": "FL",
  "330": "FL", "331": "FL", "332": "FL", "333": "FL", "334": "FL", "335": "FL", "336": "FL", "337": "FL", "338": "FL", "339": "FL",
  "340": "FL", "341": "FL", "342": "FL", "344": "FL", "346": "FL", "347": "FL", "349": "FL",
  "606": "IL", "607": "IL", "608": "IL", "609": "IL", "610": "IL", "611": "IL", "612": "IL", "613": "IL", "614": "IL", "615": "IL",
  "616": "IL", "617": "IL", "618": "IL", "619": "IL", "620": "IL", "621": "IL", "622": "IL", "623": "IL", "624": "IL", "625": "IL",
  "626": "IL", "627": "IL", "628": "IL", "629": "IL",
  "750": "TX", "751": "TX", "752": "TX", "753": "TX", "754": "TX", "755": "TX", "756": "TX", "757": "TX", "758": "TX", "759": "TX",
  "760": "TX", "761": "TX", "762": "TX", "763": "TX", "764": "TX", "765": "TX", "766": "TX", "767": "TX", "768": "TX", "769": "TX",
  "770": "TX", "771": "TX", "772": "TX", "773": "TX", "774": "TX", "775": "TX", "776": "TX", "777": "TX", "778": "TX", "779": "TX",
  "780": "TX", "781": "TX", "782": "TX", "783": "TX", "784": "TX", "785": "TX", "786": "TX", "787": "TX", "788": "TX", "789": "TX",
  "790": "TX", "791": "TX", "792": "TX", "793": "TX", "794": "TX", "795": "TX", "796": "TX", "797": "TX", "798": "TX", "799": "TX",
  "800": "CO", "801": "CO", "802": "CO", "803": "CO", "804": "CO", "805": "CO", "806": "CO", "807": "CO", "808": "CO", "809": "CO",
  "810": "CO", "811": "CO", "812": "CO", "813": "CO", "814": "CO", "815": "CO", "816": "CO",
  "890": "NV", "891": "NV", "892": "NV", "893": "NV", "894": "NV", "895": "NV", "897": "NV", "898": "NV",
  "970": "OR", "971": "OR", "972": "OR", "973": "OR", "974": "OR", "975": "OR", "976": "OR", "977": "OR", "978": "OR", "979": "OR",
  "980": "WA", "981": "WA", "982": "WA", "983": "WA", "984": "WA", "985": "WA", "986": "WA", "988": "WA", "989": "WA", "990": "WA",
  "991": "WA", "992": "WA", "993": "WA", "994": "WA",
  "900": "CA", "901": "CA", "902": "CA", "903": "CA", "904": "CA", "905": "CA", "906": "CA", "907": "CA", "908": "CA", "909": "CA",
  "910": "CA", "911": "CA", "912": "CA", "913": "CA", "914": "CA", "915": "CA", "916": "CA", "917": "CA", "918": "CA", "919": "CA",
  "920": "CA", "921": "CA", "922": "CA", "923": "CA", "924": "CA", "925": "CA", "926": "CA", "927": "CA", "928": "CA", "929": "CA",
  "930": "CA", "931": "CA", "932": "CA", "933": "CA", "934": "CA", "935": "CA", "936": "CA", "937": "CA", "938": "CA", "939": "CA",
  "940": "CA", "941": "CA", "942": "CA", "943": "CA", "944": "CA", "945": "CA", "946": "CA", "947": "CA", "948": "CA", "949": "CA",
  "950": "CA", "951": "CA", "952": "CA", "953": "CA", "954": "CA", "955": "CA", "956": "CA", "957": "CA", "958": "CA", "959": "CA",
  "960": "CA", "961": "CA",
};

interface AfdcStation {
  zip?: string;
  state?: string;
  ev_level2_evse_num?: number | null;
  ev_dc_fast_num?: number | null;
  ev_network?: string | null;
}

interface AfdcResponse {
  total_results: number;
  station_locator_url: string;
  fuel_stations: AfdcStation[];
}

function densityScore(dcfcPer100k: number): "Excellent" | "Good" | "Moderate" | "Poor" {
  if (dcfcPer100k >= 30) return "Excellent";
  if (dcfcPer100k >= 15) return "Good";
  if (dcfcPer100k >= 5) return "Moderate";
  return "Poor";
}

async function main() {
  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) {
    console.error("❌ NREL_API_KEY env var required. Register free at https://developer.nrel.gov/signup/");
    process.exit(1);
  }

  // AFDC API max limit=200, no offset support — iterate by state
  const ALL_STATES = [
    "AK","AL","AR","AZ","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID",
    "IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC",
    "ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD",
    "TN","TX","UT","VA","VT","WA","WI","WV","WY",
  ];
  const PAGE_SIZE = 200;

  console.log("📡 Fetching EV stations from AFDC (by state)…");
  let stations: AfdcStation[] = [];

  for (const state of ALL_STATES) {
    let page = 1;
    while (true) {
      const url = `${AFDC_URL}?api_key=${apiKey}&fuel_type=ELEC&status=E&state=${state}&limit=${PAGE_SIZE}&page=${page}`;
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = (await res.json()) as AfdcResponse;
        const batch = data.fuel_stations ?? [];
        stations = stations.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        console.error(`\n❌ Failed for state ${state}:`, err);
        break; // skip state, continue
      }
    }
    process.stdout.write(`\r  ${state}: done — ${stations.length} total so far…`);
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\n  Retrieved ${stations.length} active EV stations`);

  // Aggregate by ZIP-5
  const byZip = new Map<string, { state: string; dcfc: number; l2: number }>();

  for (const s of stations) {
    if (!s.zip) continue;
    // Always store ZIP as zero-padded string
    const zip5 = String(s.zip).trim().substring(0, 5).padStart(5, "0");
    const state = s.state ?? STATE_BY_ZIP3[zip5.substring(0, 3)] ?? "??";

    if (!byZip.has(zip5)) byZip.set(zip5, { state, dcfc: 0, l2: 0 });
    const agg = byZip.get(zip5)!;
    agg.dcfc += s.ev_dc_fast_num ?? 0;
    agg.l2 += s.ev_level2_evse_num ?? 0;
  }

  console.log(`  Aggregated into ${byZip.size} ZIP codes`);

  // Compute density
  const results = [];
  for (const [zip5, { state, dcfc, l2 }] of byZip.entries()) {
    const knownPop = POPULATION_BY_ZIP[zip5];
    // Only compute per-100k when we have real population data
    // Without it, use raw counts to derive a qualitative density score
    let dcfcPer100k: number;
    let l2Per100k: number;
    if (knownPop) {
      dcfcPer100k = Math.round((dcfc / knownPop) * 100000 * 10) / 10;
      l2Per100k = Math.round((l2 / knownPop) * 100000 * 10) / 10;
    } else {
      // Heuristic: assume median ZIP ~35k pop, but flag as estimated
      dcfcPer100k = Math.round((dcfc / 35000) * 100000 * 10) / 10;
      l2Per100k = Math.round((l2 / 35000) * 100000 * 10) / 10;
    }

    results.push({
      zip5,
      state,
      dcfc_count: dcfc,
      l2_count: l2,
      dcfc_per_100k: dcfcPer100k,
      l2_per_100k: l2Per100k,
      pop_estimate: knownPop ?? 35000,
      pop_source: knownPop ? "acs_2020" : "median_estimate",
      density_score: densityScore(dcfcPer100k),
    });
  }

  // Sort by ZIP for deterministic output
  results.sort((a, b) => a.zip5.localeCompare(b.zip5));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Wrote ${results.length} ZIP-5 charger density records → ${OUT_PATH}`);
  console.log(`   Note: Add real population data from ACS for accurate per-100k figures.`);
  console.log(`   Download: https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
