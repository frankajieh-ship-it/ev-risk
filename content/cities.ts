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
};

export function getCity(slug: string): CityData | undefined {
  return cities[slug];
}

export function getAllCitySlugs(): string[] {
  return Object.keys(cities);
}
