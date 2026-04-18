/**
 * Vehicle Category Template Packs
 *
 * Category-specific focus areas, inspection priorities, and question templates.
 * Used to inject relevant context into the OpenAI prompt.
 */

import type { VehicleCategory, VehicleClassification } from "./vehicle-classifier";

export interface CategoryTemplatePack {
  category: VehicleCategory;
  focusAreas: string[];
  inspectionPriorities: string[];
  redditQuestionTemplates: {
    uncertaintyQ: string;
    checkFirstQ: string;
  };
}

const EV_PACK: CategoryTemplatePack = {
  category: "EV",
  focusAreas: [
    "battery degradation and state of health (SoH)",
    "charging infrastructure fit (home L2 charging, nearby DCFC stations)",
    "cold weather range impact (can lose 20-40% in winter)",
    "highway vs city range realism",
    "DCFC charging speed and any degradation with age",
    "12V battery health (common failure point on older EVs)",
  ],
  inspectionPriorities: [
    "Check battery health report or SoH percentage if available",
    "Test drive starting near full charge, drive 20-30 miles, note range drop",
    "Verify onboard charger works on L2 (240V) and test DCFC if possible",
    "Check for battery recalls or known degradation issues for this model year",
    "Inspect 12V auxiliary battery age and condition",
  ],
  redditQuestionTemplates: {
    uncertaintyQ: "Is battery degradation a real concern at this age and mileage, or are most batteries holding up fine?",
    checkFirstQ: "What would you check first on the battery and drivetrain before buying?",
  },
};

const PHEV_PACK: CategoryTemplatePack = {
  category: "PHEV",
  focusAreas: [
    "battery condition and electric-only range (does it still deliver the rated EV miles?)",
    "engine maintenance history (oil changes, timing belt/chain for the ICE side)",
    "charging habits of previous owner (PHEVs driven gas-only may have neglected battery)",
    "electric range realism in cold weather",
    "transition behavior between EV and gas modes",
  ],
  inspectionPriorities: [
    "Test electric-only range — charge fully and drive until engine kicks in",
    "Check engine service history (oil changes, spark plugs, coolant for the ICE side)",
    "Verify the charger port and L2 charging work",
    "Look for check engine lights related to emissions or hybrid system",
    "Inspect brake pads — PHEVs with regen braking may have uneven wear",
  ],
  redditQuestionTemplates: {
    uncertaintyQ: "How is the electric-only range holding up on these at this age?",
    checkFirstQ: "What would you check first — the battery side or the engine side?",
  },
};

const ICE_PACK: CategoryTemplatePack = {
  category: "ICE",
  focusAreas: [
    "full service history and maintenance records",
    "accident severity and potential hidden frame damage",
    "rust and undercarriage condition (especially in salt-belt states)",
    "drivetrain wear (transmission fluid condition, differential)",
    "timing belt/chain status and replacement interval",
  ],
  inspectionPriorities: [
    "Get a pre-purchase inspection from an independent mechanic",
    "Check transmission fluid color and condition",
    "Look underneath for rust, oil leaks, and frame damage",
    "Verify timing belt/chain service history for the mileage",
    "Test drive at highway speeds and listen for unusual noises",
  ],
  redditQuestionTemplates: {
    uncertaintyQ: "What are the common expensive issues on this model at this mileage?",
    checkFirstQ: "What would you look at first on a high-mileage version of this model?",
  },
};

// Truck-specific overlay (appended to EV/ICE pack)
const TRUCK_OVERLAY = {
  focusAreas: [
    "frame and undercarriage rust (especially in northern states)",
    "tow package presence and rated towing capacity",
    "suspension and steering component wear",
    "transmission condition (especially if used for towing)",
  ],
  inspectionPriorities: [
    "Inspect frame rails for rust, cracks, or previous repair welds",
    "Verify tow package and check hitch receiver condition",
    "Check leaf springs, shocks, and ball joints for wear",
    "Test transmission shifting under load if possible",
  ],
};

export function getTemplatePack(
  classification: VehicleClassification
): CategoryTemplatePack {
  let basePack: CategoryTemplatePack;

  switch (classification.category) {
    case "EV":
      basePack = {
        ...EV_PACK,
        focusAreas: [...EV_PACK.focusAreas],
        inspectionPriorities: [...EV_PACK.inspectionPriorities],
      };
      break;
    case "PHEV":
      basePack = {
        ...PHEV_PACK,
        focusAreas: [...PHEV_PACK.focusAreas],
        inspectionPriorities: [...PHEV_PACK.inspectionPriorities],
      };
      break;
    default:
      basePack = {
        ...ICE_PACK,
        focusAreas: [...ICE_PACK.focusAreas],
        inspectionPriorities: [...ICE_PACK.inspectionPriorities],
      };
      break;
  }

  // Adjust DCFC focus areas for EVs based on capability
  if (classification.category === "EV" && classification.dcfcSupport !== "yes") {
    basePack.focusAreas = basePack.focusAreas.map((area) => {
      if (area.includes("nearby DCFC stations")) {
        return "confirm whether DC fast charging is supported and which connector before relying on it";
      }
      if (area.includes("DCFC charging speed")) {
        return classification.dcfcSupport === "no"
          ? "this model may not support DC fast charging — verify before assuming fast charging is available"
          : "confirm DC fast charging capability and connector type";
      }
      return area;
    });
    basePack.inspectionPriorities = basePack.inspectionPriorities.map((item) => {
      if (item.includes("test DCFC")) {
        return "Verify whether DC fast charging port exists and is functional";
      }
      return item;
    });
  }

  // Apply truck overlay if applicable
  if (classification.subCategory === "truck") {
    basePack = {
      ...basePack,
      focusAreas: [...basePack.focusAreas, ...TRUCK_OVERLAY.focusAreas],
      inspectionPriorities: [...basePack.inspectionPriorities, ...TRUCK_OVERLAY.inspectionPriorities],
    };
  }

  return basePack;
}
