export type TutorialPlacement = "top" | "bottom" | "left" | "right";

export interface TutorialStep {
  id: string;
  page: string; // pathname to match, e.g. "/" or "/receipt"
  target: string; // data-tutorial attribute value
  placement: TutorialPlacement;
  title: string;
  body: string;
  cta?: string; // Next button label (default "Next →")
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "url-input",
    page: "/",
    target: "url-input",
    placement: "bottom",
    title: "Paste any EV listing URL",
    body: "Drop a link from CarGurus, AutoTrader, Cars.com, or Copart. OFFO instantly pulls the vehicle details.",
    cta: "Got it →",
  },
  {
    id: "analyze-btn",
    page: "/",
    target: "analyze-btn",
    placement: "bottom",
    title: "Run a risk check",
    body: "Hit Analyze and get a full risk report in under 30 seconds — battery health, pricing, ownership flags, and more.",
    cta: "Next →",
  },
  {
    id: "receipt-output",
    page: "/receipt",
    target: "receipt-output",
    placement: "top",
    title: "Your instant risk report",
    body: "This is your deal verdict. Green means proceed, red means watch out. Every flag is explained so you know exactly what to ask.",
    cta: "Next →",
  },
  {
    id: "save-garage",
    page: "/receipt",
    target: "save-garage",
    placement: "left",
    title: "Save it to your garage",
    body: "Bookmark any vehicle you're considering. Compare up to 4 side-by-side and track them over time.",
    cta: "Next →",
  },
  {
    id: "fit-verdict",
    page: "/report",
    target: "fit-verdict",
    placement: "top",
    title: "Does this EV fit your life?",
    body: "Based on your routine — commute, charging access, climate — OFFO scores how well this vehicle actually works for you.",
    cta: "Next →",
  },
  {
    id: "confidence-score",
    page: "/report",
    target: "confidence-score",
    placement: "right",
    title: "Data completeness at a glance",
    body: "Shows how complete the data is for this report. Higher = more confident verdict. Follow the actions to unlock a fuller picture.",
    cta: "Next →",
  },
  {
    id: "garage-section",
    page: "/workspace/garage",
    target: "garage-section",
    placement: "top",
    title: "All your saved vehicles",
    body: "Every car you've analyzed lives here. Compare, track, and share — your shortlist in one place.",
    cta: "Done ✓",
  },
];
