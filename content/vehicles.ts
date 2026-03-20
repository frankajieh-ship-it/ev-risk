/**
 * Vehicle-specific SEO landing pages
 *
 * Top searched models from analytics: Sonata Hybrid, Tesla Model 3,
 * Mustang EcoBoost, VW ID.4. Each page funnels high-intent traffic
 * into /receipt with make/model pre-filled.
 */

import type { SeoPageContent } from "./types";

export const vehicles: Record<string, SeoPageContent> = {
  "tesla-model-3": {
    slug: "tesla-model-3",
    routeType: "vehicles",
    title: "Tesla Model 3 Buyer's Guide — Used & New Deal Check",
    metaDescription:
      "Buying a used Tesla Model 3? Get a deal verdict, risk flags, and what to ask the seller — in seconds. Check battery degradation, recall history, and fair price.",
    ogTitle: "Tesla Model 3 Buyer's Guide | OFFO Deal Check",
    ogDescription:
      "Paste your Tesla Model 3 listing URL and get an instant deal verdict: battery health flags, pricing analysis, and must-ask questions for the seller.",
    canonical: "/vehicles/tesla-model-3",
    headline: "Buying a Tesla Model 3? Check the Deal First.",
    subheadline:
      "Paste the listing URL or VIN. Get a deal verdict, battery risk flags, and the exact questions to ask before you hand over a deposit.",
    badgeText: "Tesla Model 3 Buyer's Guide",
    bullets: [
      {
        icon: "Battery",
        title: "Battery Degradation Risk",
        description:
          "Check for high Supercharger session counts, which indicate heavy fast-charging that degrades the pack faster. Ask for the current battery range estimate from the car's display.",
      },
      {
        icon: "Zap",
        title: "Charging Port & Software Version",
        description:
          "Older Model 3s use a proprietary Tesla connector. Verify the charge port type and whether the car has received recent over-the-air software updates for full feature access.",
      },
      {
        icon: "FileWarning",
        title: "Recall & Service Campaign History",
        description:
          "Tesla has issued multiple service bulletins covering suspension, seatbelt pretensioners, and FSD hardware. Run the VIN through NHTSA before committing.",
      },
      {
        icon: "DollarSign",
        title: "CPO vs Private Sale Pricing",
        description:
          "Tesla Certified Pre-Owned listings carry a premium but include a warranty extension. Private market Model 3s often undercut CPO by 10-15% — know the difference before negotiating.",
      },
      {
        icon: "Wrench",
        title: "Inspect Before You Buy",
        description:
          "Check panel gaps (they vary by production year), frunk latch operation, and the 12V battery condition. A pre-purchase inspection from a Tesla-certified shop costs ~$150 and is worth it.",
      },
    ],
    faq: [
      {
        question: "What mileage is too high for a used Tesla Model 3?",
        answer:
          "Most Model 3 battery packs handle 150,000+ miles well, but charging habits matter more than mileage. Look for a car kept predominantly on Level 2 home charging rather than daily Supercharging.",
      },
      {
        question: "How do I check a Tesla Model 3's battery health?",
        answer:
          "Ask the seller to show you the battery's current range estimate vs. the EPA-rated range for that year. A 2019 Standard Range Plus rated at 220 miles showing 190+ is healthy. Under 80% is a concern.",
      },
      {
        question: "Is a Tesla Model 3 with 100k miles a good buy?",
        answer:
          "It depends on how it was charged. High-mileage Model 3s with predominantly home charging and minimal Supercharging can still retain 90%+ battery capacity. Pull the service history and ask about charging habits.",
      },
      {
        question: "What should I negotiate on a used Tesla Model 3?",
        answer:
          "Battery range loss, missing FSD or Enhanced Autopilot (if advertised), any paint or cosmetic issues, and missing charging equipment (J1772 adapter, mobile connector) are all fair negotiation points.",
      },
    ],
    ctaHeadline: "Get Your Tesla Model 3 Deal Check",
    ctaDescription:
      "Paste the listing URL or VIN below. Get verdict, risk flags, and what to ask the seller — free, in under 30 seconds.",
    ctaButtonText: "Analyze This Model 3",
    ctaPlaceholder: "Paste listing URL (CarGurus, AutoTrader, Tesla, etc.)",
    showSamplePreview: true,
    pageSource: "vehicle_landing_model3",
    publishedDate: "2026-03-01",
    modifiedDate: "2026-03-20",
  },

  "hyundai-sonata-hybrid": {
    slug: "hyundai-sonata-hybrid",
    routeType: "vehicles",
    title: "Hyundai Sonata Hybrid Buyer's Guide — Used Deal Check",
    metaDescription:
      "Buying a used Hyundai Sonata Hybrid? Check if you're getting a fair deal: hybrid battery health, known issues, pricing, and must-ask questions for the seller.",
    ogTitle: "Hyundai Sonata Hybrid Buyer's Guide | OFFO Deal Check",
    ogDescription:
      "Paste your Sonata Hybrid listing URL and get an instant deal verdict, hybrid battery flags, and negotiation points.",
    canonical: "/vehicles/hyundai-sonata-hybrid",
    headline: "Buying a Hyundai Sonata Hybrid? Know the Risks First.",
    subheadline:
      "Get an instant deal verdict on any used Sonata Hybrid listing — battery health flags, fair price range, and the questions to ask before you sign.",
    badgeText: "Hyundai Sonata Hybrid Guide",
    bullets: [
      {
        icon: "Battery",
        title: "Hybrid Battery Warranty",
        description:
          "Hyundai covers the hybrid battery for 10 years / 100,000 miles on most Sonata Hybrid trims. Verify whether the original warranty is still active and check if any battery-related TSBs have been issued.",
      },
      {
        icon: "Wrench",
        title: "Known Transmission & Engine Issues",
        description:
          "2020-2022 Sonata Hybrids had some reports of hesitation and software calibration issues on the 6-speed wet dual-clutch transmission. Ask for service history and whether any recalls were addressed.",
      },
      {
        icon: "FileWarning",
        title: "Theta II Engine Recall History",
        description:
          "Earlier Sonata Hybrids (2015-2019) used the Theta II engine which was subject to oil consumption and seizure recalls. Confirm VIN-level recall completion before buying.",
      },
      {
        icon: "DollarSign",
        title: "Private vs Dealer Pricing",
        description:
          "Sonata Hybrids depreciate roughly 40-50% over the first 3 years. A certified pre-owned from Hyundai includes an extended powertrain warranty — worth the premium if the hybrid battery warranty has expired.",
      },
      {
        icon: "Gauge",
        title: "Fuel Economy in Real-World Use",
        description:
          "The Sonata Hybrid's EPA rating (44-54 mpg) is achievable but drops in cold weather or highway-heavy driving. Ask the seller for their typical fuel economy readings.",
      },
    ],
    faq: [
      {
        question: "How long does a Hyundai Sonata Hybrid battery last?",
        answer:
          "Hyundai's hybrid battery typically lasts 150,000-200,000 miles under normal use. The 10-year / 100,000-mile warranty provides significant protection for used buyers still within that window.",
      },
      {
        question: "Is a used Hyundai Sonata Hybrid reliable?",
        answer:
          "Generally yes — the Sonata Hybrid has a strong reliability record compared to traditional sedans. The main risk is ensuring recalled engines (Theta II) were properly serviced on older models.",
      },
      {
        question: "What year Sonata Hybrid should I avoid?",
        answer:
          "2015-2017 models with the Theta II engine had recall issues. The 2020+ generation with the new 2.0L Atkinson cycle engine and improved transmission is a cleaner choice.",
      },
    ],
    ctaHeadline: "Check Your Sonata Hybrid Deal",
    ctaDescription:
      "Paste the listing URL below — get a deal verdict, risk flags, and what to negotiate in under 30 seconds.",
    ctaButtonText: "Analyze This Sonata Hybrid",
    ctaPlaceholder: "Paste listing URL (CarGurus, AutoTrader, Carvana, etc.)",
    showSamplePreview: true,
    pageSource: "vehicle_landing_sonata_hybrid",
    publishedDate: "2026-03-01",
    modifiedDate: "2026-03-20",
  },

  "volkswagen-id4": {
    slug: "volkswagen-id4",
    routeType: "vehicles",
    title: "Volkswagen ID.4 Buyer's Guide — Used EV Deal Check",
    metaDescription:
      "Buying a used Volkswagen ID.4? Check battery health, software issues, warranty status, and whether you're getting a fair price before you buy.",
    ogTitle: "VW ID.4 Buyer's Guide | OFFO Deal Check",
    ogDescription:
      "Paste your VW ID.4 listing URL and get an instant deal verdict — battery flags, software quirks, pricing, and negotiation points.",
    canonical: "/vehicles/volkswagen-id4",
    headline: "Buying a VW ID.4? Here's What to Check.",
    subheadline:
      "The ID.4 has had well-documented software and charging issues. Know the risks before you commit — paste the listing and get an instant verdict.",
    badgeText: "VW ID.4 Buyer's Guide",
    bullets: [
      {
        icon: "Battery",
        title: "Battery & Range Reality Check",
        description:
          "ID.4 real-world range runs 15-20% below EPA estimates in cold weather. The 77 kWh pack is solid, but check whether the car has received the latest battery management firmware updates.",
      },
      {
        icon: "Zap",
        title: "Charging Speed Issues (Early Build Years)",
        description:
          "2021-2022 ID.4s had widely-reported DC fast charging throttling issues capped at 50kW on certain builds. Later software updates addressed this. Verify the charging software version before buying.",
      },
      {
        icon: "FileWarning",
        title: "Widespread Software Recalls",
        description:
          "The ID.4 has had multiple NHTSA recall campaigns covering the infotainment system, emergency call feature, and rear camera. Run the VIN through NHTSA to confirm all recalls were completed.",
      },
      {
        icon: "Wrench",
        title: "12V Battery & Electronics",
        description:
          "Early ID.4s had reported failures with the 12V auxiliary battery causing full system lockouts. Ask for service records and whether the 12V battery has been replaced or inspected recently.",
      },
      {
        icon: "DollarSign",
        title: "Pricing vs Competitors",
        description:
          "Used ID.4s depreciate faster than Tesla Model Y or Model 3 due to software stigma. This creates genuine bargain opportunities — but only if the software issues have been resolved.",
      },
    ],
    faq: [
      {
        question: "Are VW ID.4 software problems fixed?",
        answer:
          "Significantly improved since launch. The 3.1 and 3.2 software updates resolved most charging and UI issues. Ask the seller for the current software version and when the last OTA update was applied.",
      },
      {
        question: "Is the VW ID.4 reliable for daily driving?",
        answer:
          "Yes for most owners after the software updates. Early 2021 models had the most issues. 2022+ models with updated firmware and the PRO S trim tend to be more reliable choices.",
      },
      {
        question: "How does the VW ID.4 hold up in winter?",
        answer:
          "The ID.4 lacks a heat pump on lower trims, which significantly impacts winter range efficiency. AWD models with heat pump handle cold climates much better than the base RWD version.",
      },
    ],
    ctaHeadline: "Check Your VW ID.4 Deal",
    ctaDescription:
      "Paste the listing URL or VIN — get a deal verdict, software version flags, and what to ask the seller.",
    ctaButtonText: "Analyze This ID.4",
    ctaPlaceholder: "Paste listing URL (CarGurus, AutoTrader, Carvana, etc.)",
    showSamplePreview: true,
    pageSource: "vehicle_landing_id4",
    publishedDate: "2026-03-01",
    modifiedDate: "2026-03-20",
  },

  "chevy-bolt-ev": {
    slug: "chevy-bolt-ev",
    routeType: "vehicles",
    title: "Chevy Bolt EV Buyer's Guide — Used Deal Check",
    metaDescription:
      "Buying a used Chevy Bolt EV? Check battery replacement status, fire recall history, pricing, and what to ask the seller before you buy.",
    ogTitle: "Chevy Bolt EV Buyer's Guide | OFFO Deal Check",
    ogDescription:
      "Paste your Chevy Bolt EV listing URL and get an instant deal verdict — battery status, recall history, fair pricing, and negotiation points.",
    canonical: "/vehicles/chevy-bolt-ev",
    headline: "Buying a Used Chevy Bolt EV? Check This First.",
    subheadline:
      "The Bolt had a major fire recall requiring full battery replacements. Make sure yours has the new pack — and get a deal verdict before you buy.",
    badgeText: "Chevy Bolt EV Buyer's Guide",
    bullets: [
      {
        icon: "Battery",
        title: "Battery Replacement Status — Critical",
        description:
          "GM recalled all 2017-2022 Bolt EVs and replaced the full battery pack. Any used Bolt should have a documented battery replacement. Ask for the service record before anything else.",
      },
      {
        icon: "FileWarning",
        title: "Confirm the Recall Was Completed",
        description:
          "Run the VIN through NHTSA.gov and GM's recall lookup tool. A Bolt with an unresolved fire recall battery is a liability — walk away unless the replacement is confirmed in writing.",
      },
      {
        icon: "DollarSign",
        title: "Exceptional Value Post-Recall",
        description:
          "Bolts with confirmed battery replacements are among the best-value used EVs on the market — often under $20K with a factory-fresh battery. The recall stigma creates real buying opportunities.",
      },
      {
        icon: "Zap",
        title: "Charging Speed Reality",
        description:
          "The Bolt only supports 55kW DC fast charging (earlier models: 50kW), which is slow by modern standards. For daily commuting with home charging, this is fine — for road trips, it's a real constraint.",
      },
      {
        icon: "Gauge",
        title: "Range Retention After Replacement",
        description:
          "Post-recall Bolts with new LG batteries are starting essentially fresh. 259-mile EPA range (2020+) is realistic in mild weather, dropping ~25% in hard winter conditions.",
      },
    ],
    faq: [
      {
        question: "Are all Chevy Bolt fire recall batteries replaced?",
        answer:
          "Not automatically — owners had to schedule the replacement. Always verify via VIN lookup on NHTSA.gov that the specific car you're buying had the recall completed.",
      },
      {
        question: "Is a Chevy Bolt EV reliable after the recall fix?",
        answer:
          "Yes. Post-recall Bolts with new batteries have been solid performers. The mechanical simplicity of the platform (no engine, simple transmission) means fewer failure points than a traditional car.",
      },
      {
        question: "What's a fair price for a used 2022 Chevy Bolt?",
        answer:
          "As of early 2026, confirmed-recall-complete 2022 Bolt EVs are selling in the $16,000-$22,000 range depending on mileage and trim. Anything above $22K for a 2022 model with 30k+ miles needs justification.",
      },
    ],
    ctaHeadline: "Check Your Chevy Bolt Deal",
    ctaDescription:
      "Paste the listing URL or VIN. We'll check the deal verdict, recall status flags, and price analysis instantly.",
    ctaButtonText: "Analyze This Bolt EV",
    ctaPlaceholder: "Paste listing URL (CarGurus, AutoTrader, Carvana, etc.)",
    showSamplePreview: true,
    pageSource: "vehicle_landing_bolt",
    publishedDate: "2026-03-01",
    modifiedDate: "2026-03-20",
  },

  "ford-mustang-mach-e": {
    slug: "ford-mustang-mach-e",
    routeType: "vehicles",
    title: "Ford Mustang Mach-E Buyer's Guide — Used Deal Check",
    metaDescription:
      "Buying a used Ford Mustang Mach-E? Check battery health, software recall history, charging speed, and fair pricing before you commit.",
    ogTitle: "Ford Mustang Mach-E Buyer's Guide | OFFO Deal Check",
    ogDescription:
      "Paste your Mustang Mach-E listing URL and get an instant deal verdict — battery health, recall status, pricing, and negotiation points.",
    canonical: "/vehicles/ford-mustang-mach-e",
    headline: "Buying a Mustang Mach-E? Here's What to Check.",
    subheadline:
      "The Mach-E has had multiple recalls and a well-documented charging reliability issue. Get the full picture before you buy.",
    badgeText: "Ford Mustang Mach-E Guide",
    bullets: [
      {
        icon: "Battery",
        title: "High-Voltage Battery & 12V Failures",
        description:
          "Mach-E owners reported unexpected shutdowns related to both the high-voltage battery management system and the 12V battery. Ask for any service history related to these components.",
      },
      {
        icon: "FileWarning",
        title: "Multiple Recall Campaigns",
        description:
          "Ford has issued recalls covering the Mach-E's onboard charger (overheating risk), brake fluid leak potential, and SYNC infotainment. Verify all VIN-level recalls are resolved before purchasing.",
      },
      {
        icon: "Zap",
        title: "DC Fast Charging Reliability",
        description:
          "Early Mach-Es had reported failures with the onboard charger — Ford issued a TSB and recall to address this. Confirm the fix was applied and test DC fast charging if possible during the test drive.",
      },
      {
        icon: "DollarSign",
        title: "Pricing Relative to Model Y",
        description:
          "The Mach-E competes directly with the Tesla Model Y but depreciated significantly faster. This makes it a potential value buy — but only after confirming recalls are resolved.",
      },
      {
        icon: "Gauge",
        title: "Real-World Range",
        description:
          "Extended Range models (88 kWh) deliver close to their 300-mile EPA rating in mild conditions. Standard Range models are more like 210-230 miles real-world — closer to a Model 3 Standard Range.",
      },
    ],
    faq: [
      {
        question: "Is the Ford Mustang Mach-E reliable?",
        answer:
          "Mixed record. 2021-2022 models had significant recall and reliability issues. 2023+ models with updated software and hardware revisions are more reliable. Service history is essential.",
      },
      {
        question: "How fast does the Mach-E charge?",
        answer:
          "Up to 150kW DC fast charging on Extended Range models, 115kW on Standard Range. Real-world rates are typically 10-20% lower. Level 2 home charging: up to 10.5kW (about 30 miles/hour).",
      },
      {
        question: "What's a fair price for a used 2022 Mustang Mach-E?",
        answer:
          "Select trim 2022 Mach-Es (extended range AWD) range from $28,000-$36,000 depending on mileage and recall status. Premium trims and GT variants command more. Avoid any car with open recalls.",
      },
    ],
    ctaHeadline: "Check Your Mach-E Deal",
    ctaDescription:
      "Paste the listing URL or VIN — get a deal verdict, recall flags, and what to ask the seller.",
    ctaButtonText: "Analyze This Mach-E",
    ctaPlaceholder: "Paste listing URL (CarGurus, AutoTrader, Carvana, etc.)",
    showSamplePreview: true,
    pageSource: "vehicle_landing_mach_e",
    publishedDate: "2026-03-01",
    modifiedDate: "2026-03-20",
  },
};

export function getVehiclePage(slug: string): SeoPageContent | null {
  return vehicles[slug] ?? null;
}

export function getAllVehicleSlugs(): string[] {
  return Object.keys(vehicles);
}

/** Map slug → receipt prefill query params */
export const vehiclePrefillParams: Record<string, { make: string; model: string }> = {
  "tesla-model-3": { make: "Tesla", model: "Model 3" },
  "hyundai-sonata-hybrid": { make: "Hyundai", model: "Sonata Hybrid" },
  "volkswagen-id4": { make: "Volkswagen", model: "ID.4" },
  "chevy-bolt-ev": { make: "Chevrolet", model: "Bolt EV" },
  "ford-mustang-mach-e": { make: "Ford", model: "Mustang Mach-E" },
};
