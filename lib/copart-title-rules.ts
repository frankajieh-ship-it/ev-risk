/**
 * Copart Title Rules — US State Rebuilt Title Data
 *
 * Static lookup: state code → rebuilt title requirements.
 * Used by TitleFlagsCard to show state-specific guidance.
 */

export interface StateTitleRule {
  state: string;
  rebuilt_allowed: boolean;
  inspection_required: boolean;
  waiting_period_days: number | null;
  resale_value_impact: "severe" | "moderate" | "mild";
  notes: string;
  dmv_url: string;
}

export const STATE_CODES = [
  "CA", "TX", "FL", "NY", "IL", "WA", "OH", "PA", "GA", "AZ",
  "NC", "NJ", "CO", "TN", "MI", "VA", "IN", "MN", "WI", "MO",
] as const;

export type StateCode = (typeof STATE_CODES)[number];

export const TITLE_RULES: Record<StateCode, StateTitleRule> = {
  CA: {
    state: "California",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "severe",
    notes: "Requires a referee inspection at a BAR (Bureau of Automotive Repair) location before a rebuilt title is issued. Strict inspection; EV battery systems flagged. Significantly reduces resale value.",
    dmv_url: "https://www.dmv.ca.gov/portal/vehicle-registration/salvage-certificates-and-title/",
  },
  TX: {
    state: "Texas",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "Texas DPS inspection required. Must pass safety inspection at a licensed inspection station. Rebuilt title must be disclosed at sale.",
    dmv_url: "https://www.txdmv.gov/motorists/buying-or-selling-a-vehicle/salvage-vehicles",
  },
  FL: {
    state: "Florida",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "No physical inspection required, but title must be branded 'Rebuilt Salvage'. Flood damage must be separately disclosed. Moderate impact on resale and insurance.",
    dmv_url: "https://www.flhsmv.gov/motor-vehicles-tags-titles/titles/salvage-rebuilt-titles/",
  },
  NY: {
    state: "New York",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "severe",
    notes: "DMV inspection required at an official inspection station. NY has strict anti-fraud rules around rebuilt titles. High insurance premiums post-rebuild; many carriers decline coverage.",
    dmv_url: "https://dmv.ny.gov/registration/register-rebuilt-salvage-vehicle",
  },
  IL: {
    state: "Illinois",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required. Must disclose salvage history. Illinois buyers are generally more accepting of rebuilt titles than coastal states.",
    dmv_url: "https://www.ilsos.gov/departments/vehicles/titles/rebuilttitle.html",
  },
  WA: {
    state: "Washington",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "Vehicle must pass a Washington State Patrol inspection. Title branded 'Rebuilt Salvage'. Some insurers restrict comprehensive coverage.",
    dmv_url: "https://www.dol.wa.gov/vehicles-and-boats/buying-and-selling-vehicles/salvage-vehicles",
  },
  OH: {
    state: "Ohio",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required for rebuilt title. Must disclose prior salvage status. Generally buyer-friendly market for rebuilt vehicles.",
    dmv_url: "https://www.bmv.ohio.gov/titles-rebuilt.aspx",
  },
  PA: {
    state: "Pennsylvania",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "Requires a PennDOT-authorized inspection. Branded 'Reconstructed' on title. Must pass emissions if applicable. Moderate impact on insurance and resale.",
    dmv_url: "https://www.dmv.pa.gov/VEHICLE-SERVICES/Title-Registration/Pages/Reconstructed-Vehicles.aspx",
  },
  GA: {
    state: "Georgia",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No formal inspection required. Title branded 'Rebuilt'. Georgia is one of the more lenient states for rebuilt title vehicles.",
    dmv_url: "https://dor.georgia.gov/motor-vehicle/rebuild-salvage-titles",
  },
  AZ: {
    state: "Arizona",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required. Title branded 'Rebuilt Salvage'. Arizona is generally accepting of rebuilt titles; lower insurance impact than coastal states.",
    dmv_url: "https://azdot.gov/motor-vehicles/vehicle-title-and-registration/salvage-titles",
  },
  NC: {
    state: "North Carolina",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required for rebuilt title. Must pass standard NC vehicle inspection. Disclosure required at sale.",
    dmv_url: "https://www.ncdot.gov/dmv/title-registration/titles/Pages/rebuilt-vehicle.aspx",
  },
  NJ: {
    state: "New Jersey",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "NJ MVC inspection required. Title branded 'Rebuilt'. High insurance market means some carriers decline coverage for rebuilt vehicles.",
    dmv_url: "https://www.state.nj.us/mvc/vehicles/regtitlesSalvage.htm",
  },
  CO: {
    state: "Colorado",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "VIN verification and emissions test required. Title branded 'Rebuilt'. Colorado requires emissions compliance which can be challenging post-repair.",
    dmv_url: "https://dmv.colorado.gov/salvage-title",
  },
  TN: {
    state: "Tennessee",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required. Title branded 'Non-Repairable' (if parts only) or 'Rebuilt Salvage'. Lenient market for rebuilt vehicles.",
    dmv_url: "https://tnk12.gov/licensing/Motor-Vehicle/mv-services/titles/salvage.htm",
  },
  MI: {
    state: "Michigan",
    rebuilt_allowed: true,
    inspection_required: true,
    waiting_period_days: null,
    resale_value_impact: "moderate",
    notes: "Michigan State Police inspection required. Title branded 'Rebuilt'. Michigan is a large auction market — rebuilt vehicles have reasonable resale.",
    dmv_url: "https://www.michigan.gov/sos/vehicle-services/titling/salvage-vehicles",
  },
  VA: {
    state: "Virginia",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No special inspection beyond standard VA safety inspection. Title branded 'Rebuilt'. Reasonable acceptance in the used car market.",
    dmv_url: "https://www.dmv.virginia.gov/vehicles/#salvage_rebuilt.asp",
  },
  IN: {
    state: "Indiana",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required. Title branded 'Rebuilt Salvage'. Indiana has a large auction market and rebuilt vehicles are commonly traded.",
    dmv_url: "https://www.in.gov/bmv/titles-and-registration/titles/salvage-title/",
  },
  MN: {
    state: "Minnesota",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required. Title branded 'Rebuilt'. Rust/corrosion from winter salt is an additional concern when buying rebuilt vehicles in MN.",
    dmv_url: "https://dps.mn.gov/divisions/dvs/Pages/titles-rebuilt.aspx",
  },
  WI: {
    state: "Wisconsin",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No inspection required. Title branded 'Salvage Rebuilt'. Standard disclosure rules apply. Moderate acceptance in the used car market.",
    dmv_url: "https://www.dot.wi.gov/drivers/titles/salvage.aspx",
  },
  MO: {
    state: "Missouri",
    rebuilt_allowed: true,
    inspection_required: false,
    waiting_period_days: null,
    resale_value_impact: "mild",
    notes: "No special inspection required beyond standard MO safety inspection. Title branded 'Reconstructed'. Buyer-friendly market for rebuilt vehicles.",
    dmv_url: "https://dor.mo.gov/vehicles/titling/salvage-reconstruction.php",
  },
};

/**
 * Look up a state code from a US ZIP code (first digit prefix heuristic).
 * Returns null if zip is not 5 digits or state can't be determined.
 * This is a rough approximation — use for display hints only.
 */
export function guessStateFromZip(zip: string | null | undefined): StateCode | null {
  if (!zip || !/^\d{5}/.test(zip)) return null;
  const prefix = parseInt(zip.slice(0, 3), 10);

  if (prefix >= 900 && prefix <= 961) return "CA";
  if (prefix >= 750 && prefix <= 799) return "TX";
  if (prefix >= 320 && prefix <= 349) return "FL";
  if (prefix >= 100 && prefix <= 149) return "NY";
  if (prefix >= 600 && prefix <= 629) return "IL";
  if (prefix >= 980 && prefix <= 994) return "WA";
  if (prefix >= 430 && prefix <= 458) return "OH";
  if (prefix >= 150 && prefix <= 196) return "PA";
  if (prefix >= 300 && prefix <= 319) return "GA";
  if (prefix >= 850 && prefix <= 865) return "AZ";
  if (prefix >= 270 && prefix <= 289) return "NC";
  if (prefix >= 70 && prefix <= 89) return "NJ";
  if (prefix >= 800 && prefix <= 816) return "CO";
  if (prefix >= 370 && prefix <= 385) return "TN";
  if (prefix >= 480 && prefix <= 499) return "MI";
  if (prefix >= 220 && prefix <= 246) return "VA";
  if (prefix >= 460 && prefix <= 479) return "IN";
  if (prefix >= 550 && prefix <= 567) return "MN";
  if (prefix >= 530 && prefix <= 549) return "WI";
  if (prefix >= 630 && prefix <= 658) return "MO";
  return null;
}
