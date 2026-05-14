import Link from "next/link";
import RelatedPosts from "@/components/RelatedPosts";

const RELATED_POSTS = [
  { slug: "carfax-alternative-used-ev", title: "I Was Paying $45 for Carfax Reports. Then I Found a Better Way.", badge: "Buyer's Guide", badgeColor: "bg-blue-500/20 text-blue-300", excerpt: "After testing every major VIN report on real EV listings, one free tool changed everything." },
  { slug: "ev-vin-report-guide", title: "EV VIN Report: What It Shows and What It Misses", badge: "Buyer's Guide", badgeColor: "bg-blue-500/20 text-blue-300", excerpt: "Standard VIN reports miss battery degradation, DCFC speed, and EV-specific recalls." },
  { slug: "used-ev-buying-checklist", title: "Used EV Buying Checklist: 10 Things to Check Before You Buy", badge: "Checklist", badgeColor: "bg-amber-500/20 text-amber-300", excerpt: "The complete pre-purchase checklist for used EV buyers." },
];

// ─── Data ────────────────────────────────────────────────────────────────────

const PICKS = [
  {
    id: "offo",
    rank: 1,
    name: "OFFO",
    tagline: "Best EV-Specific Risk Analysis",
    badge: "Editors' #1 Pick · Best for Used EV Buyers",
    stars: 5,
    rating: "4.9",
    href: "/receipt",
    cta: "Try Free →",
    ctaNote: "On OFFO — No sign-up required",
    promotion: "Free for all used EV shoppers — no credit card, no sign-up",
    bullets: [
      "EV-specific signals: battery health estimate, DC fast charge support, open recalls",
      "AI verdict (GREEN / YELLOW / RED) with 50+ structured risk factors",
      "Price vs. market context — tells you if the asking price is actually fair",
    ],
    promoHighlight: true,
    isOffo: true,
  },
  {
    id: "autocheck",
    rank: 2,
    name: "AutoCheck",
    tagline: "Best for Auction and Dealer Data",
    badge: "2026 Editors' Choice · Best for Auction Data",
    stars: 4,
    rating: "4.5",
    href: "https://www.autocheck.com",
    cta: "Check VIN →",
    ctaNote: "On AutoCheck's website",
    bullets: [
      "Strong integration with dealer and auction inventory networks",
      "AutoCheck Score provides a quick reference for comparing vehicles",
      "Useful ownership timeline and title history overview",
    ],
  },
  {
    id: "bumper",
    rank: 3,
    name: "Bumper",
    tagline: "Best for Report Readability",
    badge: "2026 Editors' Choice · Best Report Layout",
    stars: 4,
    rating: "4.4",
    href: "https://www.bumper.com",
    cta: "Check VIN →",
    ctaNote: "On Bumper's website",
    bullets: [
      "Clean report layout that is easy to navigate for first-time buyers",
      "Aggregates multiple public record datasets into one report",
      "Subscription model allows multiple vehicle lookups",
    ],
  },
  {
    id: "clearvin",
    rank: 4,
    name: "ClearVIN",
    tagline: "Best for Title & Lien Verification",
    badge: "2026 Editors' Choice · Best for Title & Lien Checks",
    stars: 4,
    rating: "4.3",
    href: "https://www.clearvin.com",
    cta: "Check VIN →",
    ctaNote: "On ClearVIN's website",
    bullets: [
      "Strong title record verification and lien information",
      "Straightforward vehicle ownership and registration history",
      "Simple one-report purchase model",
    ],
  },
  {
    id: "carvertical",
    rank: 5,
    name: "CarVertical",
    tagline: "Best for International Vehicle History",
    badge: "2026 Editors' Choice · Best Global VIN Database",
    stars: 4,
    rating: "4.2",
    href: "https://www.carvertical.com",
    cta: "Check VIN →",
    ctaNote: "On CarVertical's website",
    bullets: [
      "International vehicle history data from multiple countries",
      "Blockchain-verified data structure designed for transparency",
      "Useful for imported or cross-border vehicles",
    ],
  },
  {
    id: "goodcar",
    rank: 6,
    name: "GoodCar",
    tagline: "Best for Quick VIN Lookups",
    badge: "2026 Editors' Choice · Best for Fast VIN Checks",
    stars: 4,
    rating: "4.1",
    href: "https://www.goodcar.com",
    cta: "Check VIN →",
    ctaNote: "On GoodCar's website",
    bullets: [
      "Fast VIN lookups using aggregated public datasets",
      "Simple report layout focused on core vehicle history signals",
      "Useful for initial screening before deeper report analysis",
    ],
  },
  {
    id: "vinseeker",
    rank: 7,
    name: "VinSeeker",
    tagline: "Best Lightweight VIN Search Tool",
    badge: "2026 Editors' Choice · Best Lightweight VIN Lookup",
    stars: 4,
    rating: "4.0",
    href: "https://www.vinseeker.com",
    cta: "Check VIN →",
    ctaNote: "On VinSeeker's website",
    bullets: [
      "Simple VIN search experience for quick vehicle background checks",
      "Basic accident, title, and ownership history indicators",
      "Easy starting point when researching used vehicles",
    ],
  },
];

const COMPARE_COLS = [
  {
    id: "offo",
    name: "OFFO",
    href: "/receipt",
    cta: "Try Free →",
    bestFor: "EV risk analysis",
    rating: "★★★★★ 4.9/5",
    pricing: "Free",
    risk: "Very clear",
    accident: "Strong + EV-specific",
    auction: "Included",
    market: "Full context",
    clarity: "Very clear",
    isOffo: true,
  },
  {
    id: "autocheck",
    name: "AutoCheck",
    href: "https://www.autocheck.com",
    cta: "Check VIN →",
    bestFor: "Auction data",
    rating: "★★★★☆ 4.5/5",
    pricing: "$59.99 / 5 reports",
    risk: "Clear",
    accident: "Strong",
    auction: "Very strong",
    market: "No",
    clarity: "Moderate",
  },
  {
    id: "bumper",
    name: "Bumper",
    href: "https://www.bumper.com",
    cta: "Check VIN →",
    bestFor: "Report readability",
    rating: "★★★★☆ 4.4/5",
    pricing: "$27.99/mo",
    risk: "Clear",
    accident: "Strong",
    auction: "Moderate",
    market: "Included",
    clarity: "Good",
  },
  {
    id: "clearvin",
    name: "ClearVIN",
    href: "https://www.clearvin.com",
    cta: "Check VIN →",
    bestFor: "Title history",
    rating: "★★★★☆ 4.3/5",
    pricing: "$28.99 / 5 reports",
    risk: "Moderate",
    accident: "Moderate",
    auction: "Moderate",
    market: "Limited",
    clarity: "Moderate",
  },
];

const DETAIL_SECTIONS = [
  {
    id: "offo",
    rank: 1,
    name: "OFFO",
    badge: "Editors' #1 Pick · Best for Used EV Buyers",
    tagline: "The only VIN report built specifically for used EV buyers",
    stars: 5,
    rating: "4.9",
    href: "/receipt",
    cta: "Try Free →",
    ctaNote: "On OFFO — No sign-up required",
    isOffo: true,
    promotionLabel: "FREE for all used EV shoppers — no credit card, no account required",
    liked: [
      {
        title: "EV-specific risk visibility",
        body: "OFFO goes beyond standard VIN history. Every report includes battery health estimates, DC fast charge support confirmation, open safety recall status, and an EV-fit score based on your commute. These are the signals that actually matter for used EV buyers — signals that Carfax, AutoCheck, and every other VIN report service completely omit.",
      },
      {
        title: "AI verdict at the top",
        body: "Instead of leaving you to interpret a wall of chronological events, OFFO surfaces a clear GREEN / YELLOW / RED verdict backed by 50+ structured risk factors. Critical blockers — salvage title, major frame damage, missing DC fast charging — force RED immediately. The verdict appears in under 30 seconds.",
      },
      {
        title: "Price vs. market context",
        body: "OFFO includes market price analysis so you can see whether the asking price is fair for this specific battery chemistry, mileage, and condition. No other VIN report on this list does this for EVs.",
      },
      {
        title: "Free, no sign-up required",
        body: "Unlike every other service on this list, OFFO is free for used EV buyers. Paste any CarGurus, AutoTrader, Carvana, or Cars.com listing URL and get a full EV audit in under 30 seconds. No account, no credit card.",
      },
    ],
    disliked: [
      {
        title: "Focused on used EVs",
        body: "OFFO is built specifically for used EV analysis. For gas-powered vehicles, a traditional VIN report service is a better fit.",
      },
      {
        title: "Data depends on listing quality",
        body: "Like any AI-powered tool, the depth of analysis improves when the listing includes more detail. Thin listings produce thinner signals.",
      },
    ],
    comparisonRows: [
      { label: "EV-specific signals", offo: "Full (battery, DCFC, recalls, fit score)", carfax: "None" },
      { label: "Risk visibility", offo: "GREEN / YELLOW / RED verdict upfront", carfax: "Buried in timeline" },
      { label: "Market price context", offo: "Included", carfax: "Limited" },
      { label: "Pricing", offo: "Free", carfax: "$45 / report" },
      { label: "Report clarity", offo: "Structured sections + clear verdict", carfax: "Chronological log" },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "5.0" },
      { factor: "Value", weight: "11%", verdict: "5.0" },
      { factor: "Features", weight: "30.5%", verdict: "4.9" },
      { factor: "Test results", weight: "20%", verdict: "4.8" },
      { factor: "Data coverage", weight: "9.5%", verdict: "4.8" },
      { factor: "Report usability", weight: "3%", verdict: "5.0" },
      { factor: "Customer support", weight: "5%", verdict: "4.9" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Very clear" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "EV-specific signals", result: "Unique — no other service offers this" },
      { metric: "Auction / sales history", result: "Included" },
      { metric: "Market value context", result: "Included" },
      { metric: "Pricing flexibility", result: "Free" },
      { metric: "Report clarity", result: "Very clear" },
    ],
    editorialSummary:
      "OFFO receives the highest editorial rating in this comparison for one reason no other service can match: it is the only VIN report tool built specifically for used EV buyers. The EV-specific signal analysis, clear AI verdict, and free pricing make it the obvious first step before purchasing any paid VIN report.",
  },
  {
    id: "autocheck",
    rank: 2,
    name: "AutoCheck",
    badge: "2026 Editors' Choice · Best for Auction Data",
    tagline: "Strong Auction Network & Dealer Integration",
    stars: 4,
    rating: "4.5",
    href: "https://www.autocheck.com",
    cta: "Check VIN →",
    ctaNote: "On AutoCheck's website",
    liked: [
      {
        title: "Strong auction and dealer network coverage",
        body: "AutoCheck is widely used across dealer and auction networks in the United States. This often means that vehicles which have passed through large auctions or dealership inventory systems may have more detailed auction-related records available.",
      },
      {
        title: "AutoCheck Score for quick comparisons",
        body: "The AutoCheck Score provides a numerical benchmark designed to help buyers compare vehicles within the same class. While it should not replace deeper inspection of the report itself, it can offer a quick reference point when comparing multiple listings.",
      },
      {
        title: "Clear ownership timeline",
        body: "AutoCheck reports present ownership history and title events in a structured timeline format, making it easier to see how long each owner held the vehicle and when major events occurred.",
      },
    ],
    disliked: [
      {
        title: "Risk signals are less visually emphasized",
        body: "Some potential issues are embedded within the event timeline rather than highlighted as clear alerts at the beginning of the report.",
      },
      {
        title: "Limited market listing context",
        body: "Unlike some VIN report providers that include historical listing or pricing data, AutoCheck primarily focuses on title events, accidents, and auction records.",
      },
      {
        title: "No EV-specific analysis",
        body: "Like all traditional VIN services, AutoCheck provides zero EV-specific signals — no battery data, no charging capability, no EV price context.",
      },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "4.5" },
      { factor: "Value", weight: "11%", verdict: "4.2" },
      { factor: "Features", weight: "30.5%", verdict: "4.4" },
      { factor: "Test results", weight: "20%", verdict: "4.6" },
      { factor: "Data coverage", weight: "9.5%", verdict: "4.7" },
      { factor: "Report usability", weight: "3%", verdict: "4.6" },
      { factor: "Customer support", weight: "5%", verdict: "4.7" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Moderate" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "Auction history", result: "Very strong" },
      { metric: "Pricing flexibility", result: "Limited" },
      { metric: "Report clarity", result: "Clear" },
    ],
    editorialSummary:
      "AutoCheck performed strongly in auction data coverage and dealer network integration. However, key risk indicators are sometimes less prominently highlighted, and there is no EV-specific analysis.",
  },
  {
    id: "bumper",
    rank: 3,
    name: "Bumper",
    badge: "2026 Editors' Choice · Best Report Layout",
    tagline: "Clear Report Structure for First-Time Buyers",
    stars: 4,
    rating: "4.4",
    href: "https://www.bumper.com",
    cta: "Check VIN →",
    ctaNote: "On Bumper's website",
    liked: [
      {
        title: "Easy-to-read report structure",
        body: "One of the strongest aspects of Bumper reports is their readability. Information is presented in clearly separated sections, making it relatively easy for first-time buyers to navigate through accident records, title information, and ownership history.",
      },
      {
        title: "Aggregated public record datasets",
        body: "Bumper pulls together multiple public record sources into one report, including accident indicators, ownership history, title information, and other publicly available vehicle records.",
      },
      {
        title: "Subscription model for multiple searches",
        body: "Bumper offers a subscription model that allows users to run multiple vehicle searches within a single period — useful during the early stages of used-car shopping.",
      },
    ],
    disliked: [
      {
        title: "Limited market history context",
        body: "Bumper reports typically include less context about a vehicle's market activity, such as auction appearances or historical listing data.",
      },
      {
        title: "No EV-specific signals",
        body: "Like all traditional VIN services, Bumper provides no EV-specific analysis — no battery health, no charging capability, no EV pricing context.",
      },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "4.4" },
      { factor: "Value", weight: "11%", verdict: "4.5" },
      { factor: "Features", weight: "30.5%", verdict: "4.3" },
      { factor: "Test results", weight: "20%", verdict: "4.4" },
      { factor: "Data coverage", weight: "9.5%", verdict: "4.3" },
      { factor: "Report usability", weight: "3%", verdict: "4.7" },
      { factor: "Customer support", weight: "5%", verdict: "4.4" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Clear" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "Auction history", result: "Limited" },
      { metric: "Pricing flexibility", result: "Flexible" },
      { metric: "Report clarity", result: "Very clear" },
    ],
    editorialSummary:
      "Bumper performs strongly in report readability and structured presentation. However, reports may provide less historical context about auction activity, and there is no EV-specific analysis.",
  },
  {
    id: "clearvin",
    rank: 4,
    name: "ClearVIN",
    badge: "2026 Editors' Choice · Best for Title & Lien Checks",
    tagline: "Focused Title & Lien Record Verification",
    stars: 4,
    rating: "4.3",
    href: "https://www.clearvin.com",
    cta: "Check VIN →",
    ctaNote: "On ClearVIN's website",
    liked: [
      {
        title: "Strong title record verification",
        body: "ClearVIN focuses heavily on vehicle title history, including title brands, registration events, and lien records. Particularly useful for verifying whether a vehicle has been marked as salvage, rebuilt, or flood-damaged.",
      },
      {
        title: "Straightforward report structure",
        body: "ClearVIN reports are relatively easy to follow, organized into sections covering title history, accident indicators, ownership records, and vehicle specifications.",
      },
      {
        title: "Useful ownership and registration records",
        body: "Ownership changes and registration events are clearly listed in the report timeline, helpful for understanding how often a vehicle has changed owners or moved between states.",
      },
    ],
    disliked: [
      {
        title: "Less market activity context",
        body: "ClearVIN reports provide strong title and registration data but typically include less context about auction records, listing history, or vehicle pricing.",
      },
      {
        title: "Per-report pricing model",
        body: "ClearVIN typically sells reports individually, which can get expensive when researching multiple vehicles.",
      },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "4.3" },
      { factor: "Value", weight: "11%", verdict: "4.2" },
      { factor: "Features", weight: "30.5%", verdict: "4.2" },
      { factor: "Test results", weight: "20%", verdict: "4.3" },
      { factor: "Data coverage", weight: "9.5%", verdict: "4.4" },
      { factor: "Report usability", weight: "3%", verdict: "4.3" },
      { factor: "Customer support", weight: "5%", verdict: "4.2" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Clear" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "Auction history", result: "Limited" },
      { metric: "Pricing flexibility", result: "Limited" },
      { metric: "Report clarity", result: "Clear" },
    ],
    editorialSummary:
      "ClearVIN performs particularly well in title record verification and ownership history tracking. However, reports provide less context about broader market activity and there is no EV-specific analysis.",
  },
  {
    id: "carvertical",
    rank: 5,
    name: "CarVertical",
    badge: "2026 Editors' Choice · Best Global VIN Database",
    tagline: "International Vehicle Data from 40+ Countries",
    stars: 4,
    rating: "4.2",
    href: "https://www.carvertical.com",
    cta: "Check VIN →",
    ctaNote: "On CarVertical's website",
    liked: [
      {
        title: "International vehicle history coverage",
        body: "CarVertical focuses heavily on collecting vehicle history data from multiple international databases — particularly useful when researching imported vehicles or those previously registered in other countries.",
      },
      {
        title: "Clear risk indicators",
        body: "CarVertical reports highlight accident records, title brands, mileage inconsistencies, and theft records in a structured format that allows buyers to quickly identify potential concerns.",
      },
    ],
    disliked: [
      {
        title: "U.S.-specific data coverage may vary",
        body: "Coverage for vehicles that have only been registered within the United States may sometimes be more limited compared with services that focus primarily on U.S. data sources.",
      },
      {
        title: "Per-report pricing",
        body: "CarVertical typically sells reports individually, which adds up when comparing several vehicles.",
      },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "4.2" },
      { factor: "Value", weight: "11%", verdict: "4.1" },
      { factor: "Features", weight: "30.5%", verdict: "4.1" },
      { factor: "Test results", weight: "20%", verdict: "4.2" },
      { factor: "Data coverage", weight: "9.5%", verdict: "4.3" },
      { factor: "Report usability", weight: "3%", verdict: "4.2" },
      { factor: "Customer support", weight: "5%", verdict: "4.1" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Clear" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "International records", result: "Very strong" },
      { metric: "Pricing flexibility", result: "Limited" },
      { metric: "Report clarity", result: "Clear" },
    ],
    editorialSummary:
      "CarVertical is the strongest option for cross-border vehicle history. For U.S.-only vehicles, coverage may be more limited than domestic-focused services.",
  },
  {
    id: "goodcar",
    rank: 6,
    name: "GoodCar",
    badge: "2026 Editors' Choice · Best for Fast VIN Checks",
    tagline: "Fast Vehicle Background Checks",
    stars: 4,
    rating: "4.1",
    href: "https://www.goodcar.com",
    cta: "Check VIN →",
    ctaNote: "On GoodCar's website",
    liked: [
      {
        title: "Fast VIN lookup process",
        body: "GoodCar reports are designed to provide a quick overview of a vehicle's background, aggregating multiple public vehicle records in a relatively simple format.",
      },
      {
        title: "Simple and accessible report layout",
        body: "The report structure focuses on basic vehicle history indicators — accidents, ownership changes, title information — without overly technical data presentation.",
      },
    ],
    disliked: [
      {
        title: "Limited historical context",
        body: "GoodCar reports typically include less detailed market context such as auction appearances or historical listing data.",
      },
      {
        title: "Risk indicators may require interpretation",
        body: "Some potential vehicle issues appear within report sections rather than being highlighted as strong visual alerts at the top of the report.",
      },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "4.1" },
      { factor: "Value", weight: "11%", verdict: "4.2" },
      { factor: "Features", weight: "30.5%", verdict: "4.0" },
      { factor: "Test results", weight: "20%", verdict: "4.1" },
      { factor: "Data coverage", weight: "9.5%", verdict: "4.0" },
      { factor: "Report usability", weight: "3%", verdict: "4.3" },
      { factor: "Customer support", weight: "5%", verdict: "4.0" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Moderate" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "Auction history", result: "Limited" },
      { metric: "Pricing flexibility", result: "Flexible" },
      { metric: "Report clarity", result: "Clear" },
    ],
    editorialSummary:
      "GoodCar is a solid option for quick initial screenings, but buyers researching used EVs will find the lack of EV-specific signals a significant gap.",
  },
  {
    id: "vinseeker",
    rank: 7,
    name: "VinSeeker",
    badge: "2026 Editors' Choice · Best Lightweight VIN Lookup",
    tagline: "Quick VIN & License Plate Lookup",
    stars: 4,
    rating: "4.0",
    href: "https://www.vinseeker.com",
    cta: "Check VIN →",
    ctaNote: "On VinSeeker's website",
    liked: [
      {
        title: "VIN and license plate lookup",
        body: "One of the more distinctive features of VinSeeker is the ability to search vehicle records not only by VIN but also by license plate and state — helpful when a VIN number is not immediately available.",
      },
      {
        title: "Fast report generation",
        body: "VinSeeker reports are typically generated quickly after entering a VIN or license plate number, delivering a rapid overview of a vehicle's background.",
      },
    ],
    disliked: [
      {
        title: "Limited market activity context",
        body: "Compared with services that include auction appearances or historical listing data, VinSeeker reports focus more on basic vehicle history indicators.",
      },
      {
        title: "Pricing structure may require attention",
        body: "Some users may encounter subscription-style pricing models after an initial report purchase. Review pricing details carefully before purchasing.",
      },
    ],
    scoreBreakdown: [
      { factor: "Our experience", weight: "15%", verdict: "4.0" },
      { factor: "Value", weight: "11%", verdict: "3.9" },
      { factor: "Features", weight: "30.5%", verdict: "3.9" },
      { factor: "Test results", weight: "20%", verdict: "4.0" },
      { factor: "Data coverage", weight: "9.5%", verdict: "3.9" },
      { factor: "Report usability", weight: "3%", verdict: "4.2" },
      { factor: "Customer support", weight: "5%", verdict: "3.9" },
    ],
    reportEval: [
      { metric: "Risk alert visibility", result: "Moderate" },
      { metric: "Accident & damage data", result: "Strong" },
      { metric: "License plate lookup", result: "Very strong" },
      { metric: "Pricing flexibility", result: "Limited" },
      { metric: "Report clarity", result: "Clear" },
    ],
    editorialSummary:
      "VinSeeker is a useful lightweight option, especially for license plate lookups. For used EV buyers needing deeper analysis, OFFO remains the better starting point.",
  },
];

const COVERAGE_TABLE = [
  { label: "Accident records", offo: "Strong + EV context", autocheck: "Strong", bumper: "Strong", clearvin: "Moderate", goodcar: "Moderate", vinseeker: "Moderate" },
  { label: "Title / salvage brands", offo: "Strong", autocheck: "Strong", bumper: "Strong", clearvin: "Strong", goodcar: "Moderate", vinseeker: "Moderate" },
  { label: "Mileage timeline", offo: "Very clear", autocheck: "Clear", bumper: "Clear", clearvin: "Moderate", goodcar: "Moderate", vinseeker: "Moderate" },
  { label: "EV battery signals", offo: "Unique — only OFFO", autocheck: "None", bumper: "None", clearvin: "None", goodcar: "None", vinseeker: "None" },
  { label: "Auction / sales history", offo: "Included", autocheck: "Very strong", bumper: "Moderate", clearvin: "Moderate", goodcar: "Limited", vinseeker: "Moderate" },
  { label: "Market value context", offo: "Included", autocheck: "Not included", bumper: "Included", clearvin: "Limited", goodcar: "Limited", vinseeker: "Limited" },
];

const FEATURE_TABLE = [
  { feature: "Accident history", offo: true, autocheck: true, bumper: true, clearvin: true, carvertical: true, goodcar: true, vinseeker: true },
  { feature: "Title / salvage records", offo: true, autocheck: true, bumper: true, clearvin: true, carvertical: true, goodcar: true, vinseeker: true },
  { feature: "Mileage anomaly detection", offo: true, autocheck: true, bumper: true, clearvin: true, carvertical: true, goodcar: true, vinseeker: true },
  { feature: "Auction records", offo: true, autocheck: true, bumper: true, clearvin: true, carvertical: "Limited", goodcar: "Limited", vinseeker: "Limited" },
  { feature: "EV battery health estimate", offo: true, autocheck: false, bumper: false, clearvin: false, carvertical: false, goodcar: false, vinseeker: false },
  { feature: "DC fast charge confirmation", offo: true, autocheck: false, bumper: false, clearvin: false, carvertical: false, goodcar: false, vinseeker: false },
  { feature: "AI risk verdict", offo: true, autocheck: false, bumper: false, clearvin: false, carvertical: false, goodcar: false, vinseeker: false },
  { feature: "Historical listings", offo: true, autocheck: false, bumper: true, clearvin: false, carvertical: "Limited", goodcar: false, vinseeker: false },
  { feature: "Market value estimates", offo: true, autocheck: false, bumper: true, clearvin: true, carvertical: "Limited", goodcar: false, vinseeker: false },
  { feature: "Free access", offo: true, autocheck: false, bumper: false, clearvin: false, carvertical: false, goodcar: false, vinseeker: false },
  { feature: "Multi-VIN pricing plans", offo: true, autocheck: false, bumper: true, clearvin: false, carvertical: false, goodcar: true, vinseeker: false },
  { feature: "License plate lookup", offo: false, autocheck: false, bumper: false, clearvin: false, carvertical: false, goodcar: false, vinseeker: true },
];

const FAQS = [
  {
    q: "What is the best Carfax alternative for used EV buyers?",
    a: "OFFO is the best Carfax alternative for used EV buyers because it is the only VIN report tool that provides EV-specific signals: battery health estimates, DC fast charge confirmation, open recall status, and a price-vs-market analysis calibrated for used EVs. It is also free with no sign-up required. For general VIN history (title records, accident data), AutoCheck and Bumper are strong paid alternatives.",
  },
  {
    q: "Is AutoCheck better than Carfax?",
    a: "AutoCheck has stronger auction and dealer network integration than Carfax, which can surface more detailed history for vehicles that have passed through dealer networks. However, neither service provides EV-specific analysis, and both use chronological event logs that can make it harder to quickly identify risk signals compared to tools like OFFO.",
  },
  {
    q: "Are VIN reports always accurate?",
    a: "VIN reports depend on whether incidents were officially reported to the relevant databases. Accidents that were not reported to insurance, private-party repairs, and some damage events may not appear in any VIN report. This is one reason OFFO layers AI analysis on top of VIN data — to identify signals that structured databases may miss.",
  },
  {
    q: "Should I run more than one VIN report?",
    a: "For a serious purchase, running OFFO (free, EV-specific) alongside one traditional VIN report (Carfax or AutoCheck) gives you the most complete picture. OFFO covers EV-specific risk factors that traditional reports miss entirely; traditional reports cover title and accident history from established data networks.",
  },
  {
    q: "How many VIN reports should I check before buying a used EV?",
    a: "We recommend running OFFO first on every listing you are seriously considering — it is free and surfaces the EV-specific signals that matter most. For the 2-3 listings you narrow down to, pairing OFFO with a single traditional VIN report gives comprehensive coverage.",
  },
  {
    q: "What information does a VIN report include?",
    a: "Traditional VIN reports include title history, reported accidents, ownership records, mileage readings, salvage or flood branding, and open recall data. OFFO includes all of this plus EV-specific signals: battery health estimates, DC fast charge capability, EV-specific recall status, price vs. market analysis, and an AI-generated risk verdict.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <span className="text-amber-400 text-lg tracking-tight">
      {"★".repeat(count)}{"☆".repeat(total - count)}
    </span>
  );
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-[#00d97e] font-bold">✓</span>;
  if (value === false) return <span className="text-white/20">✗</span>;
  return <span className="text-amber-400/80 text-xs">{value}</span>;
}

function ResultBadge({ result }: { result: string }) {
  const isStrong = result.toLowerCase().includes("strong") || result.toLowerCase().includes("very clear") || result.toLowerCase().includes("very strong") || result.toLowerCase().includes("unique") || result.toLowerCase().includes("included") || result.toLowerCase().includes("full") || result.toLowerCase().includes("free");
  const isWeak = result.toLowerCase().includes("none") || result.toLowerCase().includes("not included") || result.toLowerCase().includes("limited");
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isStrong ? "bg-[#00d97e]/10 text-[#00d97e]" : isWeak ? "bg-red-500/10 text-red-400" : "bg-white/[0.06] text-white/60"}`}>
      {result}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BestCarfaxAlternatives2026() {
  const toc = [
    { label: "Best Carfax alternatives of 2026", href: "#picks" },
    { label: "Compare the best alternatives", href: "#compare" },
    { label: "OFFO: Best for used EV buyers", href: "#offo" },
    { label: "AutoCheck: Best for auction data", href: "#autocheck" },
    { label: "Bumper: Best for report readability", href: "#bumper" },
    { label: "ClearVIN: Best for title & lien checks", href: "#clearvin" },
    { label: "CarVertical: Best global VIN database", href: "#carvertical" },
    { label: "GoodCar: Best for quick lookups", href: "#goodcar" },
    { label: "VinSeeker: Best lightweight lookup", href: "#vinseeker" },
    { label: "VIN report coverage comparison", href: "#coverage" },
    { label: "Bottom line", href: "#bottom-line" },
    { label: "How we test and rate", href: "#methodology" },
    { label: "FAQs", href: "#faqs" },
  ];

  return (
    <div>

      {/* ── Article Header ── */}
      <header className="border-b border-white/[0.08]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <nav className="text-xs text-white/30 mb-5 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-white/60 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-white/60 transition-colors">Vehicle research</Link>
            <span>/</span>
            <span className="text-white/50">Carfax alternatives</span>
          </nav>

          {/* Editors pick badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/20 text-xs font-bold px-3 py-1 rounded-full">
              Editors&apos; #1 Pick
            </span>
            <span className="text-white/40 text-xs">OFFO</span>
            <span className="text-amber-400 text-sm">★ 4.9 / 5</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            Best Carfax Alternatives of 2026
          </h1>
          <p className="text-white/50 text-lg mb-4 leading-relaxed">
            We tested 7 VIN report services head-to-head. Here are the ones that actually surface the risks Carfax can miss — especially for used EV buyers.
          </p>
          <div className="flex items-center gap-3 text-sm text-white/40">
            <span>OFFO Editorial Team</span>
            <span>·</span>
            <span>Last updated Apr 2026</span>
            <span>·</span>
            <span>12 min read</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex gap-10 items-start">

          {/* ── Sidebar TOC (sticky, desktop) ── */}
          <aside className="hidden lg:block w-56 shrink-0 sticky top-8 self-start">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">In this article</p>
            <nav className="space-y-1">
              {toc.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block text-xs text-white/40 hover:text-white/70 py-1 transition-colors leading-snug"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* ── Main Content ── */}
          <main className="min-w-0 flex-1">

            {/* ── Quick picks list ── */}
            <section id="picks" className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Best Carfax alternatives of 2026</h2>

              <div className="space-y-4">
                {PICKS.map((pick) => (
                  <div
                    key={pick.id}
                    className={`rounded-2xl border p-5 ${pick.isOffo ? "border-[#00d97e]/30 bg-[#00d97e]/[0.04]" : "border-white/[0.08] bg-[#161b22]"}`}
                  >
                    {/* Badge row */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${pick.isOffo ? "bg-[#00d97e]/15 text-[#00d97e] border-[#00d97e]/20" : "bg-white/[0.06] text-white/50 border-white/[0.08]"}`}>
                        ● {pick.badge}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        {/* Name + stars */}
                        <div className="flex items-center gap-3 mb-1">
                          <p className={`text-base font-bold ${pick.isOffo ? "text-[#00d97e]" : "text-white"}`}>{pick.name}</p>
                          <Stars count={pick.stars} />
                          <span className="text-white/40 text-sm">{pick.rating} / 5</span>
                        </div>
                        <p className="text-xs text-white/40 mb-3">{pick.tagline}</p>

                        {/* Bullets */}
                        <ul className="space-y-1.5">
                          {pick.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-sm text-white/60">
                              <span className={`mt-0.5 shrink-0 ${pick.isOffo ? "text-[#00d97e]" : "text-white/30"}`}>●</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTA */}
                      <div className="shrink-0 text-center">
                        <Link
                          href={pick.href}
                          className={`inline-block font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors mb-1.5 ${pick.isOffo ? "bg-[#00d97e] hover:bg-[#00c970] text-black" : "bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.10]"}`}
                          {...(!pick.isOffo ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
                        >
                          {pick.cta}
                        </Link>
                        <p className="text-[10px] text-white/25 whitespace-nowrap">{pick.ctaNote}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Compare table ── */}
            <section id="compare" className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Compare the best Carfax alternatives of 2026</h2>

              <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-[#161b22]">
                      <th className="text-left py-3 px-4 text-white/30 font-medium text-xs w-36">Metric</th>
                      {COMPARE_COLS.map((c) => (
                        <th key={c.id} className={`text-left py-3 px-4 text-xs font-bold ${c.isOffo ? "text-[#00d97e]" : "text-white/60"}`}>
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* CTA row */}
                    <tr className="border-b border-white/[0.06] bg-[#0d1117]/60">
                      <td className="py-3 px-4 text-white/30 text-xs"></td>
                      {COMPARE_COLS.map((c) => (
                        <td key={c.id} className="py-3 px-4">
                          <Link
                            href={c.href}
                            className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${c.isOffo ? "bg-[#00d97e] hover:bg-[#00c970] text-black" : "bg-white/[0.08] hover:bg-white/[0.12] text-white"}`}
                            {...(!c.isOffo ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
                          >
                            {c.cta}
                          </Link>
                        </td>
                      ))}
                    </tr>
                    {[
                      { label: "Best for", key: "bestFor" as const },
                      { label: "Editorial rating", key: "rating" as const },
                      { label: "Pricing", key: "pricing" as const },
                      { label: "Risk alerts visibility", key: "risk" as const },
                      { label: "Accident & damage data", key: "accident" as const },
                      { label: "Auction / sales history", key: "auction" as const },
                      { label: "Market value context", key: "market" as const },
                      { label: "Report clarity", key: "clarity" as const },
                    ].map((row, i) => (
                      <tr key={row.key} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-[#161b22]/40" : ""}`}>
                        <td className="py-3 px-4 text-white/40 text-xs font-medium">{row.label}</td>
                        {COMPARE_COLS.map((c) => (
                          <td key={c.id} className={`py-3 px-4 text-xs ${c.isOffo ? "text-[#00d97e] font-medium" : "text-white/60"}`}>
                            {c[row.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── What is Carfax ── */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-4">What is Carfax and why look for alternatives?</h2>
              <div className="space-y-4 text-white/60 leading-relaxed text-sm">
                <p>
                  Carfax is the most recognized vehicle history service in the U.S., covering accident records, title info, ownership history, mileage, and recall data. Many used-car listings feature a &ldquo;Carfax report available&rdquo; badge, and buyers often treat that as a baseline level of transparency.
                </p>
                <p>
                  <strong className="text-white/80">The problem:</strong> Carfax reports can technically contain important information — like accident indicators or title issues — without making the significance obvious at first glance. Critical events sometimes appear as small entries buried in long chronological logs.
                </p>
                <p>
                  <strong className="text-white/80">The EV problem:</strong> Carfax and every other traditional VIN service were built for gas cars. They have no battery data, no DC fast charge verification, no EV-specific pricing context. For used EV buyers, these are the signals that actually determine whether a vehicle is a good deal — and none of them appear in a Carfax report.
                </p>
                <p>
                  <strong className="text-white/80">The cost issue:</strong> Carfax reports are sold per vehicle, which gets expensive fast when you&apos;re comparing multiple listings. Alternatives like OFFO are free, and others like Bumper offer multi-report subscriptions that are more practical for active car shoppers.
                </p>
              </div>
            </section>

            {/* ── Detail sections ── */}
            {DETAIL_SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="mb-14 scroll-mt-8">
                <div className={`rounded-2xl border p-6 mb-6 ${s.isOffo ? "border-[#00d97e]/30 bg-[#00d97e]/[0.04]" : "border-white/[0.08] bg-[#161b22]"}`}>
                  {/* Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${s.isOffo ? "bg-[#00d97e]/15 text-[#00d97e] border-[#00d97e]/20" : "bg-white/[0.06] text-white/50 border-white/[0.08]"}`}>
                      ● {s.badge}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className={`text-2xl font-bold mb-1 ${s.isOffo ? "text-[#00d97e]" : "text-white"}`}>
                        {s.rank}. {s.name}: {s.tagline}
                      </h2>
                      <div className="flex items-center gap-3 mb-2">
                        <Stars count={s.stars} />
                        <span className="text-white/50 text-sm">{s.rating} / 5 Editorial Rating</span>
                      </div>
                      {s.promotionLabel && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-lg px-3 py-1.5">
                          <span className="text-[#00d97e] text-xs font-semibold">● PROMOTION:</span>
                          <span className="text-[#00d97e]/80 text-xs">{s.promotionLabel}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-center">
                      <Link
                        href={s.href}
                        className={`inline-block font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors mb-1.5 ${s.isOffo ? "bg-[#00d97e] hover:bg-[#00c970] text-black" : "bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.10]"}`}
                        {...(!s.isOffo ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
                      >
                        {s.cta}
                      </Link>
                      <p className="text-[10px] text-white/25">{s.ctaNote}</p>
                    </div>
                  </div>
                </div>

                {/* OFFO vs Carfax comparison table */}
                {s.comparisonRows && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">📊 OFFO vs. Carfax — Key differences we found</p>
                    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.08] bg-[#161b22]">
                            <th className="text-left py-2.5 px-4 text-white/30 font-medium text-xs">Metric</th>
                            <th className="text-left py-2.5 px-4 text-[#00d97e] font-semibold text-xs">OFFO</th>
                            <th className="text-left py-2.5 px-4 text-white/40 font-medium text-xs">Carfax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.comparisonRows.map((row, i) => (
                            <tr key={row.label} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-[#161b22]/40" : ""}`}>
                              <td className="py-2.5 px-4 text-white/50 text-xs font-medium">{row.label}</td>
                              <td className="py-2.5 px-4 text-[#00d97e] text-xs">{row.offo}</td>
                              <td className="py-2.5 px-4 text-white/40 text-xs">{row.carfax}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* What I liked */}
                <div className="mb-6">
                  <h3 className="text-base font-bold text-white mb-3">What I liked</h3>
                  <div className="space-y-4">
                    {s.liked.map((item) => (
                      <div key={item.title}>
                        <p className="text-sm font-semibold text-white/90 mb-1">{item.title}</p>
                        <p className="text-sm text-white/50 leading-relaxed">{item.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What I didn't like */}
                <div className="mb-6">
                  <h3 className="text-base font-bold text-white mb-3">What I didn&apos;t like</h3>
                  <div className="space-y-4">
                    {s.disliked.map((item) => (
                      <div key={item.title}>
                        <p className="text-sm font-semibold text-white/90 mb-1">{item.title}</p>
                        <p className="text-sm text-white/50 leading-relaxed">{item.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Report evaluation */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Report evaluation</p>
                  <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-[#161b22]">
                          <th className="text-left py-2.5 px-4 text-white/30 font-medium text-xs">Metric</th>
                          <th className="text-left py-2.5 px-4 text-white/30 font-medium text-xs">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.reportEval.map((row, i) => (
                          <tr key={row.metric} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-[#161b22]/40" : ""}`}>
                            <td className="py-2.5 px-4 text-white/60 text-xs">{row.metric}</td>
                            <td className="py-2.5 px-4"><ResultBadge result={row.result} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Editorial summary */}
                <div className={`rounded-xl border p-4 mb-5 ${s.isOffo ? "border-[#00d97e]/20 bg-[#00d97e]/[0.04]" : "border-white/[0.08] bg-[#161b22]"}`}>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1.5">Editorial rating summary</p>
                  <p className="text-sm text-white/60 leading-relaxed">{s.editorialSummary}</p>
                </div>

                {/* Score breakdown */}
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-white/30 uppercase tracking-widest hover:text-white/50 transition-colors select-none mb-2">
                    Score breakdown ↓
                  </summary>
                  <div className="overflow-x-auto rounded-xl border border-white/[0.08] mt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-[#161b22]">
                          <th className="text-left py-2.5 px-4 text-white/30 font-medium text-xs">Decision factor</th>
                          <th className="text-left py-2.5 px-4 text-white/30 font-medium text-xs">Weight</th>
                          <th className="text-left py-2.5 px-4 text-white/30 font-medium text-xs">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.scoreBreakdown.map((row, i) => (
                          <tr key={row.factor} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-[#161b22]/40" : ""}`}>
                            <td className="py-2.5 px-4 text-white/60 text-xs">{row.factor}</td>
                            <td className="py-2.5 px-4 text-white/30 text-xs">{row.weight}</td>
                            <td className="py-2.5 px-4 text-white/70 text-xs font-semibold">{row.verdict}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <a href="#picks" className="inline-block mt-5 text-xs text-white/25 hover:text-white/50 transition-colors">↑ Back to top</a>
              </section>
            ))}

            {/* ── Coverage comparison ── */}
            <section id="coverage" className="mb-12 scroll-mt-8">
              <h2 className="text-2xl font-bold text-white mb-2">VIN report coverage comparison</h2>
              <p className="text-sm text-white/50 mb-6 leading-relaxed">
                How vehicle history services differ across key data categories. OFFO is the only service with EV-specific signals.
              </p>

              <div className="overflow-x-auto rounded-2xl border border-white/[0.08] mb-8">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-[#161b22]">
                      <th className="text-left py-3 px-4 text-white/30 font-medium w-36">Data category</th>
                      <th className="text-left py-3 px-3 text-[#00d97e] font-bold">OFFO</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium">AutoCheck</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium">Bumper</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium">ClearVIN</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium">GoodCar</th>
                      <th className="text-left py-3 px-3 text-white/50 font-medium">VinSeeker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COVERAGE_TABLE.map((row, i) => (
                      <tr key={row.label} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-[#161b22]/40" : ""}`}>
                        <td className="py-3 px-4 text-white/50 font-medium">{row.label}</td>
                        <td className="py-3 px-3 text-[#00d97e] font-medium">{row.offo}</td>
                        <td className="py-3 px-3 text-white/40">{row.autocheck}</td>
                        <td className="py-3 px-3 text-white/40">{row.bumper}</td>
                        <td className="py-3 px-3 text-white/40">{row.clearvin}</td>
                        <td className="py-3 px-3 text-white/40">{row.goodcar}</td>
                        <td className="py-3 px-3 text-white/40">{row.vinseeker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feature table */}
              <p className="text-sm font-semibold text-white/40 mb-4">VIN report feature comparison</p>
              <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-[#161b22]">
                      <th className="text-left py-3 px-4 text-white/30 font-medium w-40">Feature</th>
                      <th className="text-center py-3 px-3 text-[#00d97e] font-bold">OFFO</th>
                      <th className="text-center py-3 px-3 text-white/50 font-medium">AutoCheck</th>
                      <th className="text-center py-3 px-3 text-white/50 font-medium">Bumper</th>
                      <th className="text-center py-3 px-3 text-white/50 font-medium">ClearVIN</th>
                      <th className="text-center py-3 px-3 text-white/50 font-medium">CarVertical</th>
                      <th className="text-center py-3 px-3 text-white/50 font-medium">GoodCar</th>
                      <th className="text-center py-3 px-3 text-white/50 font-medium">VinSeeker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_TABLE.map((row, i) => (
                      <tr key={row.feature} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-[#161b22]/40" : ""}`}>
                        <td className="py-2.5 px-4 text-white/60">{row.feature}</td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.offo} /></td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.autocheck} /></td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.bumper} /></td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.clearvin} /></td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.carvertical} /></td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.goodcar} /></td>
                        <td className="py-2.5 px-3 text-center"><FeatureCell value={row.vinseeker} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Bottom line ── */}
            <section id="bottom-line" className="mb-12 scroll-mt-8">
              <h2 className="text-2xl font-bold text-white mb-4">Bottom line: The best Carfax alternatives tested by our editors</h2>
              <div className="space-y-4 text-sm text-white/60 leading-relaxed mb-8">
                <p>
                  <strong className="text-[#00d97e]">OFFO ranks as the best overall Carfax alternative for used EV buyers</strong> — and it is the only tool on this list that provides EV-specific analysis. Battery health estimates, DC fast charge verification, open recall status, AI risk verdict, and price-vs-market context are all included, all free, with no sign-up required. In our testing, the reports surfaced risk signals that traditional VIN services cannot even measure.
                </p>
                <p>
                  For general VIN history (title records, accident data, ownership timeline), <strong className="text-white/80">AutoCheck</strong> performs well for vehicles with significant auction or dealer history. <strong className="text-white/80">Bumper</strong> offers broad data categories and a modern report layout. <strong className="text-white/80">ClearVIN</strong> is the strongest option if title verification is your primary concern.
                </p>
                <p>
                  Our recommendation: run OFFO first on every EV listing you are seriously considering. It is free, takes under 30 seconds, and provides the EV-specific context that makes Carfax and its alternatives incomplete for used EV research.
                </p>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: "OFFO", pricing: "Free", bestFor: "Used EV analysis", strength: "EV signals + AI verdict + free", isOffo: true, href: "/receipt" },
                  { name: "AutoCheck", pricing: "$59.99 / 5 reports", bestFor: "Auction and dealer history", strength: "Strong dealer network and title data", href: "https://www.autocheck.com" },
                  { name: "Bumper", pricing: "$27.99/mo (50 reports)", bestFor: "Report readability", strength: "Broad data categories and modern interface", href: "https://www.bumper.com" },
                  { name: "ClearVIN", pricing: "$28.99 / 5 reports", bestFor: "Title history checks", strength: "Clear ownership and branding records", href: "https://www.clearvin.com" },
                  { name: "CarVertical", pricing: "$29.99 / report", bestFor: "International vehicle history", strength: "Cross-border vehicle data", href: "https://www.carvertical.com" },
                  { name: "GoodCar", pricing: "$2.95 trial", bestFor: "Quick VIN lookups", strength: "Simple interface for fast vehicle checks", href: "https://www.goodcar.com" },
                  { name: "VinSeeker", pricing: "$19.99 / report", bestFor: "VIN and license plate checks", strength: "Quick background checks and plate lookup", href: "https://www.vinseeker.com" },
                ].map((card) => (
                  <div key={card.name} className={`rounded-xl border p-4 ${card.isOffo ? "border-[#00d97e]/30 bg-[#00d97e]/[0.04]" : "border-white/[0.08] bg-[#161b22]"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`font-bold text-sm ${card.isOffo ? "text-[#00d97e]" : "text-white"}`}>{card.name}</p>
                      <Link
                        href={card.href}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg ${card.isOffo ? "bg-[#00d97e] text-black" : "bg-white/[0.08] text-white"}`}
                        {...(!card.isOffo ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
                      >
                        {card.isOffo ? "Try Free →" : "Check VIN →"}
                      </Link>
                    </div>
                    <p className="text-xs text-white/30 mb-1">Pricing: <span className="text-white/50">{card.pricing}</span></p>
                    <p className="text-xs text-white/30 mb-1">Best for: <span className="text-white/50">{card.bestFor}</span></p>
                    <p className="text-xs text-white/30">Key strength: <span className="text-white/50">{card.strength}</span></p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Methodology ── */}
            <section id="methodology" className="mb-12 scroll-mt-8">
              <h2 className="text-2xl font-bold text-white mb-4">How we test and rate VIN report services</h2>
              <div className="space-y-4 text-sm text-white/60 leading-relaxed">
                <p>
                  Our editorial team uses a standardized research process to evaluate vehicle history report services and compare how effectively each platform supports real used-car research — with a specific focus on used EV buyers, who have distinct information needs that traditional VIN reports do not address.
                </p>
                <p>
                  During testing, we analyze how clearly risk indicators are presented, how much historical context is included in each report, and how practical the pricing model is for buyers who need to check multiple vehicles. For OFFO, we specifically evaluated the EV-specific signals that no other service provides.
                </p>
                <p>
                  Our final editorial rating is calculated using weighted categories including risk visibility, accident and damage data, EV-specific signal coverage, sales and auction history, pricing flexibility, and overall report clarity.
                </p>
              </div>
            </section>

            {/* ── FAQs ── */}
            <section id="faqs" className="mb-12 scroll-mt-8">
              <h2 className="text-2xl font-bold text-white mb-6">FAQs</h2>
              <div className="space-y-2">
                {FAQS.map((faq) => (
                  <details key={faq.q} className="group border border-white/[0.08] rounded-xl overflow-hidden">
                    <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-white/80 hover:text-white flex items-center justify-between gap-3 select-none list-none transition-colors">
                      <span>{faq.q}</span>
                      <span className="shrink-0 text-white/30 group-open:rotate-180 transition-transform text-lg">↓</span>
                    </summary>
                    <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed border-t border-white/[0.06]">
                      <div className="pt-3">{faq.a}</div>
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* ── Closing CTA ── */}
            <div className="rounded-2xl border border-[#00d97e]/20 bg-[#00d97e]/[0.06] p-6 mb-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/20 text-[10px] font-bold px-2.5 py-1 rounded-full">● 2026 Editors&apos; #1 Pick · Best for Used EV Buyers</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xl font-bold text-[#00d97e]">OFFO</p>
                <Stars count={5} />
                <span className="text-white/40 text-sm">4.9 / 5</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-4">
                The only VIN report built for used EV buyers. EV-specific signals, AI risk verdict, and market price context — free, no sign-up required.
              </p>
              <ul className="space-y-1.5 mb-5">
                {[
                  "EV battery health estimate and DC fast charge confirmation",
                  "AI-powered GREEN / YELLOW / RED risk verdict in under 30 seconds",
                  "Price vs. market analysis calibrated for used EVs",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-[#00d97e] shrink-0 mt-0.5">●</span>{b}
                  </li>
                ))}
              </ul>
              <Link
                href="/receipt"
                className="inline-block bg-[#00d97e] hover:bg-[#00c970] text-black font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                Try OFFO Free →
              </Link>
              <p className="text-xs text-white/25 mt-2">On OFFO — No sign-up required</p>
            </div>

            {/* Footer nav */}
            <div className="border-t border-white/[0.08] pt-8 flex items-center justify-between">
              <Link href="/blog" className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors">
                ← All posts
              </Link>
              <Link href="/receipt" className="text-[#00d97e] hover:text-[#00c970] font-medium text-sm transition-colors">
                Try OFFO free →
              </Link>
            </div>

            <RelatedPosts posts={RELATED_POSTS} />
          </main>
        </div>
      </div>
    </div>
  );
}
