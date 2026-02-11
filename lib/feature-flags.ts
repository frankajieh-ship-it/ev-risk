/**
 * Feature Flags — Free vs Pro tier gating
 */

export interface FeatureFlags {
  compareMode: boolean;
  expandedNegotiationScripts: boolean;
  savedReceipts: boolean;
  detailsAccordionFull: boolean;
  redditDraftStyleToggle: boolean;
  dailyFreeLimit: number;
}

export function getFeatureFlags(isPro: boolean): FeatureFlags {
  return isPro
    ? {
        compareMode: true,
        expandedNegotiationScripts: true,
        savedReceipts: true,
        detailsAccordionFull: true,
        redditDraftStyleToggle: true,
        dailyFreeLimit: 999,
      }
    : {
        compareMode: false,
        expandedNegotiationScripts: false,
        savedReceipts: false,
        detailsAccordionFull: false,
        redditDraftStyleToggle: false,
        dailyFreeLimit: 1,
      };
}
