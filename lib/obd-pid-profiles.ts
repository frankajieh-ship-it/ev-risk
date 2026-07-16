/**
 * OBD-II PID Profiles for EV Battery Health
 *
 * Maps vehicle make/model to the PID addresses needed to extract:
 *   - State of Health (SOH %)
 *   - Full charge capacity (kWh)
 *   - Cycle count
 *   - Cell voltages (where available)
 *
 * These PIDs are read by the OFFO dealer scanning PWA via Web Bluetooth
 * connected to an OBDLink MX+ or compatible ELM327 dongle.
 *
 * Sources: LeafSpy, EVNotify, Car Scanner community PID tables,
 *          open source EV diagnostic projects.
 *
 * Tesla is intentionally excluded — proprietary protocol, no OBD-II support.
 */

export type PidProfile =
  | "bolt"
  | "leaf"
  | "ioniq5_ev6"
  | "ioniq6"
  | "id4"
  | "model3_y"   // excluded — here for UI messaging only
  | "generic";

export interface OBDPidSet {
  profile: PidProfile;
  label: string;                    // display name
  supported: boolean;               // false = Tesla / unsupported
  unsupportedReason?: string;
  sohPid?: string;                  // hex PID address
  capacityPid?: string;
  cyclePid?: string;
  cellVoltagePid?: string;          // returns array
  nominalCapacityKwh: number;       // factory spec for reference
  notes?: string;
}

export const PID_PROFILES: Record<PidProfile, OBDPidSet> = {
  bolt: {
    profile: "bolt",
    label: "Chevrolet Bolt EV / EUV",
    supported: true,
    sohPid: "2814",
    capacityPid: "2815",
    cyclePid: "2816",
    cellVoltagePid: "2900",
    nominalCapacityKwh: 65,
    notes: "Works on 2017-2023 Bolt EV and 2022+ EUV. Use BoltSpy or Car Scanner with GM PID set.",
  },
  leaf: {
    profile: "leaf",
    label: "Nissan LEAF",
    supported: true,
    sohPid: "5B4",
    capacityPid: "5B3",
    cyclePid: "5B5",
    cellVoltagePid: "5C0",
    nominalCapacityKwh: 40,   // 40 kWh for 2018+; 24/30 kWh for earlier
    notes: "Use LeafSpy Pro for best results. 24 kWh (2011-2015) and 30 kWh (2016-2017) have lower nominal.",
  },
  ioniq5_ev6: {
    profile: "ioniq5_ev6",
    label: "Hyundai Ioniq 5 / Kia EV6",
    supported: true,
    sohPid: "0105",
    capacityPid: "0101",
    cyclePid: "0115",
    cellVoltagePid: "0200",
    nominalCapacityKwh: 77.4,
    notes: "Shared E-GMP platform. Also covers Ioniq 6 and EV9 on same PIDs.",
  },
  ioniq6: {
    profile: "ioniq6",
    label: "Hyundai Ioniq 6 / Kia EV9",
    supported: true,
    sohPid: "0105",
    capacityPid: "0101",
    cyclePid: "0115",
    cellVoltagePid: "0200",
    nominalCapacityKwh: 77.4,
    notes: "Same E-GMP PIDs as Ioniq 5 / EV6.",
  },
  id4: {
    profile: "id4",
    label: "Volkswagen ID.4",
    supported: true,
    sohPid: "028C",
    capacityPid: "028D",
    cyclePid: "028E",
    nominalCapacityKwh: 82,
    notes: "Works on ID.4, ID.3, and Audi Q4 e-tron (shared MEB platform).",
  },
  model3_y: {
    profile: "model3_y",
    label: "Tesla Model 3 / Y / S / X",
    supported: false,
    unsupportedReason:
      "Tesla does not support the OBD-II protocol. Battery data requires Tesla owner API authentication or a proprietary scan tool. OFFO battery scanning does not support Tesla in this version.",
    nominalCapacityKwh: 82,
  },
  generic: {
    profile: "generic",
    label: "Other EV (generic OBD-II)",
    supported: true,
    sohPid: "015B",   // SAE J1979 mode 01 PID — not all EVs implement this
    nominalCapacityKwh: 0,
    notes: "Generic fallback. SOH accuracy varies by manufacturer OBD implementation. Use make-specific profile where available.",
  },
};

/** Map from VIN prefix / make string → PID profile */
const MAKE_TO_PROFILE: Array<{ pattern: RegExp; profile: PidProfile }> = [
  { pattern: /^(chevrolet|chevy|gmc)\s*(bolt|spark|equinox\s*ev)/i, profile: "bolt" },
  { pattern: /^nissan\s*leaf/i, profile: "leaf" },
  { pattern: /^hyundai\s*ioniq\s*(5|6)/i, profile: "ioniq5_ev6" },
  { pattern: /^kia\s*(ev6|ev9|niro\s*ev)/i, profile: "ioniq5_ev6" },
  { pattern: /^volkswagen|^vw/i, profile: "id4" },
  { pattern: /^audi\s*(q4|e-tron)/i, profile: "id4" },
  { pattern: /^tesla/i, profile: "model3_y" },
];

export function profileForMake(make: string, model?: string): OBDPidSet {
  const query = model ? `${make} ${model}` : make;
  for (const { pattern, profile } of MAKE_TO_PROFILE) {
    if (pattern.test(query)) return PID_PROFILES[profile];
  }
  return PID_PROFILES.generic;
}

/** VIN WMI → make lookup for auto-profile selection */
const WMI_TO_PROFILE: Record<string, PidProfile> = {
  // Chevrolet Bolt
  "1G1": "bolt",
  // Nissan LEAF (US, Japan, UK WMIs)
  "1N4": "leaf",
  "JN1": "leaf",
  SJN: "leaf",
  // Hyundai Ioniq 5
  KM8: "ioniq5_ev6",
  KMH: "ioniq5_ev6",
  // Kia EV6 / EV9
  KNA: "ioniq5_ev6",
  KND: "ioniq5_ev6",
  // VW ID.4
  WVG: "id4",
  WV2: "id4",
  // Audi Q4 e-tron
  WA1: "id4",
  // Tesla
  "5YJ": "model3_y",
  "7SA": "model3_y",
  "7GE": "model3_y",
  LRW: "model3_y",
};

export function profileForVin(vin: string): OBDPidSet {
  if (!vin || vin.length < 3) return PID_PROFILES.generic;
  const wmi = vin.slice(0, 3).toUpperCase();
  const profile = WMI_TO_PROFILE[wmi];
  return profile ? PID_PROFILES[profile] : PID_PROFILES.generic;
}

/** Human-readable SOH quality label */
export function sohLabel(sohPct: number): { label: string; color: "green" | "yellow" | "red" } {
  if (sohPct >= 90) return { label: "Excellent", color: "green" };
  if (sohPct >= 80) return { label: "Good", color: "green" };
  if (sohPct >= 70) return { label: "Fair", color: "yellow" };
  return { label: "Poor", color: "red" };
}
