/**
 * Brand-level service network and repair access data.
 *
 * Static knowledge — no API calls. Same pattern as BATTERY_WARRANTIES in
 * vehicle-model-knowledge.ts. Used to inject service context into the AI
 * receipt prompt so the analysis reflects real post-purchase ownership risk.
 */

export interface ServiceProfile {
  /** How easy it is to find an authorized service location */
  dealer_density: "sparse" | "moderate" | "dense";
  /**
   * full  = any independent shop can handle it
   * limited = software/warranty work requires an authorized dealer
   * none  = manufacturer controls the entire repair ecosystem (Tesla)
   */
  independent_shop_support: "full" | "limited" | "none";
  /**
   * common      = widely stocked at auto parts stores
   * specialized = OEM-sourced, not available at general auto parts stores
   * rare        = import-only, discontinued, or uncertain supply chain
   */
  parts_tier: "common" | "specialized" | "rare";
  service_cost_tier: "low" | "moderate" | "high";
  /** One-liner injected verbatim into the prompt */
  notes: string;
  /** Set when the manufacturer has filed bankruptcy or has uncertain long-term viability */
  bankruptcy_risk?: string;
}

// Key = lowercase brand name (may include model for brand-specific entries like "honda prologue")
const SERVICE_PROFILES: Record<string, ServiceProfile> = {
  tesla: {
    dealer_density: "dense",
    independent_shop_support: "none",
    parts_tier: "specialized",
    service_cost_tier: "moderate",
    notes:
      "Tesla operates a closed service ecosystem — only Tesla Service Centers and Mobile Service can perform warranty work and software updates. No independent shop access. Body repair requires a Tesla-approved body shop (limited availability outside major metros).",
  },
  chevrolet: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Chevy Bolt benefits from GM's dense dealer network and full independent shop support. Parts are widely available. One of the easiest used EVs to service outside major metros.",
  },
  chevy: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Chevy Bolt benefits from GM's dense dealer network and full independent shop support. Parts are widely available. One of the easiest used EVs to service outside major metros.",
  },
  hyundai: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Hyundai has a wide dealer network and full independent shop support. Ioniq 5/6 parts are well-stocked. Service cost is competitive with non-luxury EVs.",
  },
  kia: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Kia shares dealer infrastructure with Hyundai. EV6 parts are widely available and independent shops can handle most non-warranty work.",
  },
  nissan: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Nissan LEAF has one of the largest used EV service networks. Independent shops familiar with LEAF are common. Parts availability is strong.",
  },
  ford: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Ford's dealer network is dense and Mach-E parts are widely available. Independent shops can handle most non-software work.",
  },
  volkswagen: {
    dealer_density: "moderate",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "moderate",
    notes:
      "VW ID.4 software updates and warranty work require an authorized VW dealer — independent shops can handle basic maintenance but not OTA issues or high-voltage battery work. Parts are OEM-sourced and not available at general auto parts stores. Dealer network is moderate outside major metros.",
  },
  bmw: {
    dealer_density: "moderate",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "BMW iX and i-series warranty work requires an authorized BMW dealer. Independent shops can handle routine maintenance but not EV-specific high-voltage systems. Parts are specialized and expensive. Service cost is significantly higher than Korean or American EVs.",
  },
  volvo: {
    dealer_density: "sparse",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Volvo's dealer network is sparse outside major metros — buyers more than 50 miles from a dealer face meaningful service friction. Software updates and warranty work require a Volvo dealer. Parts are OEM-sourced and not stocked at general auto parts stores. Service cost is high relative to Korean or American EVs. Verify nearest dealer access before committing.",
  },
  rivian: {
    dealer_density: "sparse",
    independent_shop_support: "none",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Rivian operates a small network of service centers plus mobile service. No independent shop access. Parts supply chain is not mature — repair wait times can be long. Brand is still early-stage; long-term parts availability is uncertain.",
  },
  fisker: {
    dealer_density: "sparse",
    independent_shop_support: "none",
    parts_tier: "rare",
    service_cost_tier: "high",
    notes:
      "Fisker filed Chapter 11 bankruptcy in 2024. Dealer network has dissolved. No OTA software updates. Parts supply is uncertain and likely to worsen over time. Independent shops cannot access proprietary systems.",
    bankruptcy_risk:
      "Fisker filed Chapter 11 in 2024. No active dealer network, no OTA updates, and parts supply is deteriorating. Flag repair_risk_critical on all Fisker listings regardless of condition.",
  },
  "mercedes-benz": {
    dealer_density: "moderate",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Mercedes-Benz EQ-series service requires an authorized dealer for software, battery, and warranty work. Parts are premium-priced. Service cost is among the highest in the used EV market.",
  },
  mercedes: {
    dealer_density: "moderate",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Mercedes-Benz EQ-series service requires an authorized dealer for software, battery, and warranty work. Parts are premium-priced. Service cost is among the highest in the used EV market.",
  },
  audi: {
    dealer_density: "moderate",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Audi e-tron warranty and software work requires an authorized dealer. Parts are OEM-only and expensive. Service cost is high. Independent shops can handle routine maintenance only.",
  },
  subaru: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "moderate",
    notes:
      "Subaru Solterra shares its platform with the Toyota bZ4X — both Subaru and Toyota dealer networks can service it. Independent shops familiar with Subaru can handle most non-EV-specific work.",
  },
  toyota: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "moderate",
    notes:
      "Toyota bZ4X shares its platform with the Subaru Solterra — Toyota's dense dealer network provides strong service access. Parts are well-supported. Independent shops can handle most non-high-voltage work.",
  },
  vinfast: {
    dealer_density: "sparse",
    independent_shop_support: "none",
    parts_tier: "rare",
    service_cost_tier: "high",
    notes:
      "VinFast is a new Vietnamese brand with very limited US dealer presence. Parts pipeline is immature and import-sourced. No independent shop support. High risk for buyers outside major metros.",
  },
  "honda prologue": {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Honda Prologue is built on GM's Ultium platform — Chevrolet dealers can service it, giving it effectively the same dense service network as the Bolt. Parts availability is strong.",
  },
  honda: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "low",
    notes:
      "Honda Prologue is built on GM's Ultium platform — Chevrolet dealers can service it alongside Honda dealers, giving it a broad service network.",
  },
  mitsubishi: {
    dealer_density: "sparse",
    independent_shop_support: "limited",
    parts_tier: "rare",
    service_cost_tier: "moderate",
    notes:
      "Mitsubishi i-MiEV is discontinued. Dealer network has shrunk significantly. Parts are increasingly difficult to source. Flag service_network_sparse for any i-MiEV listing.",
  },
  polestar: {
    dealer_density: "sparse",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Polestar has limited service locations (Polestar Spaces) in select cities. Parts are Volvo-sourced but not widely stocked. Service friction is significant outside major metros.",
  },
  lucid: {
    dealer_density: "sparse",
    independent_shop_support: "none",
    parts_tier: "rare",
    service_cost_tier: "high",
    notes:
      "Lucid has very few service centers. No independent shop access. As a low-volume luxury startup, parts supply and long-term viability are risk factors. Not recommended without confirmed local service access.",
  },
  gmc: {
    dealer_density: "dense",
    independent_shop_support: "full",
    parts_tier: "common",
    service_cost_tier: "moderate",
    notes:
      "GMC Hummer EV and Sierra EV use GM's Ultium platform. GM's dense dealer network provides strong service access. Parts are well-supported across the GM ecosystem.",
  },
  cadillac: {
    dealer_density: "moderate",
    independent_shop_support: "limited",
    parts_tier: "specialized",
    service_cost_tier: "high",
    notes:
      "Cadillac LYRIQ uses GM's Ultium platform but is serviced at Cadillac dealers only. Dealer density is moderate. Service cost is higher than mainstream GM brands.",
  },
};

/**
 * Returns the service profile for a given make, or null if the brand is not
 * in the table (treated as average risk — no injection needed).
 */
export function getServiceProfile(make: string): ServiceProfile | null {
  if (!make) return null;
  const key = make.toLowerCase().trim();
  return SERVICE_PROFILES[key] ?? null;
}

/**
 * Builds a formatted service block string for AI prompt injection.
 * Returns null for unknown brands (no injection = no noise for well-covered brands
 * we haven't profiled yet).
 */
export function buildServiceBlock(make: string, model?: string): string | null {
  // Check for model-specific override first (e.g., "honda prologue")
  if (model) {
    const modelKey = `${make} ${model}`.toLowerCase().trim();
    const modelProfile = SERVICE_PROFILES[modelKey];
    if (modelProfile) {
      return formatServiceBlock(make, modelProfile);
    }
  }

  const profile = getServiceProfile(make);
  if (!profile) return null;

  return formatServiceBlock(make, profile);
}

function formatServiceBlock(make: string, profile: ServiceProfile): string {
  const brandLabel = make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
  const lines: string[] = [`Service & Repair Access (${brandLabel}):`];

  if (profile.bankruptcy_risk) {
    lines.push(`⚠ MANUFACTURER RISK: ${profile.bankruptcy_risk}`);
  }

  lines.push(`- Dealer network: ${profile.dealer_density}`);
  lines.push(`- Independent shop support: ${profile.independent_shop_support}`);
  lines.push(`- Parts availability: ${profile.parts_tier}`);
  lines.push(`- Service cost tier: ${profile.service_cost_tier}`);
  lines.push(`- Context: ${profile.notes}`);

  // Signal guidance for the AI
  if (profile.bankruptcy_risk) {
    lines.push("- INSTRUCTION: Flag repair_risk_critical in listing_signals.");
  } else if (profile.dealer_density === "sparse" || profile.independent_shop_support === "none") {
    lines.push(
      "- INSTRUCTION: Flag service_network_sparse in listing_signals if the listing location is rural or the buyer has not confirmed local service access."
    );
    if (profile.independent_shop_support === "none") {
      lines.push(
        "- INSTRUCTION: Flag independent_shop_restricted in listing_signals — no independent shop access for this brand."
      );
    }
  } else if (profile.independent_shop_support === "limited") {
    lines.push(
      "- INSTRUCTION: Flag independent_shop_restricted in listing_signals if routine context suggests the buyer relies on independent shops or is in a rural area."
    );
  }

  return lines.join("\n");
}
