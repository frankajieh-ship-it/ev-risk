/**
 * Vehicle → relevance tag mapping
 *
 * Shared between /api/news/garage (on-demand) and the news-alert email job (scheduled).
 * Brand-level tags match broad articles; model-level tags match model-specific ones.
 */

export function vehicleToTags(make: string, model: string): string[] {
  const key = `${make} ${model}`.toLowerCase();
  const tags: string[] = ["ev", "electric_vehicle"];

  // Brand
  if (key.includes("tesla")) tags.push("tesla");
  if (key.includes("rivian")) tags.push("rivian");
  if (key.includes("ford") || key.includes("f-150") || key.includes("mach-e")) tags.push("ford");
  if (key.includes("chevy") || key.includes("chevrolet") || key.includes("bolt")) tags.push("gm");
  if (key.includes("hyundai") || key.includes("kia")) tags.push("hyundai_kia");
  if (key.includes("volkswagen") || key.includes("vw") || key.includes("id.4") || key.includes("id4")) tags.push("volkswagen");
  if (key.includes("nissan") || key.includes("leaf")) tags.push("nissan");
  if (key.includes("bmw") || key.includes("i4") || key.includes("ix")) tags.push("bmw");
  if (key.includes("audi") || key.includes("e-tron") || key.includes("etron")) tags.push("audi");
  if (key.includes("lucid")) tags.push("lucid");
  if (key.includes("polestar")) tags.push("polestar");
  if (key.includes("subaru") || key.includes("solterra")) tags.push("subaru");
  if (key.includes("toyota") || key.includes("bz4x")) tags.push("toyota");
  if (key.includes("gmc") || key.includes("hummer") || key.includes("sierra")) tags.push("gmc");

  // Model-specific (stronger signal)
  if (key.includes("model y") || key.includes("model 3")) tags.push("tesla_model3y");
  if (key.includes("model x") || key.includes("model s")) tags.push("tesla_modelsx");
  if (key.includes("cybertruck")) tags.push("cybertruck");
  if (key.includes("ioniq 5")) tags.push("ioniq5");
  if (key.includes("ioniq 6")) tags.push("ioniq6");
  if (key.includes("ev6")) tags.push("ev6");
  if (key.includes("bolt")) tags.push("bolt_ev");
  if (key.includes("mach-e") || key.includes("mach e")) tags.push("mach_e");
  if (key.includes("f-150 lightning") || key.includes("f150 lightning")) tags.push("f150_lightning");
  if (key.includes("id.4") || key.includes("id4")) tags.push("id4");
  if (key.includes("leaf")) tags.push("leaf");
  if (key.includes("r1s") || key.includes("r1t")) tags.push("rivian");
  if (key.includes("air")) tags.push("lucid_air");
  if (key.includes("solterra")) tags.push("solterra");
  if (key.includes("bz4x")) tags.push("bz4x");
  if (key.includes("hummer ev")) tags.push("hummer_ev");

  return tags;
}

/**
 * Returns true if any of the article's key_routine_effects match the vehicle's tags.
 * Used to filter articles to only those relevant to a specific vehicle.
 */
export function articleMatchesVehicle(
  effects: string[],
  make: string,
  model: string
): boolean {
  const tags = vehicleToTags(make, model);
  const effectsLower = effects.map((e) => e.toLowerCase());
  return effectsLower.some((e) => tags.some((t) => e.includes(t) || t.includes(e)));
}
