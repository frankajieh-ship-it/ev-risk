/**
 * GET /api/deals
 *
 * Public endpoint — returns OFFO-curated pre-analyzed EV deals.
 * Sorted by deal_quality_score DESC. Supports filtering and pagination.
 *
 * Query params:
 *   make        = e.g. Tesla
 *   model       = e.g. Model 3
 *   price_max   = max price in USD
 *   mileage_max = max mileage
 *   year_min    = min year
 *   sort        = price_asc | price_desc | mileage | newest (default: price_asc)
 *   page        = page number (default: 1)
 *   per_page    = results per page (default: 20, max: 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const rateLimiter = new RateLimiter(60 * 1000, 30); // 30 req/min per IP

// Leading 3-digit ZIP prefix ranges per US state.
// Used to filter by state when the location column stores bare ZIP codes
// (e.g. "90210") rather than city+state strings (e.g. "Los Angeles, CA").
const STATE_ZIP_PREFIXES: Record<string, string[]> = {
  AL: ["350","351","352","354","355","356","357","358","359","360","361","362","363","364","365","366","367","368","369"],
  AK: ["995","996","997","998","999"],
  AZ: ["850","851","852","853","855","856","857","859","860","863","864","865"],
  AR: ["716","717","718","719","720","721","722","723","724","725","726","727","728","729"],
  CA: ["900","901","902","903","904","905","906","907","908","910","911","912","913","914","915","916","917","918","919","920","921","922","923","924","925","926","927","928","930","931","932","933","934","935","936","937","938","939","940","941","942","943","944","945","946","947","948","949","950","951","952","953","954","955","956","957","958","959","960","961"],
  CO: ["800","801","802","803","804","805","806","807","808","809","810","811","812","813","814","815","816"],
  CT: ["060","061","062","063","064","065","066","067","068","069"],
  DE: ["197","198","199"],
  FL: ["320","321","322","323","324","325","326","327","328","329","330","331","332","333","334","335","336","337","338","339","340","341","342","344","346","347","349"],
  GA: ["300","301","302","303","304","305","306","307","308","309","310","311","312","313","314","315","316","317","318","319"],
  HI: ["967","968"],
  ID: ["832","833","834","835","836","837","838"],
  IL: ["600","601","602","603","604","605","606","607","608","609","610","611","612","613","614","615","616","617","618","619","620","621","622","623","624","625","626","627","628","629"],
  IN: ["460","461","462","463","464","465","466","467","468","469","470","471","472","473","474","475","476","477","478","479"],
  IA: ["500","501","502","503","504","505","506","507","508","509","510","511","512","513","514","515","516","520","521","522","523","524","525","526","527","528"],
  KS: ["660","661","662","664","665","666","667","668","669","670","671","672","673","674","675","676","677","678","679"],
  KY: ["400","401","402","403","404","405","406","407","408","409","410","411","412","413","414","415","416","417","418","420","421","422","423","424","425","426","427"],
  LA: ["700","701","703","704","705","706","707","708","710","711","712","713","714"],
  ME: ["039","040","041","042","043","044","045","046","047","048","049"],
  MD: ["206","207","208","209","210","211","212","214","215","216","217","218","219"],
  MA: ["010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027"],
  MI: ["480","481","482","483","484","485","486","487","488","489","490","491","492","493","494","495","496","497","498","499"],
  MN: ["550","551","553","554","555","556","557","558","559","560","561","562","563","564","565","566","567"],
  MS: ["386","387","388","389","390","391","392","393","394","395","396","397"],
  MO: ["630","631","633","634","635","636","637","638","639","640","641","644","645","646","647","648","649","650","651","652","653","654","655","656","657","658"],
  MT: ["590","591","592","593","594","595","596","597","598","599"],
  NE: ["680","681","683","684","685","686","687","688","689","690","691","692","693"],
  NV: ["889","890","891","893","894","895","897","898"],
  NH: ["030","031","032","033","034","035","036","037","038"],
  NJ: ["070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089"],
  NM: ["870","871","872","873","874","875","877","878","879","880","881","882","883","884"],
  NY: ["100","101","102","103","104","105","106","107","108","109","110","111","112","113","114","115","116","117","118","119","120","121","122","123","124","125","126","127","128","129","130","131","132","133","134","135","136","137","138","139","140","141","142","143","144","145","146","147","148","149"],
  NC: ["270","271","272","273","274","275","276","277","278","279","280","281","282","283","284","285","286","287","288","289"],
  ND: ["580","581","582","583","584","585","586","587","588"],
  OH: ["430","431","432","433","434","435","436","437","438","439","440","441","442","443","444","445","446","447","448","449","450","451","452","453","454","455","456","457","458"],
  OK: ["730","731","734","735","736","737","738","739","740","741","743","744","745","746","747","748","749"],
  OR: ["970","971","972","973","974","975","976","977","978","979"],
  PA: ["150","151","152","153","154","155","156","157","158","159","160","161","162","163","164","165","166","167","168","169","170","171","172","173","174","175","176","177","178","179","180","181","182","183","184","185","186","187","188","189","190","191","192","193","194","195","196"],
  RI: ["028","029"],
  SC: ["290","291","292","293","294","295","296","297","298","299"],
  SD: ["570","571","572","573","574","575","576","577"],
  TN: ["370","371","372","373","374","375","376","377","378","379","380","381","382","383","384","385"],
  TX: ["750","751","752","753","754","755","756","757","758","759","760","761","762","763","764","765","766","767","768","769","770","771","772","773","774","775","776","777","778","779","780","781","782","783","784","785","786","787","788","789","790","791","792","793","794","795","796","797","798","799"],
  UT: ["840","841","842","843","844","845","846","847"],
  VT: ["050","051","052","053","054","056","057","058","059"],
  VA: ["200","201","202","203","204","205","220","221","222","223","224","225","226","227","228","229","230","231","232","233","234","235","236","237","238","239","240","241","242","243","244","245","246"],
  WA: ["980","981","982","983","984","985","986","988","989","990","991","992","993","994"],
  WV: ["247","248","249","250","251","252","253","254","255","256","257","258","259","260","261","262","263","264","265","266","267","268"],
  WI: ["530","531","532","534","535","537","538","539","540","541","542","543","544","545","546","547","548","549"],
  WY: ["820","821","822","823","824","825","826","827","828","829","830"],
  DC: ["200"],
};

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (!rateLimiter.check(ip).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;

  // Parse filters
  const make = params.get("make")?.trim() ?? null;
  const model = params.get("model")?.trim() ?? null;
  const priceMax = params.get("price_max") ? parseInt(params.get("price_max")!) : null;
  const mileageMax = params.get("mileage_max") ? parseInt(params.get("mileage_max")!) : null;
  const yearMin = params.get("year_min") ? parseInt(params.get("year_min")!) : null;
  const yearMax = params.get("year_max") ? parseInt(params.get("year_max")!) : null;
  const location = params.get("location")?.trim() ?? null;
  const sort = params.get("sort") ?? "quality";

  // Pagination applied AFTER dedup — fetch all matching rows first, dedup, then slice.
  // Fetching paginated rows then deduping causes every page to show the same vehicles.
  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(params.get("per_page") ?? "20")));

  // Determine sort column + direction
  const sortMap: Record<string, { col: string; asc: boolean }> = {
    price_asc:  { col: "price",   asc: true  },
    price_desc: { col: "price",   asc: false },
    mileage:    { col: "mileage", asc: true  },
    newest:     { col: "year",    asc: false },
  };
  const { col: sortCol, asc: sortAsc } = sortMap[sort] ?? sortMap.price_asc;

  // When a location filter is active we need a higher cap — state-specific deals
  // may all rank below the global top 500, causing the filter to appear broken.
  const fetchLimit = location ? 2000 : 500;

  let query = supabase
    .from("curated_deals")
    .select("id, listing_url, url_domain, vehicle_label, year, make, model, trim, price, mileage, location, receipt_id, photo_url, last_analyzed_at, vin")
    .eq("is_active", true)
    .not("vehicle_label", "is", null)
    .not("make", "is", null)
    .not("price", "is", null)
    .order(sortCol, { ascending: sortAsc, nullsFirst: false })
    .limit(fetchLimit);

  if (make) {
    query = query.ilike("make", `%${make}%`);
  }
  if (model) {
    query = query.ilike("model", `%${model}%`);
  }
  if (priceMax && !isNaN(priceMax)) {
    query = query.lte("price", priceMax);
  }
  if (mileageMax && !isNaN(mileageMax)) {
    query = query.lte("mileage", mileageMax);
  }
  if (yearMin && !isNaN(yearMin)) {
    query = query.gte("year", yearMin);
  }
  if (yearMax && !isNaN(yearMax)) {
    query = query.lte("year", yearMax);
  }
  if (location) {
    if (location.length === 2) {
      const stateCode = location.toUpperCase();
      const prefixes = STATE_ZIP_PREFIXES[stateCode];
      if (prefixes && prefixes.length > 0) {
        // Build a single OR across ZIP prefixes + city+state-only format.
        // Handles every location format found in the DB:
        //   "90210"                 → prefix ilike (bare ZIP)
        //   "90210-1234"            → prefix ilike (ZIP+4)
        //   "Los Angeles, CA 90210" → prefix ilike (city+state+ZIP)
        //   "Los Angeles, CA"       → "% CA" pattern (ends with space+state, no ZIP)
        // Note: city+state pattern uses "% CA" (space before code, no comma) to avoid
        // PostgREST misinterpreting the comma as an OR-list separator.
        const cityStateFilter = `location.ilike.% ${stateCode}`;
        const zipFilters = prefixes.map((p) => `location.ilike.${p}%`);
        query = query.or([cityStateFilter, ...zipFilters].join(","));
      } else {
        // Unknown 2-letter code — fall back to substring match
        query = query.ilike("location", `%${stateCode}%`);
      }
    } else {
      // Full state name or city substring — simple match
      query = query.ilike("location", `%${location}%`);
    }
  }

  const { data: allDeals, error } = await query;

  if (error) {
    console.error("[/api/deals] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }

  // Deduplicate by listing_url — each URL is unique in the DB already,
  // but guard against any duplicates introduced by imports.
  const seen = new Map<string, (typeof allDeals)[0]>();
  for (const deal of allDeals ?? []) {
    if (!seen.has(deal.listing_url)) {
      seen.set(deal.listing_url, deal);
    }
  }
  const deduped = Array.from(seen.values());
  const total = deduped.length;
  const offset = (page - 1) * perPage;
  const pageDeals = deduped.slice(offset, offset + perPage);

  return NextResponse.json(
    {
      success: true,
      deals: pageDeals,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
