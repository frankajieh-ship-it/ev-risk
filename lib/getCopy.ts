/**
 * Regional Copy Accessor
 * Simple helper to get copy for a specific region
 */

import { copyByRegion, Region, RegionalCopy } from "./regionCopy";

export function getCopy(region: Region): RegionalCopy {
  return copyByRegion[region];
}
