export const METHODOLOGY_VERSION = "1.0";
export const METHODOLOGY_UPDATED = "March 2026";

export type ChangelogEntry = { version: string; note: string };
export const METHODOLOGY_CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.0",
    note: "Initial methodology published. Covers listing analysis, auction bidding, and EV routine fit.",
  },
];

export type AccordionItem = { id: string; title: string; body: string; note?: string };
export const METHODOLOGY_ACCORDION: AccordionItem[] = [
  {
    id: "listing",
    title: "Analyze a Car",
    body: "We extract key details from the listing, compare price against similar vehicles in context, and check for EV-specific warning signs — missing battery proof, weak service history, unclear charging details, and ownership-risk patterns. We generate a verdict and seller questions based on what is missing or risky.",
    note: "We use signals, checks, and weighted inputs — not exact condition data.",
  },
  {
    id: "auction",
    title: "Auction Bidder",
    body: "We separate repair risk from deal quality, estimate repair range, resale range, and bid range, then compare a repair strategy against a parts-only strategy. Battery uncertainty and title complexity can materially change the recommendation — both are surfaced explicitly.",
  },
  {
    id: "routine",
    title: "EV Routine Check",
    body: "We estimate whether an EV fits a user's week-to-week charging and driving reality by weighing charging access, climate, daily use, longest-day stress, and budget. We compare fit across multiple vehicles. Missing information is treated as lower confidence, not hidden certainty.",
  },
];
