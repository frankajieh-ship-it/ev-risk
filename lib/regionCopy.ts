/**
 * Regional Copy Dictionary
 * Contains localized text for US and UK markets
 */

export type Region = "US" | "UK";

export interface RegionalCopy {
  labels: {
    zip: string;
    gas: string;
    highway: string;
    charger_type: string;
  };
  helper: {
    longTripHint: string;
    zipPlaceholder: string;
  };
  outputSnippets: {
    longTrip: string;
    closingLine: string;
  };
}

export const copyByRegion: Record<Region, RegionalCopy> = {
  US: {
    labels: {
      zip: "ZIP code",
      gas: "gas",
      highway: "highway",
      charger_type: "Level 2 charger",
    },
    helper: {
      longTripHint: "Think: occasional 200–400 mile road trips.",
      zipPlaceholder: "12345",
    },
    outputSnippets: {
      longTrip: "Long trips depend more on charging flow than battery size.",
      closingLine: "These frictions usually show up in the first 3–6 months — especially after a move, schedule change, or seasonal shift.",
    },
  },
  UK: {
    labels: {
      zip: "Postcode",
      gas: "petrol",
      highway: "motorway",
      charger_type: "home wallbox / 7kW charger",
    },
    helper: {
      longTripHint: "Think: occasional 150–250 mile motorway trips.",
      zipPlaceholder: "SW1A 1AA",
    },
    outputSnippets: {
      longTrip: "Long trips depend more on charging flow than battery size (motorway services vs rural gaps).",
      closingLine: "These frictions usually show up in the first 1–3 months — especially through winter, motorway service stops, or unplanned detours.",
    },
  },
};
