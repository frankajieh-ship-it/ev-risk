/**
 * EV Model Detection
 *
 * Extracted from lib/vehicle-classifier.ts for use in the Chrome extension.
 * Deterministic EV detection — no AI call needed.
 */

export const ALL_EV_MAKES = new Set([
  "tesla",
  "rivian",
  "lucid",
  "polestar",
  "fisker",
]);

export const EV_MODELS: Record<string, string[]> = {
  chevrolet: ["bolt", "bolt ev", "bolt euv", "equinox ev", "blazer ev", "silverado ev"],
  chevy: ["bolt", "bolt ev", "bolt euv", "equinox ev", "blazer ev", "silverado ev"],
  ford: ["mustang mach-e", "mach-e", "f-150 lightning", "lightning", "focus electric"],
  hyundai: ["ioniq 5", "ioniq 6", "ioniq5", "ioniq6"],
  kia: ["ev6", "ev9", "niro ev"],
  bmw: ["ix", "i4", "i5", "i7", "ix1", "ix3"],
  mercedes: ["eqs", "eqe", "eqb", "eqa", "eqc", "eqv"],
  "mercedes-benz": ["eqs", "eqe", "eqb", "eqa", "eqc", "eqv"],
  volkswagen: ["id.4", "id.buzz", "id4", "id buzz"],
  vw: ["id.4", "id.buzz", "id4", "id buzz"],
  nissan: ["leaf", "ariya"],
  cadillac: ["lyriq"],
  volvo: ["ex30", "ex90", "ec40", "c40 recharge", "xc40 recharge pure electric"],
  toyota: ["bz4x"],
  subaru: ["solterra"],
  honda: ["prologue"],
  acura: ["zdx"],
  genesis: ["gv60", "electrified g80", "electrified gv70"],
  mini: ["cooper se", "electric"],
  fiat: ["500e"],
  mazda: ["mx-30"],
  smart: ["eq fortwo", "eq forfour", "#1", "#3"],
  porsche: ["taycan"],
  audi: ["e-tron", "etron", "e-tron gt", "q4 e-tron", "q8 e-tron"],
  jaguar: ["i-pace"],
  hummer: ["ev"],
  gmc: ["hummer ev"],
};

export function isEV(make: string, model: string, trim?: string): boolean {
  const m = make.toLowerCase().trim();
  const mod = model.toLowerCase().trim();

  // All-EV makes
  if (ALL_EV_MAKES.has(m)) return true;

  // Known EV models
  const known = EV_MODELS[m];
  if (known && known.some((k) => mod.includes(k))) return true;

  // Trim/keyword-based detection
  const combined = `${mod} ${(trim || "").toLowerCase()}`;
  if (/\belectric\b|\bev\b|\bbev\b|\bkwh\b/.test(combined)) return true;

  return false;
}
