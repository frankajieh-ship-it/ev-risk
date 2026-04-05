/**
 * City data for local EV landing pages (/local/[city])
 */

export interface CityData {
  slug: string;
  name: string;
  state: string;
  region: string;
  climateBand: "mild" | "cold" | "hot" | "varied";
  winterRangeLoss: string; // e.g. "20-25%"
  chargingContext: string; // 1-2 sentence local flavor
  fitNote: string; // 1 sentence about EV fit in this city
}

export const cities: Record<string, CityData> = {
  // ── West Coast ────────────────────────────────────────────────────────────────
  "los-angeles": {
    slug: "los-angeles",
    name: "Los Angeles",
    state: "CA",
    region: "Southern California",
    climateBand: "mild",
    winterRangeLoss: "5-10%",
    chargingContext:
      "LA has one of the densest public charging networks in the US, with Electrify America, ChargePoint, and EVgo stations throughout the metro. Workplace charging is common at larger employers.",
    fitNote:
      "Mild climate and excellent charging infrastructure make LA one of the best cities for EV ownership — including apartment dwellers.",
  },
  "san-francisco": {
    slug: "san-francisco",
    name: "San Francisco",
    state: "CA",
    region: "Bay Area",
    climateBand: "mild",
    winterRangeLoss: "5-10%",
    chargingContext:
      "San Francisco has exceptionally dense charging coverage and California's clean electricity grid means EVs here have near-zero carbon per mile. The main challenge is apartment/condo charging access — over 60% of SF residents rent.",
    fitNote:
      "SF is ideal for EV ownership if you have home or workplace charging; apartment dwellers without charging access face real friction.",
  },
  "san-jose": {
    slug: "san-jose",
    name: "San Jose",
    state: "CA",
    region: "Bay Area",
    climateBand: "mild",
    winterRangeLoss: "5-10%",
    chargingContext:
      "San Jose sits at the heart of Silicon Valley with among the highest EV ownership rates in the US. Charging at tech campuses, shopping centers, and public garages is ubiquitous.",
    fitNote:
      "San Jose residents benefit from the densest EV charging in the country and mild year-round weather.",
  },
  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    state: "CA",
    region: "Southern California",
    climateBand: "mild",
    winterRangeLoss: "3-8%",
    chargingContext:
      "San Diego's near-perfect climate means EV range loss is minimal year-round. SDG&E rates are high, but off-peak charging brings costs down significantly. Charging infrastructure has expanded rapidly since 2022.",
    fitNote:
      "San Diego's climate is arguably the best in the US for EV ownership — minimal range loss and excellent charging coverage.",
  },
  sacramento: {
    slug: "sacramento",
    name: "Sacramento",
    state: "CA",
    region: "Central Valley",
    climateBand: "hot",
    winterRangeLoss: "8-12%",
    chargingContext:
      "Sacramento summers are hot — 100°F+ days are common — but EVs with active thermal management handle it well. SMUD's electricity rates are among the lowest in California, making home charging very affordable.",
    fitNote:
      "Sacramento is a strong EV market with low electricity costs and growing charging infrastructure, though summer heat management matters.",
  },
  seattle: {
    slug: "seattle",
    name: "Seattle",
    state: "WA",
    region: "Pacific Northwest",
    climateBand: "mild",
    winterRangeLoss: "10-15%",
    chargingContext:
      "Seattle has mild winters, the highest EV adoption rate in the US, and a robust charging network. Washington state's clean electricity grid also means EVs have among the lowest carbon emissions per mile nationally.",
    fitNote:
      "Seattle is an ideal EV market — mild climate, cheap electricity, and dense charging infrastructure.",
  },
  portland: {
    slug: "portland",
    name: "Portland",
    state: "OR",
    region: "Pacific Northwest",
    climateBand: "mild",
    winterRangeLoss: "10-15%",
    chargingContext:
      "Portland's mild, rainy climate is ideal for EVs. Oregon has strong EV incentives and an extensive Level 2 network. The West Hills can add elevation-related consumption for some commuters.",
    fitNote:
      "Portland is one of the best EV cities in the US — mild winters, cheap hydro power, and strong charging infrastructure.",
  },
  "las-vegas": {
    slug: "las-vegas",
    name: "Las Vegas",
    state: "NV",
    region: "Desert Southwest",
    climateBand: "hot",
    winterRangeLoss: "8-15%",
    chargingContext:
      "Las Vegas summers regularly top 110°F — EVs with active battery cooling handle it well, but parking in direct sun strains thermal management. The Strip and airport have solid fast-charging coverage; suburban charging is expanding quickly.",
    fitNote:
      "Las Vegas works well for EVs with good thermal management — summer heat is manageable with shaded parking and a pre-cooling habit.",
  },
  phoenix: {
    slug: "phoenix",
    name: "Phoenix",
    state: "AZ",
    region: "Desert Southwest",
    climateBand: "hot",
    winterRangeLoss: "5-10%",
    chargingContext:
      "Phoenix has the hottest sustained EV operating conditions in the US — summer temperatures routinely exceed 115°F. Battery degradation from heat is a real concern for older EVs; newer thermal management systems handle it much better.",
    fitNote:
      "Phoenix is EV-viable with modern thermal management, but summer heat is the most important climate factor to account for when choosing a model.",
  },
  tucson: {
    slug: "tucson",
    name: "Tucson",
    state: "AZ",
    region: "Desert Southwest",
    climateBand: "hot",
    winterRangeLoss: "5-10%",
    chargingContext:
      "Tucson's charging infrastructure is growing but trails Phoenix — plan longer routes carefully. UA campus and downtown have solid coverage. Summer heat requires the same thermal awareness as Phoenix.",
    fitNote:
      "Tucson is EV-workable with route planning, though the charging network is less dense than in larger metros.",
  },
  // ── Mountain West ─────────────────────────────────────────────────────────────
  denver: {
    slug: "denver",
    name: "Denver",
    state: "CO",
    region: "Rocky Mountain",
    climateBand: "varied",
    winterRangeLoss: "15-25%",
    chargingContext:
      "Denver's altitude and variable climate create unique EV conditions. Cold snaps are shorter than in the Midwest, but mountain driving with elevation changes adds range consumption on weekend trips.",
    fitNote:
      "Denver is a strong EV market — the city has excellent infrastructure, though mountain driving requires range planning.",
  },
  "salt-lake-city": {
    slug: "salt-lake-city",
    name: "Salt Lake City",
    state: "UT",
    region: "Intermountain West",
    climateBand: "cold",
    winterRangeLoss: "20-30%",
    chargingContext:
      "Salt Lake City winters are genuinely cold, and the inversion layer air quality issues actually make EVs more appealing for residents. The Wasatch Front corridor has solid fast-charging coverage.",
    fitNote:
      "SLC winters require a buffer plan, but EV ownership is growing rapidly — improved air quality is a local motivator.",
  },
  boise: {
    slug: "boise",
    name: "Boise",
    state: "ID",
    region: "Pacific Northwest",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Boise's charging network has improved significantly since 2023 but remains thinner than major metros. Idaho Power's rates are low, making home charging very affordable.",
    fitNote:
      "Boise is EV-viable with home charging as the primary option — public charging is adequate for city driving but requires planning for longer trips.",
  },
  albuquerque: {
    slug: "albuquerque",
    name: "Albuquerque",
    state: "NM",
    region: "Southwest",
    climateBand: "varied",
    winterRangeLoss: "12-20%",
    chargingContext:
      "Albuquerque's high altitude (5,300 ft) affects EV range slightly year-round. The city has a growing charging network anchored by Electrify America and Tesla, with I-40 corridor coverage for longer trips.",
    fitNote:
      "Albuquerque is EV-friendly with reasonable infrastructure; altitude adds modest range reduction but the mild climate compensates.",
  },
  // ── Midwest ───────────────────────────────────────────────────────────────────
  chicago: {
    slug: "chicago",
    name: "Chicago",
    state: "IL",
    region: "Midwest",
    climateBand: "cold",
    winterRangeLoss: "25-35%",
    chargingContext:
      "Chicago winters are genuinely harsh. Sub-zero days are common in January and February, and EV range loss can exceed 35% on the coldest days. Public charging availability has improved significantly since 2023.",
    fitNote:
      "EVs work well in Chicago with the right car — heat pump models and a winter buffer routine are essential.",
  },
  minneapolis: {
    slug: "minneapolis",
    name: "Minneapolis",
    state: "MN",
    region: "Upper Midwest",
    climateBand: "cold",
    winterRangeLoss: "30-40%",
    chargingContext:
      "Minneapolis has some of the coldest EV operating conditions in the US. Preconditioned battery routines and 70%+ weekly starting charge are standard practice for experienced EV owners here.",
    fitNote:
      "Minneapolis is a legitimate test of EV resilience — heat pump models (Ioniq 5, Model Y, EV6) handle it best.",
  },
  detroit: {
    slug: "detroit",
    name: "Detroit",
    state: "MI",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "25-35%",
    chargingContext:
      "Detroit winters are serious — lake-effect cold snaps can drop temperatures well below zero. The auto industry's EV push has improved local charging infrastructure significantly; factory charging programs help UAW employees specifically.",
    fitNote:
      "Detroit is a growing EV market with strong local industry support — cold weather planning is essential, as with all Great Lakes cities.",
  },
  cleveland: {
    slug: "cleveland",
    name: "Cleveland",
    state: "OH",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "25-35%",
    chargingContext:
      "Cleveland's lake-effect winters are severe. Public charging density lags major metros but is expanding. CEI electricity rates are moderate, making home charging cost-effective.",
    fitNote:
      "Cleveland EVs need a serious winter buffer routine — heat pump models and a plug-in garage make a significant difference.",
  },
  columbus: {
    slug: "columbus",
    name: "Columbus",
    state: "OH",
    region: "Midwest",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Columbus has benefited from federal infrastructure investment as a key East-West corridor city on I-70. The charging network is solid along the interstate and growing in the suburbs.",
    fitNote:
      "Columbus is a reasonable EV market with improving infrastructure — winters are cold but not extreme.",
  },
  cincinnati: {
    slug: "cincinnati",
    name: "Cincinnati",
    state: "OH",
    region: "Midwest",
    climateBand: "cold",
    winterRangeLoss: "18-25%",
    chargingContext:
      "Cincinnati straddles Ohio and Kentucky with a mixed charging network. Duke Energy's rates are reasonable, and the metro has seen steady public charging expansion since 2022.",
    fitNote:
      "Cincinnati works well for EV owners with home charging; winters require planning but are milder than northern Ohio cities.",
  },
  indianapolis: {
    slug: "indianapolis",
    name: "Indianapolis",
    state: "IN",
    region: "Midwest",
    climateBand: "cold",
    winterRangeLoss: "22-30%",
    chargingContext:
      "Indianapolis charging infrastructure is solid along I-65 and I-70 corridors. The Indy metro has good suburban Level 2 coverage, and the Formula E connection has raised local EV awareness.",
    fitNote:
      "Indianapolis is EV-viable with home charging as the foundation; cold winters require a buffer routine.",
  },
  milwaukee: {
    slug: "milwaukee",
    name: "Milwaukee",
    state: "WI",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "28-38%",
    chargingContext:
      "Milwaukee winters are brutally cold with lake-effect influence. WE Energies rates are moderate, but public charging density remains below the national average. A plug-in garage is highly recommended.",
    fitNote:
      "Milwaukee requires serious winter prep for EV ownership — heat pump models and reliable home charging are non-negotiable.",
  },
  "kansas-city": {
    slug: "kansas-city",
    name: "Kansas City",
    state: "MO",
    region: "Midwest",
    climateBand: "varied",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Kansas City sits at the crossroads of I-70 and I-35, giving it good interstate charging coverage. The metro area's own network is growing, and Evergy's rates are among the lowest in the region.",
    fitNote:
      "Kansas City is a solid mid-tier EV market — variable winters require modest range planning and the infrastructure is adequate.",
  },
  "st-louis": {
    slug: "st-louis",
    name: "St. Louis",
    state: "MO",
    region: "Midwest",
    climateBand: "varied",
    winterRangeLoss: "18-25%",
    chargingContext:
      "St. Louis has moderate winters with occasional ice storms. Ameren Missouri's rates are reasonable, and the metro area's charging network covers major corridors well.",
    fitNote:
      "St. Louis is an improving EV market — infrastructure is adequate for daily drivers, and winter conditions are manageable.",
  },
  omaha: {
    slug: "omaha",
    name: "Omaha",
    state: "NE",
    region: "Great Plains",
    climateBand: "cold",
    winterRangeLoss: "25-32%",
    chargingContext:
      "Omaha's charging network is thinner than major metros but improving rapidly. OPPD's electricity is clean (hydro-heavy) and affordable. Cold snaps are serious and can hit -20°F in January.",
    fitNote:
      "Omaha is EV-viable with home charging as the anchor; public network density requires planning for longer trips.",
  },
  "des-moines": {
    slug: "des-moines",
    name: "Des Moines",
    state: "IA",
    region: "Great Plains",
    climateBand: "cold",
    winterRangeLoss: "25-35%",
    chargingContext:
      "Des Moines winters are harsh and the charging network is thinner than in major metros. MidAmerican Energy's high renewable mix means EV carbon footprints are very low here.",
    fitNote:
      "Des Moines is workable for EV owners with home charging — cold winters and a developing public network require careful planning.",
  },
  // ── South ─────────────────────────────────────────────────────────────────────
  austin: {
    slug: "austin",
    name: "Austin",
    state: "TX",
    region: "South-Central",
    climateBand: "hot",
    winterRangeLoss: "5-15%",
    chargingContext:
      "Austin's hot summers are manageable for EVs with active thermal management. The city has a rapidly expanding charging network driven by Texas's EV adoption growth, and the Tesla Supercharger network covers the I-35 corridor well.",
    fitNote:
      "Austin is EV-friendly year-round — heat is less of a range issue than cold, and the charging network is solid.",
  },
  dallas: {
    slug: "dallas",
    name: "Dallas",
    state: "TX",
    region: "South-Central",
    climateBand: "hot",
    winterRangeLoss: "8-15%",
    chargingContext:
      "Dallas has one of the fastest-growing EV charging networks in Texas, fueled by suburban sprawl and high commute miles. Oncor and TXU offer EV rate plans. The 2021 winter storm highlighted EV vulnerabilities in extreme cold — unusual but not impossible.",
    fitNote:
      "Dallas is a strong EV market for most commuters — hot summers are manageable, and the charging network is improving rapidly.",
  },
  houston: {
    slug: "houston",
    name: "Houston",
    state: "TX",
    region: "Gulf Coast",
    climateBand: "hot",
    winterRangeLoss: "5-12%",
    chargingContext:
      "Houston's hot, humid climate is gentle on battery longevity compared to Phoenix. The charging network is extensive along I-10 and the 610 Loop. Hurricane season occasionally disrupts power — EV owners should keep charge above 50% during storm watches.",
    fitNote:
      "Houston is a great EV city — mild winters, strong charging access, and low electricity costs make it very viable.",
  },
  "san-antonio": {
    slug: "san-antonio",
    name: "San Antonio",
    state: "TX",
    region: "South-Central",
    climateBand: "hot",
    winterRangeLoss: "5-12%",
    chargingContext:
      "San Antonio's CPS Energy is one of the few utilities actively partnering with automakers on EV infrastructure. The charging network is growing quickly, though it lags Austin and Dallas in density.",
    fitNote:
      "San Antonio is becoming a solid EV city — CPS Energy rates are low and infrastructure is expanding fast.",
  },
  nashville: {
    slug: "nashville",
    name: "Nashville",
    state: "TN",
    region: "South",
    climateBand: "varied",
    winterRangeLoss: "10-20%",
    chargingContext:
      "Nashville has seen rapid EV infrastructure growth since 2023, driven partly by the Volkswagen EV plant in Chattanooga. Occasional ice storms in winter require buffer planning, but sustained cold is uncommon.",
    fitNote:
      "Nashville is a solid EV market with a growing charging network — occasional winter ice events are the main range planning consideration.",
  },
  atlanta: {
    slug: "atlanta",
    name: "Atlanta",
    state: "GA",
    region: "Southeast",
    climateBand: "varied",
    winterRangeLoss: "10-15%",
    chargingContext:
      "Atlanta is one of the top US metros for EV adoption, partly driven by Georgia's historically strong EV incentives. The Electrify America and Tesla networks are well-established throughout the metro.",
    fitNote:
      "Atlanta has strong charging infrastructure and mild winters — a very EV-friendly metro for most commuters.",
  },
  charlotte: {
    slug: "charlotte",
    name: "Charlotte",
    state: "NC",
    region: "Southeast",
    climateBand: "varied",
    winterRangeLoss: "10-18%",
    chargingContext:
      "Charlotte's charging network has grown significantly since 2022. Duke Energy is one of the most active utilities in EV infrastructure investment, and the I-85 corridor connecting Charlotte to Raleigh is well-covered.",
    fitNote:
      "Charlotte is a growing EV market with strong utility support — mild winters make year-round ownership straightforward.",
  },
  raleigh: {
    slug: "raleigh",
    name: "Raleigh",
    state: "NC",
    region: "Southeast",
    climateBand: "varied",
    winterRangeLoss: "10-18%",
    chargingContext:
      "Raleigh's Research Triangle is one of the fastest-growing EV markets in the Southeast. Duke Energy's charging program and a tech-savvy population have driven rapid infrastructure expansion since 2022.",
    fitNote:
      "Raleigh is one of the best emerging EV markets in the US — strong infrastructure growth and mild winters.",
  },
  orlando: {
    slug: "orlando",
    name: "Orlando",
    state: "FL",
    region: "Florida",
    climateBand: "hot",
    winterRangeLoss: "3-8%",
    chargingContext:
      "Orlando's year-round heat is gentle on EV range compared to cold climates. The charging network is robust along I-4 and near tourist corridors. Duke Energy Florida offers off-peak home charging rates.",
    fitNote:
      "Orlando's mild winters mean EVs perform close to EPA estimates year-round — it's one of the most comfortable climates for EV ownership.",
  },
  miami: {
    slug: "miami",
    name: "Miami",
    state: "FL",
    region: "South Florida",
    climateBand: "hot",
    winterRangeLoss: "2-5%",
    chargingContext:
      "Miami has the most consistent EV operating temperature in the US — practically no range loss all year. FPL has invested heavily in charging infrastructure. Hurricane preparedness (maintaining charge above 50%) is the primary EV-specific consideration.",
    fitNote:
      "Miami is phenomenal for EV range year-round — the tropics are kinder to batteries than cold climates, and infrastructure is solid.",
  },
  tampa: {
    slug: "tampa",
    name: "Tampa",
    state: "FL",
    region: "Florida",
    climateBand: "hot",
    winterRangeLoss: "3-8%",
    chargingContext:
      "Tampa's charging network is strong along I-275 and SR-60 corridors. TECO's off-peak EV rates make home charging very affordable. Like all Florida EVs, keep charge above 50% heading into hurricane season.",
    fitNote:
      "Tampa is great for year-round EV ownership — near-zero range loss and a solid charging network make it straightforward.",
  },
  jacksonville: {
    slug: "jacksonville",
    name: "Jacksonville",
    state: "FL",
    region: "Florida",
    climateBand: "hot",
    winterRangeLoss: "5-10%",
    chargingContext:
      "Jacksonville has a rapidly growing EV charging network driven by Florida's overall EV push. The JEA utility offers EV-specific rates and is expanding public charging throughout the metro.",
    fitNote:
      "Jacksonville's mild climate makes EV ownership easy year-round — infrastructure is improving rapidly.",
  },
  "new-orleans": {
    slug: "new-orleans",
    name: "New Orleans",
    state: "LA",
    region: "Gulf South",
    climateBand: "hot",
    winterRangeLoss: "5-10%",
    chargingContext:
      "New Orleans' charging infrastructure is the least developed of major Southern metros, but Entergy's EV program is expanding public charging. Hurricane preparedness is more critical here than in most cities — charge fully before storm watches.",
    fitNote:
      "New Orleans is emerging as an EV city — mild climate is ideal, but charging infrastructure is still catching up.",
  },
  memphis: {
    slug: "memphis",
    name: "Memphis",
    state: "TN",
    region: "South",
    climateBand: "varied",
    winterRangeLoss: "12-20%",
    chargingContext:
      "Memphis sits on the I-40/I-55 corridors with decent interstate charging coverage. Local urban charging is growing. MLGW electricity rates are moderate.",
    fitNote:
      "Memphis is EV-viable with home charging; the charging network supports daily commuting well.",
  },
  birmingham: {
    slug: "birmingham",
    name: "Birmingham",
    state: "AL",
    region: "Deep South",
    climateBand: "varied",
    winterRangeLoss: "10-18%",
    chargingContext:
      "Birmingham's charging network is thinner than in major metros but growing. Alabama Power has expanded charging along I-20 and I-65. Occasional winter ice events require modest buffer planning.",
    fitNote:
      "Birmingham is an emerging EV market — mild winters and growing infrastructure make it increasingly viable.",
  },
  louisville: {
    slug: "louisville",
    name: "Louisville",
    state: "KY",
    region: "South",
    climateBand: "varied",
    winterRangeLoss: "18-25%",
    chargingContext:
      "Louisville's charging network is solid along I-64 and I-65 corridors. LG&E electricity rates are moderate, and Louisville's Ford truck plant connection is boosting local EV awareness.",
    fitNote:
      "Louisville is a growing EV market with adequate infrastructure — variable winters require modest planning.",
  },
  // ── Northeast ─────────────────────────────────────────────────────────────────
  "new-york": {
    slug: "new-york",
    name: "New York City",
    state: "NY",
    region: "Northeast",
    climateBand: "cold",
    winterRangeLoss: "20-30%",
    chargingContext:
      "NYC has the unique challenge of almost zero home charging access for apartment dwellers — over 80% of residents rent and lack private parking. Public charging infrastructure is growing rapidly under the NYC EV Charging Master Plan, but it's still the primary obstacle for most city residents.",
    fitNote:
      "NYC EV ownership is viable primarily for those with parking and charging access — without it, public charging is improving but not seamless.",
  },
  boston: {
    slug: "boston",
    name: "Boston",
    state: "MA",
    region: "New England",
    climateBand: "cold",
    winterRangeLoss: "20-30%",
    chargingContext:
      "Boston winters require a real buffer plan. The metro area has strong public charging coverage, and many Boston employers offer workplace charging. Apartment charging access is the main friction point.",
    fitNote:
      "EVs work well in Boston — cold weather requires a buffer routine, but the charging infrastructure supports it.",
  },
  philadelphia: {
    slug: "philadelphia",
    name: "Philadelphia",
    state: "PA",
    region: "Mid-Atlantic",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Philadelphia's charging network is solid along I-95 and the Northeast Corridor. PECO and Atlantic City Electric have expanded public charging. Row house neighborhoods make home charging access variable.",
    fitNote:
      "Philadelphia is a viable EV city with improving infrastructure — cold winters and apartment/row house charging access are the main considerations.",
  },
  pittsburgh: {
    slug: "pittsburgh",
    name: "Pittsburgh",
    state: "PA",
    region: "Mid-Atlantic",
    climateBand: "cold",
    winterRangeLoss: "22-30%",
    chargingContext:
      "Pittsburgh's hilly terrain adds measurable range consumption year-round. Duquesne Light has expanded charging, and Carnegie Mellon's EV research community has driven innovation in local infrastructure.",
    fitNote:
      "Pittsburgh is EV-viable — cold winters and hilly terrain require range planning, but infrastructure is solid.",
  },
  "washington-dc": {
    slug: "washington-dc",
    name: "Washington, D.C.",
    state: "DC",
    region: "Mid-Atlantic",
    climateBand: "varied",
    winterRangeLoss: "15-22%",
    chargingContext:
      "D.C. has strong public charging coverage in the urban core and robust workplace charging at federal agencies. The Virginia and Maryland suburbs have dense Level 2 networks. Pepco's off-peak rates make home charging affordable.",
    fitNote:
      "D.C. is one of the best Mid-Atlantic EV cities — good infrastructure, moderate winters, and strong incentive programs.",
  },
  baltimore: {
    slug: "baltimore",
    name: "Baltimore",
    state: "MD",
    region: "Mid-Atlantic",
    climateBand: "cold",
    winterRangeLoss: "18-25%",
    chargingContext:
      "Baltimore has solid charging coverage along I-95 and in the Inner Harbor area. BGE's off-peak EV rates are among the best in the mid-Atlantic region. Row house neighborhoods create home charging challenges similar to Philadelphia.",
    fitNote:
      "Baltimore is a growing EV market — infrastructure is adequate for daily drivers, though cold winters require planning.",
  },
  "new-haven": {
    slug: "new-haven",
    name: "New Haven",
    state: "CT",
    region: "New England",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Connecticut's EV incentives are among the strongest in the Northeast, and Eversource has been expanding charging infrastructure. Yale's fleet electrification program has boosted local EV awareness.",
    fitNote:
      "New Haven is EV-friendly with strong Connecticut incentives — cold winters require a buffer routine.",
  },
  providence: {
    slug: "providence",
    name: "Providence",
    state: "RI",
    region: "New England",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Providence benefits from Rhode Island's strong EV incentive programs and National Grid's charging expansion. The compact metro area makes public charging access practical.",
    fitNote:
      "Providence is a good EV city for residents with home charging — Rhode Island's incentives reduce upfront costs significantly.",
  },
  buffalo: {
    slug: "buffalo",
    name: "Buffalo",
    state: "NY",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "30-40%",
    chargingContext:
      "Buffalo has some of the most severe EV operating conditions in the US — lake-effect snow, sustained sub-zero temperatures, and heavy snowfall can all affect range and charging access simultaneously. National Fuel and National Grid have expanded infrastructure, but home charging with a warm garage is essential.",
    fitNote:
      "Buffalo is one of the hardest EV cities in the US — heat pump models, a warm garage, and a serious buffer routine are all necessary.",
  },
  syracuse: {
    slug: "syracuse",
    name: "Syracuse",
    state: "NY",
    region: "Upstate New York",
    climateBand: "cold",
    winterRangeLoss: "28-38%",
    chargingContext:
      "Syracuse regularly receives the most snowfall of any major US city. EV charging access during winter storms is a real concern, and range loss in January can exceed 35%. Home charging in a heated garage is strongly recommended.",
    fitNote:
      "Syracuse winters are among the most demanding EV conditions in the country — only commit if you have solid home charging and a heat pump model.",
  },
  albany: {
    slug: "albany",
    name: "Albany",
    state: "NY",
    region: "Upstate New York",
    climateBand: "cold",
    winterRangeLoss: "25-33%",
    chargingContext:
      "Albany has solid charging coverage along the Thruway corridor and growing urban infrastructure. National Grid's EV programs are expanding. New York's Charge Ready program helps with workplace and multi-family charging.",
    fitNote:
      "Albany is EV-viable with home charging — cold winters require planning, but New York's incentive programs help.",
  },
  // ── Mid-Atlantic & Southeast ──────────────────────────────────────────────────
  richmond: {
    slug: "richmond",
    name: "Richmond",
    state: "VA",
    region: "Mid-Atlantic",
    climateBand: "varied",
    winterRangeLoss: "12-20%",
    chargingContext:
      "Richmond sits on the I-95 corridor with solid interstate charging coverage. Dominion Energy has been one of the most aggressive utilities in EV charging investment in the Southeast.",
    fitNote:
      "Richmond is a solid EV market — mild winters and Dominion's charging investment make it very accessible.",
  },
  "virginia-beach": {
    slug: "virginia-beach",
    name: "Virginia Beach",
    state: "VA",
    region: "Mid-Atlantic",
    climateBand: "varied",
    winterRangeLoss: "12-18%",
    chargingContext:
      "Virginia Beach has mild winters and growing charging infrastructure. Dominion Energy's Hampton Roads expansion has improved coverage throughout the 757 area code significantly since 2022.",
    fitNote:
      "Virginia Beach is a comfortable EV city — mild coastal climate and improving infrastructure.",
  },
  columbia: {
    slug: "columbia",
    name: "Columbia",
    state: "SC",
    region: "Southeast",
    climateBand: "varied",
    winterRangeLoss: "8-15%",
    chargingContext:
      "Columbia's charging network is modest but growing. SCE&G (now Dominion SC) has expanded public charging throughout the metro. The mild climate means range loss is minimal most of the year.",
    fitNote:
      "Columbia is EV-viable with its mild climate — charging infrastructure is adequate for daily drivers.",
  },
  // ── Texas additional ─────────────────────────────────────────────────────────
  "el-paso": {
    slug: "el-paso",
    name: "El Paso",
    state: "TX",
    region: "West Texas",
    climateBand: "hot",
    winterRangeLoss: "8-15%",
    chargingContext:
      "El Paso's charging network is thin relative to its size — plan longer routes carefully. The dry, high-altitude climate is generally gentle on batteries. El Paso Electric has begun expanding public charging.",
    fitNote:
      "El Paso is EV-viable for city driving — hot summers are manageable, but public charging requires more planning than in major metros.",
  },
  // ── Midwest additional ────────────────────────────────────────────────────────
  "twin-cities": {
    slug: "twin-cities",
    name: "Twin Cities",
    state: "MN",
    region: "Upper Midwest",
    climateBand: "cold",
    winterRangeLoss: "30-40%",
    chargingContext:
      "The Twin Cities metro (Minneapolis-St. Paul) has the most extensive EV charging network in Minnesota, with strong employer programs and growing public infrastructure. Xcel Energy's rates are moderate and include EV off-peak options.",
    fitNote:
      "The Twin Cities is a serious cold-climate EV market — comprehensive buffer routines and heat pump models are essential.",
  },
  madison: {
    slug: "madison",
    name: "Madison",
    state: "WI",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "28-36%",
    chargingContext:
      "Madison's high EV adoption relative to its size reflects its educated population and UW-Madison's sustainability focus. MGE (Madison Gas & Electric) has been aggressive in building charging infrastructure.",
    fitNote:
      "Madison is a surprisingly strong EV city — progressive charging investment and relatively affordable electricity offset the cold winters.",
  },
  "grand-rapids": {
    slug: "grand-rapids",
    name: "Grand Rapids",
    state: "MI",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "25-35%",
    chargingContext:
      "Grand Rapids has growing EV infrastructure driven by West Michigan's manufacturing sector. Consumers Energy's EV programs are expanding. Lake Michigan's influence makes winters cold and snowy.",
    fitNote:
      "Grand Rapids is EV-viable with home charging — lake-effect winters are serious and require buffer planning.",
  },
  // ── New England additional ────────────────────────────────────────────────────
  hartford: {
    slug: "hartford",
    name: "Hartford",
    state: "CT",
    region: "New England",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Hartford benefits from Connecticut's aggressive EV incentive programs and Eversource's infrastructure investment. The Wilbur Cross/I-84 corridor has solid fast-charging coverage.",
    fitNote:
      "Hartford is a solid EV city — Connecticut's incentives are among the strongest in the country, partially offsetting cold winters.",
  },
  manchester: {
    slug: "manchester",
    name: "Manchester",
    state: "NH",
    region: "New England",
    climateBand: "cold",
    winterRangeLoss: "22-30%",
    chargingContext:
      "New Hampshire's EV incentives are modest compared to neighboring states, but the charging network along I-93 and I-89 is solid. Eversource NH has expanded Level 2 coverage in Manchester and Nashua.",
    fitNote:
      "Manchester is EV-viable with home charging — cold winters and thinner public network require planning.",
  },
  burlington: {
    slug: "burlington",
    name: "Burlington",
    state: "VT",
    region: "New England",
    climateBand: "cold",
    winterRangeLoss: "25-35%",
    chargingContext:
      "Burlington has Vermont's highest EV adoption rate and some of the cleanest electricity in the US (nearly 100% renewable). Green Mountain Power's EV programs and battery storage initiatives are nationally recognized models.",
    fitNote:
      "Burlington is a leading cold-climate EV city — exceptional clean energy and strong utility programs offset demanding winters.",
  },
  // ── Mountain West additional ──────────────────────────────────────────────────
  "colorado-springs": {
    slug: "colorado-springs",
    name: "Colorado Springs",
    state: "CO",
    region: "Rocky Mountain",
    climateBand: "cold",
    winterRangeLoss: "18-28%",
    chargingContext:
      "Colorado Springs' high altitude (6,000 ft) adds modest range reduction year-round. CS Utilities has expanded charging, and the proximity to Pikes Peak makes for elevation-demanding driving conditions.",
    fitNote:
      "Colorado Springs is EV-viable — high altitude and cold winters require planning, but infrastructure is adequate.",
  },
  spokane: {
    slug: "spokane",
    name: "Spokane",
    state: "WA",
    region: "Inland Northwest",
    climateBand: "cold",
    winterRangeLoss: "22-30%",
    chargingContext:
      "Spokane has Avista Utilities' clean hydropower and expanding charging network. Winters are colder than Seattle but the I-90 corridor provides solid fast-charging access east to Montana.",
    fitNote:
      "Spokane is EV-viable with home charging — cold winters and a thinner network than Seattle require planning.",
  },
  tacoma: {
    slug: "tacoma",
    name: "Tacoma",
    state: "WA",
    region: "Pacific Northwest",
    climateBand: "mild",
    winterRangeLoss: "10-15%",
    chargingContext:
      "Tacoma shares Seattle's mild climate and benefits from Tacoma Public Utilities' low-cost hydropower — among the cheapest EV charging electricity in the US. The charging network mirrors Seattle's density.",
    fitNote:
      "Tacoma is an excellent EV city — cheap clean electricity and mild climate are a powerful combination.",
  },
  "baton-rouge": {
    slug: "baton-rouge",
    name: "Baton Rouge",
    state: "LA",
    region: "Gulf South",
    climateBand: "hot",
    winterRangeLoss: "5-10%",
    chargingContext:
      "Baton Rouge's charging infrastructure is growing but remains thinner than major metros. Entergy Louisiana has begun expanding public charging. Like New Orleans, hurricane preparedness means keeping charge above 50% during storm season.",
    fitNote:
      "Baton Rouge is EV-viable for daily driving — mild climate is ideal, but public charging requires planning outside urban areas.",
  },
  "little-rock": {
    slug: "little-rock",
    name: "Little Rock",
    state: "AR",
    region: "South-Central",
    climateBand: "varied",
    winterRangeLoss: "12-20%",
    chargingContext:
      "Little Rock's charging network is developing, with solid I-40 corridor coverage. Entergy Arkansas offers EV rate plans. Occasional ice storms require buffer planning.",
    fitNote:
      "Little Rock is EV-viable for home chargers — the public network is growing but requires planning for longer trips.",
  },
  "oklahoma-city": {
    slug: "oklahoma-city",
    name: "Oklahoma City",
    state: "OK",
    region: "South-Central",
    climateBand: "varied",
    winterRangeLoss: "15-22%",
    chargingContext:
      "OKC's charging network is thinner than major metros but improving. OG&E has invested in public charging. Variable winters — hot summers and occasional ice storms — create a wider range of EV operating conditions.",
    fitNote:
      "Oklahoma City is EV-viable with home charging — the charging network is adequate for city driving.",
  },
  tulsa: {
    slug: "tulsa",
    name: "Tulsa",
    state: "OK",
    region: "South-Central",
    climateBand: "varied",
    winterRangeLoss: "15-22%",
    chargingContext:
      "Tulsa's EV infrastructure has grown with PSO's charging expansion. The city benefits from relatively low electricity rates and the US Route 66 EV corridor initiative.",
    fitNote:
      "Tulsa is an emerging EV market — infrastructure is adequate for daily commuting with home charging.",
  },
  // ── Mid-South & Appalachia ─────────────────────────────────────────────────────
  knoxville: {
    slug: "knoxville",
    name: "Knoxville",
    state: "TN",
    region: "Appalachia",
    climateBand: "varied",
    winterRangeLoss: "12-20%",
    chargingContext:
      "Knoxville benefits from TVA's clean power mix and a growing charging network anchored by the University of Tennessee's sustainability programs. The Appalachian terrain adds elevation-related range consumption for some routes.",
    fitNote:
      "Knoxville is a solid EV city — low TVA electricity rates and mild-to-variable winters make it accessible.",
  },
  "chattanooga": {
    slug: "chattanooga",
    name: "Chattanooga",
    state: "TN",
    region: "Appalachia",
    climateBand: "varied",
    winterRangeLoss: "12-18%",
    chargingContext:
      "Chattanooga is home to Volkswagen's US EV plant and has developed some of the best EV infrastructure in the Southeast. EPB Fiber's smart grid integrates EV charging management. The city has more public Level 2 per capita than most US metros.",
    fitNote:
      "Chattanooga is one of the most EV-forward small cities in the US — VW's presence has created exceptional infrastructure.",
  },
  // ── Pacific ───────────────────────────────────────────────────────────────────
  honolulu: {
    slug: "honolulu",
    name: "Honolulu",
    state: "HI",
    region: "Pacific",
    climateBand: "mild",
    winterRangeLoss: "2-5%",
    chargingContext:
      "Honolulu has the unique advantage of minimal range loss year-round and some of the highest solar penetration in the US — many EV owners charge almost entirely on their own rooftop panels. HECO's grid electricity is expensive, making solar-plus-EV the gold standard.",
    fitNote:
      "Honolulu is ideal for EV ownership if you have solar access — near-zero range loss and the ability to charge from your own panels is a compelling combination.",
  },
  anchorage: {
    slug: "anchorage",
    name: "Anchorage",
    state: "AK",
    region: "Pacific",
    climateBand: "cold",
    winterRangeLoss: "35-50%",
    chargingContext:
      "Anchorage is one of the most extreme EV operating environments in the US. Winter temperatures regularly drop to -20°F or below, and range loss can exceed 50% on the coldest days. Chugach Electric has expanded charging, but the network is thin compared to the continental US.",
    fitNote:
      "Anchorage EV ownership requires serious commitment — extreme cold demands heat pump models, a warm garage, and aggressive buffer routines.",
  },
  // ── Great Plains ──────────────────────────────────────────────────────────────
  wichita: {
    slug: "wichita",
    name: "Wichita",
    state: "KS",
    region: "Great Plains",
    climateBand: "varied",
    winterRangeLoss: "18-25%",
    chargingContext:
      "Wichita's charging network is developing, with Evergy's investment in public infrastructure. The I-35 corridor has solid fast-charging. Variable climate ranges from hot summers to occasional severe winter storms.",
    fitNote:
      "Wichita is EV-viable with home charging as the anchor — the public network is adequate for city driving.",
  },
  // ── Southeast Atlantic ────────────────────────────────────────────────────────
  "columbia-sc": {
    slug: "columbia-sc",
    name: "Columbia",
    state: "SC",
    region: "Southeast",
    climateBand: "varied",
    winterRangeLoss: "8-15%",
    chargingContext:
      "Columbia, SC benefits from Dominion's active charging expansion and mild winters. The University of South Carolina has driven local EV awareness, and I-26 and I-77 corridors have solid coverage.",
    fitNote:
      "Columbia SC is a comfortable EV city — mild winters and improving Dominion infrastructure.",
  },
  savannah: {
    slug: "savannah",
    name: "Savannah",
    state: "GA",
    region: "Southeast",
    climateBand: "hot",
    winterRangeLoss: "5-10%",
    chargingContext:
      "Savannah's charging network has grown with Georgia Power's expansion and the Hyundai Metaplant America nearby — Savannah is now a center of EV manufacturing in the Southeast. Georgia Power's rate plans for EV owners are competitive.",
    fitNote:
      "Savannah is becoming an EV hub — the Hyundai Metaplant's proximity and mild climate make it a natural EV city.",
  },
  // ── Emerging metros ───────────────────────────────────────────────────────────
  "boise-id": {
    slug: "boise-id",
    name: "Boise Metro",
    state: "ID",
    region: "Pacific Northwest",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "The greater Boise metro (including Meridian, Nampa) has seen rapid EV adoption growth. Idaho Power's low rates and clean hydro mix make home charging very affordable. Public charging is developing but thinner than major West Coast metros.",
    fitNote:
      "Boise metro is EV-viable with home charging — cold winters and a developing public network require planning.",
  },
  provo: {
    slug: "provo",
    name: "Provo",
    state: "UT",
    region: "Intermountain West",
    climateBand: "cold",
    winterRangeLoss: "20-28%",
    chargingContext:
      "Provo-Orem has solid I-15 corridor charging and a tech-savvy population driving high EV adoption for its size. Rocky Mountain Power offers competitive EV rates.",
    fitNote:
      "Provo is a growing EV market — strong tech culture and improving infrastructure offset cold Utah winters.",
  },
  "fort-collins": {
    slug: "fort-collins",
    name: "Fort Collins",
    state: "CO",
    region: "Rocky Mountain",
    climateBand: "cold",
    winterRangeLoss: "18-25%",
    chargingContext:
      "Fort Collins and the Northern Colorado corridor have strong EV adoption driven by Colorado State University and the tech sector. Fort Collins Utilities offers excellent EV charging incentives.",
    fitNote:
      "Fort Collins is one of the most EV-progressive small cities in Colorado — strong incentives and growing infrastructure.",
  },
  "ann-arbor": {
    slug: "ann-arbor",
    name: "Ann Arbor",
    state: "MI",
    region: "Great Lakes",
    climateBand: "cold",
    winterRangeLoss: "25-33%",
    chargingContext:
      "Ann Arbor has the highest EV adoption rate in Michigan, driven by University of Michigan's automotive research and the density of auto industry engineers. DTE Energy's EV programs are extensive.",
    fitNote:
      "Ann Arbor is a leading EV city for Michigan — strong local expertise and utility programs offset cold winters.",
  },
};

export function getCity(slug: string): CityData | undefined {
  return cities[slug];
}

export function getAllCitySlugs(): string[] {
  return Object.keys(cities);
}
